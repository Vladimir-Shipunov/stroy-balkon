/**
 * @file AdminTokenGate — shared login form for every `/admin/*` page.
 * Authenticates against the real server-side `ADMIN_API_TOKEN` (via a
 * lightweight ping to the already-guarded `/api/statistics`) — not a
 * cosmetic client-only password. Without `ADMIN_API_TOKEN` set in `.env`,
 * the server fails closed and this form says so.
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../../components/Header/Logo';
import styles from './AdminTokenGate.module.css';

interface AdminTokenGateProps {
  readonly title: string;
  readonly onAuthed: (token: string) => void;
}

export function AdminTokenGate({ title, onAuthed }: AdminTokenGateProps): JSX.Element {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!value.trim()) return;
    setChecking(true);
    setError(null);
    try {
      const res = await fetch('/api/statistics', { headers: { Authorization: `Bearer ${value.trim()}` } });
      if (res.ok) {
        onAuthed(value.trim());
        return;
      }
      if (res.status === 503) {
        setError('Администрирование не настроено на сервере — задайте ADMIN_API_TOKEN в .env и перезапустите сервер.');
      } else {
        setError('Неверный токен.');
      }
    } catch {
      setError('Не удалось связаться с сервером.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className={styles.gate}>
      <form className={styles.gateCard} onSubmit={submit}>
        <Logo />
        <h1 className={styles.gateTitle}>{title}</h1>
        <p className={styles.gateSub}>
          Введите административный токен (см. <code>ADMIN_API_TOKEN</code> в <code>.env</code>).
        </p>
        <input
          className={styles.input}
          type="password"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="Токен администратора"
          autoFocus
        />
        {error ? <p className={styles.error}>{error}</p> : null}
        <button className="btn btn--primary" type="submit" disabled={checking}>
          {checking ? 'Проверка…' : 'Войти'}
        </button>
        <Link to="/" className={styles.backLink}>
          ← На сайт
        </Link>
      </form>
    </div>
  );
}
