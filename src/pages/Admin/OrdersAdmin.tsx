/**
 * @file OrdersAdmin — token-gated order list + detail at /admin/orders and
 * /admin/orders/:id (the latter is what the Telegram new-order notification
 * links to, see server/utils/telegram-bot.js — that page didn't exist before).
 * Talks to the existing, already admin-guarded REST endpoints in
 * server/routes/orders.js; no new server code needed.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePageTitle } from '../../lib/usePageTitle';
import { AdminTokenGate } from './AdminTokenGate';
import { SavedConfigPreview } from './SavedConfigPreview';
import { useAdminAuth } from './useAdminAuth';
import { AdminNav } from './AdminNav';
import styles from './OrdersAdmin.module.css';

type OrderStatus = 'new' | 'processing' | 'confirmed' | 'in_work' | 'completed' | 'cancelled';

const STATUSES: readonly OrderStatus[] = ['new', 'processing', 'confirmed', 'in_work', 'completed', 'cancelled'];
const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'Новая',
  processing: 'В обработке',
  confirmed: 'Подтверждена',
  in_work: 'В работе',
  completed: 'Завершена',
  cancelled: 'Отменена',
};

/** Loosely typed — this is `cleanObject`-sanitised JSON from the client, not a DB schema. */
interface OrderMetadata {
  /** Human-readable rows of the configuration, as the customer saw them. */
  readonly summary?: readonly { readonly label: string; readonly value: string }[];
  /** The full `VamSelection` at submission time — enough to re-render the picture read-only. */
  readonly scene2d?: unknown;
}
interface Order {
  readonly id: string;
  readonly orderId: string;
  readonly clientName: string;
  readonly clientPhone: string;
  readonly clientEmail: string | null;
  readonly clientAddress: string | null;
  readonly comment: string | null;
  readonly balconyType: string;
  readonly balconySize: number;
  readonly balconyShape: string;
  readonly screenshot: string | null;
  readonly metadata: OrderMetadata;
  readonly status: OrderStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

const DATE = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : DATE.format(d);
}

function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === 'string' && (STATUSES as readonly string[]).includes(v);
}

/** Thin fetch wrapper for the admin-guarded orders API; calls `onUnauthorized` on a 401 (stale/wrong token). */
async function adminFetch(url: string, token: string, onUnauthorized: () => void, init?: RequestInit): Promise<Response | null> {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    onUnauthorized();
    return null;
  }
  return res;
}

export function OrdersAdmin(): JSX.Element {
  const { token, login, logout } = useAdminAuth();
  if (!token) {
    return <AdminTokenGate title="Заказы" onAuthed={login} />;
  }
  return <Panel token={token} onLogout={logout} />;
}

function Panel({ token, onLogout }: { token: string; onLogout: () => void }): JSX.Element {
  const { id } = useParams<{ id: string }>();
  return (
    <div className={styles.wrap}>
      <AdminNav title="Заказы" onLogout={onLogout} />
      {id ? <OrderDetail id={id} token={token} onUnauthorized={onLogout} /> : <OrderList token={token} onUnauthorized={onLogout} />}
    </div>
  );
}

