import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { usePageTitle } from '../../lib/usePageTitle';
import { AdminTokenGate } from './AdminTokenGate';
import { AdminNav } from './AdminNav';
import { useAdminAuth } from './useAdminAuth';
import styles from './AdminPanel.module.css';

interface ChatAttachment { name:string; url:string; size:number; mimeType:string }
interface ChatMessage { id:string; role:'user'|'manager'; content:string; attachments?:ChatAttachment[]; createdAt:string }
interface ChatSession { id:string; visitorName:string|null; visitorPhone:string|null; page:string; status:'new'|'processing'|'answered'|'closed'; updatedAt:string; messages:ChatMessage[] }

export function AdminChats(): JSX.Element {
  const auth=useAdminAuth();
  if(!auth.token)return <AdminTokenGate title="Чаты" onAuthed={auth.login}/>;
  return <ChatsPanel token={auth.token} onLogout={auth.logout}/>;
}

function ChatsPanel({token,onLogout}:{token:string;onLogout:()=>void}):JSX.Element{
  usePageTitle('Админ · Чаты');
  const {id}=useParams<{id:string}>();
  const [sessions,setSessions]=useState<ChatSession[]>([]);
  const [status,setStatus]=useState<'all'|'new'|'processing'|'answered'|'closed'>('all');
  useEffect(()=>{
    const qs=status==='all'?'':`?status=${status}`;
    fetch(`/api/admin/chat-sessions${qs}`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(d=>setSessions(d.sessions??[]));
  },[token,status]);
  if(id)return <ChatDetail id={id} token={token} onLogout={onLogout} sessions={sessions}/>;
  return <div className={styles.wrap}><AdminNav title="Чаты" onLogout={onLogout}/>
    <main className={styles.body}>
      <div className={styles.toolbar}><select className={styles.select} value={status} onChange={e=>setStatus(e.target.value as typeof status)}><option value="all">Все статусы</option><option value="new">Новые</option><option value="processing">В работе</option><option value="answered">Ответил</option><option value="closed">Закрыт</option></select></div>
      {sessions.length===0?<div className={styles.empty}>Активных чатов нет.</div>:<div className={styles.table}>
        <div className={`${styles.row} ${styles.rowHead}`}><span>Посетитель</span><span>Страница</span><span>Статус</span><span>Обновлен</span></div>
        {sessions.map(session=><a className={`${styles.row} ${styles.rowLink}`} href={`/admin/chats/${session.id}`} key={session.id}><strong>{session.visitorName||'Посетитель'}</strong><span>{session.page}</span><span className={styles.badge}>{session.status}</span><span>{new Date(session.updatedAt).toLocaleString('ru-RU')}</span></a>)}
      </div>}
    </main>
  </div>;
}

function ChatDetail({id,token,onLogout,sessions}:{id:string;token:string;onLogout:()=>void;sessions:ChatSession[]}):JSX.Element{
  const [session,setSession]=useState<ChatSession|null>(sessions.find(s=>s.id===id)??null);
  const [input,setInput]=useState('');
  const [selectedFiles,setSelectedFiles]=useState<File[]>([]);
  const fileInputRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(session)return;fetch(`/api/admin/chat-sessions?limit=100`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(d=>setSession((d.sessions??[]).find((s:ChatSession)=>s.id===id)??null));},[id,token,session]);
  async function send(){
    if(!input.trim()&&!selectedFiles.length)return;
    const body=new FormData();
    body.set('content',input.trim());
    selectedFiles.slice(0,5).forEach(file=>body.append('files',file));
    const res=await fetch(`/api/admin/chat-sessions/${id}/messages`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body});
    const data=await res.json().catch(()=>null);
    if(res.ok&&data?.message)setSession(current=>current?{...current,status:'answered',messages:[...current.messages,data.message]}:current);
    setInput('');
    setSelectedFiles([]);
    if(fileInputRef.current)fileInputRef.current.value='';
  }
  async function setChatStatus(status:string){await fetch(`/api/admin/chat-sessions/${id}/status`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({status})});setSession(current=>current?{...current,status:status as ChatSession['status']}:current);}
  return <div className={styles.wrap}><AdminNav title="Чат" onLogout={onLogout}/><main className={styles.body}>{session?<div className={styles.detail}>
    <aside className={styles.card}><strong>{session.visitorName||'Посетитель'}</strong><p>{session.visitorPhone||'Телефон не указан'}</p><p>Страница: {session.page}</p><div className={styles.status}>{(['new','processing','answered','closed'] as const).map(s=><button type="button" key={s} onClick={()=>setChatStatus(s)}>{s}</button>)}</div></aside>
    <section className={styles.card}><div className={styles.messages}>{session.messages.map(m=><div key={m.id} className={`${styles.message} ${m.role==='manager'?styles.manager:''}`}>
      {m.content?<p>{m.content}</p>:null}
      {m.attachments?.map(a=>a.mimeType.startsWith('image/')?
        <a key={a.url} href={a.url} target="_blank" rel="noreferrer"><img className={styles.adminAttachmentImage} src={a.url} alt={a.name}/><span>{a.name}</span></a>:
        <a key={a.url} href={a.url} target="_blank" rel="noreferrer">📎 {a.name}</a>)}
    </div>)}</div><div className={styles.reply}>
      <input ref={fileInputRef} className={styles.fileInput} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar" multiple onChange={e=>setSelectedFiles(Array.from(e.target.files??[]).slice(0,5).filter(f=>f.size<=10*1024*1024))}/>
      <button type="button" onClick={()=>fileInputRef.current?.click()} title="Прикрепить файл">📎</button>
      <input value={input} onChange={e=>setInput(e.target.value)} placeholder={selectedFiles.length?'Файлы выбраны':'Ответ посетителю…'} />
      <button type="button" onClick={send}>Ответить</button>
    </div></section>
  </div>:<div className={styles.empty}>Чат не найден.</div>}</main></div>;
}
