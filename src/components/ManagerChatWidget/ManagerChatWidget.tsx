import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './ManagerChatWidget.module.css';

interface Message {
  readonly id: string;
  readonly role: 'user' | 'manager';
  readonly content: string;
  readonly attachments?: readonly ChatAttachment[];
}

interface ChatAttachment {
  readonly name: string;
  readonly url: string;
  readonly size: number;
  readonly mimeType: string;
}

const SESSION_KEY = 'stroy-balkon-manager-chat';

export function ManagerChatWidget(): JSX.Element | null {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(() => localStorage.getItem(SESSION_KEY));
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  function scrollToBottom(): void {
    window.requestAnimationFrame(() => {
      const element = listRef.current;
      if (element) element.scrollTo({ top: element.scrollHeight, behavior: 'auto' });
      window.requestAnimationFrame(() => {
        if (element) element.scrollTo({ top: element.scrollHeight, behavior: 'auto' });
      });
    });
  }

  function addFiles(files: readonly File[]): void {
    setSelectedFiles((current) => {
      const accepted = [...current];
      for (const file of files) {
        if (accepted.length >= 5) break;
        if (file.size > 10 * 1024 * 1024) continue;
        const duplicate = accepted.some((item) =>
          item.name === file.name && item.size === file.size && item.lastModified === file.lastModified
        );
        if (!duplicate) accepted.push(file);
      }
      return accepted;
    });
  }

  useEffect(() => {
    let cancelled = false;
    fetch('/api/chat/session')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success && data.sessionId) {
          localStorage.setItem(SESSION_KEY, data.sessionId);
          setSessionId(data.sessionId);
          setMessages(data.messages ?? []);
        } else {
          localStorage.removeItem(SESSION_KEY);
          setSessionId(null);
          setMessages([]);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open || !sessionId) return;
    let stopped = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/chat/sessions/${sessionId}/messages`);
        const data = await res.json();
        if (!stopped && data.success) setMessages(data.messages ?? []);
      } catch {
        // Keep the last displayed conversation while polling.
      }
    };
    void load();
    const timer = window.setInterval(load, 4000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [open, sessionId]);

  useEffect(() => {
    if (open) scrollToBottom();
  }, [open, messages]);

  async function send(event: FormEvent): Promise<void> {
    event.preventDefault();
    const content = input.trim();
    if ((!content && selectedFiles.length === 0) || sending) return;
    setSending(true);
    try {
      let activeSession = sessionId;
      if (!activeSession) {
        const created = await fetch('/api/chat/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page: location.pathname }),
        });
        const data = await created.json();
        if (!created.ok || !data.sessionId) throw new Error('chat');
        activeSession = data.sessionId;
        if (!activeSession) throw new Error('chat');
        localStorage.setItem(SESSION_KEY, activeSession);
        setSessionId(activeSession);
      }
      const body = new FormData();
      body.set('content', content);
      selectedFiles.slice(0, 5).forEach((file) => body.append('files', file));
      const res = await fetch(`/api/chat/sessions/${activeSession}/messages`, {
        method: 'POST',
        body,
      });
      if (!res.ok) throw new Error('message');
      const data = await res.json().catch(() => null);
      setInput('');
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setMessages((current) => [...current, {
        id: `local-${Date.now()}`,
        role: 'user',
        content,
        attachments: data?.message?.attachments ?? [],
      }]);
    } catch {
      setMessages((current) => [...current, {
        id: `error-${Date.now()}`,
        role: 'manager',
        content: 'Не удалось отправить сообщение. Позвоните нам или попробуйте позже.',
      }]);
    } finally {
      setSending(false);
    }
  }

  if (location.pathname.startsWith('/admin')) return null;

  return (
    <div className={styles.root}>
      {open ? (
        <section className={styles.panel} role="dialog" aria-label="Чат с менеджером">
          <header className={styles.head}>
            <div>
              <strong>Написать менеджеру</strong>
              <span>Ответим и уточним детали</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть">×</button>
          </header>
          <div className={styles.messages} ref={listRef}>
            {messages.length === 0 ? (
              <p className={styles.empty}>Здравствуйте! Напишите ваш вопрос — менеджер ответит в чате.</p>
            ) : messages.map((message) => (
              <div
                key={message.id}
                className={`${styles.message} ${message.role === 'manager' ? styles.manager : styles.user}`}
              >
                {message.content ? <p>{message.content}</p> : null}
                {message.attachments?.map((attachment) => (
                  attachment.mimeType.startsWith('image/') ? (
                    <img
                      key={attachment.url}
                      className={styles.attachmentImage}
                      src={attachment.url}
                      alt=""
                      loading="lazy"
                      onLoad={scrollToBottom}
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                        scrollToBottom();
                      }}
                    />
                  ) : (
                    <a className={styles.fileLink} key={attachment.url} href={attachment.url} target="_blank" rel="noreferrer">
                      <span>📎</span>
                      <span className={styles.fileName}>{attachment.name}</span>
                    </a>
                  )
                ))}
              </div>
            ))}
          </div>
          <form className={styles.form} onSubmit={send}>
            {selectedFiles.length > 0 ? (
              <div className={styles.selectedFiles}>
                {selectedFiles.map((file) => (
                  <span key={`${file.name}-${file.size}-${file.lastModified}`} title={file.name}>
                    {file.name}
                  </span>
                ))}
              </div>
            ) : null}
            <div className={styles.formRow}>
              <input
                ref={fileInputRef}
                className={styles.fileInput}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
                multiple
                onChange={(event) => {
                  addFiles(Array.from(event.target.files ?? []));
                }}
              />
              <button
                className={styles.attachBtn}
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Прикрепить фотографию или файл"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-8.49 8.49a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.19 9.19a2 2 0 01-2.83-2.83l8.49-8.49" />
                </svg>
              </button>
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onPaste={(event) => {
                  const pastedFiles = Array.from(event.clipboardData.files);
                  if (pastedFiles.length > 0) {
                    event.preventDefault();
                    addFiles(pastedFiles.map((file, index) =>
                      file.name && file.name !== 'image.png'
                        ? file
                        : new File([file], `изображение-${Date.now()}-${index + 1}.png`, {
                            type: file.type || 'image/png',
                            lastModified: Date.now(),
                          })
                    ));
                  }
                }}
                placeholder="Сообщение менеджеру…"
                aria-label="Сообщение менеджеру"
                maxLength={2000}
              />
              <button type="submit" disabled={(!input.trim() && selectedFiles.length === 0) || sending} aria-label="Отправить">→</button>
            </div>
          </form>
        </section>
      ) : null}
      <button
        className={styles.fab}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Закрыть чат с менеджером' : 'Открыть чат с менеджером'}
      >
        {open ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 20l1.1-4.4A8.5 8.5 0 1 1 21 11.5z" />
            <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" />
          </svg>
        )}
      </button>
    </div>
  );
}
