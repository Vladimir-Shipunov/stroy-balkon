import { useEffect, useState } from 'react';
import { usePageTitle } from '../../lib/usePageTitle';
import { AdminTokenGate } from './AdminTokenGate';
import { AdminNav } from './AdminNav';
import { useAdminAuth } from './useAdminAuth';
import styles from './AdminPanel.module.css';

type CallStatus = 'pending' | 'processed' | 'cancelled';
interface CallRequest { id:string; name:string; phone:string; status:CallStatus; createdAt:string; processedAt:string|null }

export function AdminCalls(): JSX.Element {
  const auth = useAdminAuth();
  if (!auth.token) return <AdminTokenGate title="Заказы замера" onAuthed={auth.login} />;
  return <CallsPanel token={auth.token} onLogout={auth.logout} />;
}

function CallsPanel({ token, onLogout }: { token:string; onLogout:()=>void }): JSX.Element {
  usePageTitle('Админ · Заказ замера');
  const [calls,setCalls]=useState<CallRequest[]>([]);
  const [status,setStatus]=useState<CallStatus|'all'>('all');
  useEffect(() => {
    const qs=status==='all'?'' : `?status=${status}`;
    fetch(`/api/admin/call-requests${qs}`,{headers:{Authorization:`Bearer ${token}`}})
      .then(r=>r.json()).then(data=>setCalls(data.calls ?? []));
  },[token,status]);
  async function update(id:string,next:CallStatus) {
    await fetch(`/api/admin/call-requests/${id}/status`,{
      method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify({status:next}),
    });
    setCalls(current=>current.map(call=>call.id===id?{...call,status:next}:call));
  }
  return <div className={styles.wrap}><AdminNav title="Заказы замера" onLogout={onLogout}/>
    <main className={styles.body}>
      <div className={styles.toolbar}>
        <select className={styles.select} value={status} onChange={e=>setStatus(e.target.value as CallStatus|'all')}>
          <option value="all">Все статусы</option><option value="pending">Новая</option><option value="processed">Обработана</option><option value="cancelled">Отменена</option>
        </select>
        <span className={styles.count}>Всего: {calls.length}</span>
      </div>
      {calls.length===0?<div className={styles.empty}>Заявок пока нет.</div>:<div className={styles.table}>
        <div className={`${styles.row} ${styles.rowHead}`}><span>Клиент</span><span>Телефон</span><span>Статус</span><span>Дата</span></div>
        {calls.map(call=><div className={styles.row} key={call.id}>
          <strong>{call.name}</strong><a href={`tel:${call.phone}`}>{call.phone}</a>
          <select
            className={styles.select}
            value={call.status}
            onChange={(event)=>update(call.id,event.target.value as CallStatus)}
            aria-label={`Статус заявки ${call.name}`}
          >
            <option value="pending">Новая</option>
            <option value="processed">Обработана</option>
            <option value="cancelled">Отменена</option>
          </select>
          <span>{new Date(call.createdAt).toLocaleString('ru-RU')}</span>
        </div>)}
      </div>}
    </main>
  </div>;
}