function OrderList({ token, onUnauthorized }: { token: string; onUnauthorized: () => void }): JSX.Element {
  usePageTitle('Админ · Заказы');
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setOrders(null);
    const qs = new URLSearchParams({ page: String(page), limit: '20' });
    if (status) qs.set('status', status);
    adminFetch(`/api/orders?${qs}`, token, onUnauthorized).then(async (res) => {
      if (!res || cancelled) return;
      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        orders?: Order[];
        pagination?: { pages?: number; total?: number };
      } | null;
      if (!data?.success) {
        setOrders([]);
        return;
      }
      setOrders(data.orders ?? []);
      setPages(data.pagination?.pages ?? 1);
      setTotal(data.pagination?.total ?? 0);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status, page]);

  return (
    <div className={styles.body}>
      <div className={styles.toolbar}>
        <select
          className={styles.select}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as OrderStatus | '');
            setPage(1);
          }}
        >
          <option value="">Все статусы</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {orders ? <span className={styles.count}>Всего: {total}</span> : null}
      </div>

      {!orders ? (
        <div className={styles.empty}>Загрузка…</div>
      ) : orders.length === 0 ? (
        <div className={styles.empty}>Заказов пока нет.</div>
      ) : (
        <>
          <div className={styles.table} role="table">
            <div className={`${styles.row} ${styles.rowHead}`} role="row">
              <span>№ заказа</span>
              <span>Клиент</span>
              <span>Объект</span>
              <span>Статус</span>
              <span>Дата</span>
            </div>
            {orders.map((o) => (
              <Link key={o.id} to={`/admin/orders/${o.id}`} className={styles.rowLink}>
                <div className={styles.row} role="row">
                  <span>{o.orderId}</span>
                  <span className={styles.rowClient}>
                    <strong>{o.clientName}</strong>
                    <span>{o.clientPhone}</span>
                  </span>
                  <span>
                    {o.balconyType}
                    {o.balconySize > 0 ? `, ${o.balconySize} м²` : ''}
                  </span>
                  <span className={`${styles.badge} ${styles[`badge-${o.status}`] ?? ''}`}>{STATUS_LABEL[o.status] ?? o.status}</span>
                  <span>{formatDate(o.createdAt)}</span>
                </div>
              </Link>
            ))}
          </div>
          {pages > 1 ? (
            <div className={styles.pagination}>
              <button className={styles.pageBtn} type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ← Назад
              </button>
              <span className={styles.count}>
                Стр. {page} из {pages}
              </span>
              <button className={styles.pageBtn} type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Вперёд →
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/** The configuration as the customer saw it — the rows Configurator.tsx's requestMeasure() sends. */
function MetadataSummary({ metadata }: { metadata: OrderMetadata }): JSX.Element {
  const rows = metadata.summary ?? [];
  if (!rows.length) {
    return <p className={styles.comment}>Конфигурация не сохранена вместе с заявкой.</p>;
  }
  return (
    <>
      {rows.map((r) => (
        <div className={styles.kv} key={r.label}>
          <span>{r.label}</span>
          <span>{r.value}</span>
        </div>
      ))}
    </>
  );
}

function OrderDetail({ id, token, onUnauthorized }: { id: string; token: string; onUnauthorized: () => void }): JSX.Element {
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [savingStatus, setSavingStatus] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Older orders (pre-dating the current inline base64 capture) stored an
  // `/uploads/...` file reference; that file may no longer exist on disk —
  // fail quietly instead of showing a broken-image icon.
  const [screenshotFailed, setScreenshotFailed] = useState(false);

  const reload = useCallback(() => {
    setOrder(undefined);
    setScreenshotFailed(false);
    adminFetch(`/api/orders/${encodeURIComponent(id)}`, token, onUnauthorized).then(async (res) => {
      if (!res) return;
      if (!res.ok) {
        setOrder(null);
        return;
      }
      const data = (await res.json().catch(() => null)) as { success?: boolean; order?: Order } | null;
      setOrder(data?.success && data.order ? data.order : null);
    });
  }, [id, token, onUnauthorized]);

  useEffect(reload, [reload]);

  usePageTitle(order ? `Заказ ${order.orderId}` : 'Заказ');

  async function changeStatus(next: OrderStatus): Promise<void> {
    if (!order) return;
    setSavingStatus(true);
    setActionError(null);
    const res = await adminFetch(`/api/orders/${order.id}/status`, token, onUnauthorized, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    setSavingStatus(false);
    if (!res || !res.ok) {
      setActionError('Не удалось изменить статус');
      return;
    }
    setOrder({ ...order, status: next });
  }

  async function cancelOrder(): Promise<void> {
    if (!order) return;
    setCancelling(true);
    setActionError(null);
    const res = await adminFetch(`/api/orders/${order.id}/cancel`, token, onUnauthorized, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Отменено администратором' }),
    });
    setCancelling(false);
    if (!res || !res.ok) {
      setActionError('Не удалось отменить заказ');
      return;
    }
    setOrder({ ...order, status: 'cancelled' });
  }

  if (order === undefined) {
    return (
      <div className={styles.body}>
        <div className={styles.empty}>Загрузка…</div>
      </div>
    );
  }
  if (order === null) {
    return (
      <div className={styles.body}>
        <div className={styles.empty}>Заказ не найден.</div>
        <button className={styles.pageBtn} type="button" onClick={() => navigate('/admin/orders')}>
          ← К списку заказов
        </button>
      </div>
    );
  }

  return (
    <div className={styles.body}>
      <div className={styles.detailHead}>
        <Link to="/admin/orders" className={styles.barLink}>
          ← К списку
        </Link>
        <h2>Заказ {order.orderId}</h2>
        <span className={`${styles.badge} ${styles[`badge-${order.status}`] ?? ''}`}>{STATUS_LABEL[order.status] ?? order.status}</span>
        <span style={{ flex: 1 }} />
        <span className={styles.count}>Создан: {formatDate(order.createdAt)}</span>
      </div>

      <div className={styles.card}>
        <span className={styles.cardTitle}>Статус</span>
        <div className={styles.statusRow}>
          <select
            className={styles.select}
            value={order.status}
            disabled={savingStatus}
            onChange={(e) => {
              if (isOrderStatus(e.target.value)) void changeStatus(e.target.value);
            }}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          {order.status !== 'cancelled' ? (
            <button className={styles.cancelBtn} type="button" disabled={cancelling} onClick={() => void cancelOrder()}>
              {cancelling ? 'Отмена…' : 'Отменить заказ'}
            </button>
          ) : null}
          {savingStatus ? <span className={styles.saveHint}>Сохранение…</span> : null}
          {actionError ? <span className={styles.errorText}>{actionError}</span> : null}
        </div>
      </div>

      <div className={styles.detailGrid}>
        <div className={styles.card}>
          <span className={styles.cardTitle}>Клиент</span>
          <div className={styles.kv}>
            <span>Имя</span>
            <span>{order.clientName}</span>
          </div>
          <div className={styles.kv}>
            <span>Телефон</span>
            <span>
              <a href={`tel:${order.clientPhone}`}>{order.clientPhone}</a>
            </span>
          </div>
          {order.clientEmail ? (
            <div className={styles.kv}>
              <span>Email</span>
              <span>
                <a href={`mailto:${order.clientEmail}`}>{order.clientEmail}</a>
              </span>
            </div>
          ) : null}
          {order.clientAddress ? (
            <div className={styles.kv}>
              <span>Адрес</span>
              <span>{order.clientAddress}</span>
            </div>
          ) : null}
          {order.comment ? (
            <>
              <span className={styles.cardTitle} style={{ marginTop: 8 }}>
                Комментарий
              </span>
              <p className={styles.comment}>{order.comment}</p>
            </>
          ) : null}
        </div>

        <div className={styles.card}>
          <span className={styles.cardTitle}>Балкон</span>
          <div className={styles.kv}>
            <span>Тип</span>
            <span>{order.balconyType}</span>
          </div>
          {order.balconySize > 0 ? (
            <div className={styles.kv}>
              <span>Площадь</span>
              <span>{order.balconySize} м²</span>
            </div>
          ) : null}
          <div className={styles.kv}>
            <span>Форма остекления</span>
            <span>{order.balconyShape}</span>
          </div>
          <span className={styles.cardTitle} style={{ marginTop: 8 }}>
            Конфигурация
          </span>
          <MetadataSummary metadata={order.metadata ?? {}} />
        </div>
      </div>

      {order.screenshot && !screenshotFailed ? (
        <div className={styles.card}>
          <span className={styles.cardTitle}>Превью балкона</span>
          <img
            className={styles.screenshot}
            src={order.screenshot}
            alt="Превью конфигурации балкона"
            onError={() => setScreenshotFailed(true)}
          />
        </div>
      ) : order.metadata?.scene2d ? (
        // No captured screenshot (older order, or the capture failed) — fall back to
        // re-rendering the saved configuration itself, read-only.
        <div className={styles.card}>
          <span className={styles.cardTitle}>Превью балкона (восстановлено из конфигурации)</span>
          <SavedConfigPreview scene2d={order.metadata.scene2d} fallback={<p className={styles.comment}>Не удалось восстановить превью — неизвестная или устаревшая конфигурация.</p>} />
        </div>
      ) : null}
    </div>
  );
}

