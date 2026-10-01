/**
 * @file CallModal — accessible callback-request dialog (focus trap, Esc, backdrop).
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { COMPANY } from '../../data/site';
import { Check, CloseIcon, PhoneIcon } from '../icons';
import type { CallModalOptions } from './CallModalProvider';
import styles from './CallModal.module.css';

interface CallModalProps {
  readonly isOpen: boolean;
  readonly options: CallModalOptions;
  readonly onClose: () => void;
}

type Status = 'idle' | 'sending' | 'success' | 'error';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';

function countDigits(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

/**
 * The dialog. Renders nothing when closed.
 * @returns The modal element or `null`.
 */
export function CallModal({ isOpen, options, onClose }: CallModalProps): JSX.Element | null {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Reset transient state each time the modal opens.
  useEffect(() => {
    if (isOpen) {
      setStatus('idle');
      setError('');
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      document.body.classList.add('modal-open');
      const t = window.setTimeout(() => firstFieldRef.current?.focus(), 60);
      return () => {
        window.clearTimeout(t);
        document.body.classList.remove('modal-open');
        restoreFocusRef.current?.focus?.();
      };
    }
    return undefined;
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) {
        return;
      }
      const nodes = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (nodes.length === 0) {
        return;
      }
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (countDigits(phone) < 10) {
      setError('Укажите корректный номер телефона');
      return;
    }
    setStatus('sending');
    setError('');
    try {
      const endpoint = options.endpoint ?? '/api/request-call';
      const body = options.endpoint
        ? { clientName: name.trim() || 'Клиент', clientPhone: phone.trim(), ...options.payload }
        : { name: name.trim() || 'Клиент', phone: phone.trim() };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data: { success?: boolean; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (res.ok && data.success) {
        setStatus('success');
        setName('');
        setPhone('');
      } else {
        setStatus('error');
        setError(data.error ?? 'Не удалось отправить заявку. Попробуйте ещё раз.');
      }
    } catch {
      setStatus('error');
      setError('Нет связи с сервером. Позвоните нам напрямую.');
    }
  }

  if (!isOpen) {
    return null;
  }

  const title = options.title ?? 'Заказать звонок';
  const subtitle =
    options.subtitle ?? 'Оставьте номер — перезвоним за 15 минут и ответим на вопросы.';

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <button className={styles.close} onClick={onClose} aria-label="Закрыть" type="button">
          <CloseIcon size={20} />
        </button>

        {status === 'success' ? (
          <div className={styles.success}>
            <div className={styles.successMark}>
              <Check size={30} />
            </div>
            <h2 className={styles.title} id={titleId}>
              Заявка принята
            </h2>
            <p className={styles.subtitle}>
              Спасибо! Менеджер БАЛКОН-МСК перезвонит вам в ближайшее время.
            </p>
            <button className="btn btn--primary" onClick={onClose} type="button">
              Хорошо
            </button>
          </div>
        ) : (
          <>
            <span className={styles.badge}>
              <PhoneIcon size={15} /> Бесплатный замер
            </span>
            <h2 className={styles.title} id={titleId}>
              {title}
            </h2>
            <p className={styles.subtitle}>{subtitle}</p>

            {options.summary && options.summary.length > 0 ? (
              <dl className={styles.summary}>
                {options.summary.map((row) => (
                  <div className={styles.summaryRow} key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <label className={styles.field}>
                <span>Ваше имя</span>
                <input
                  ref={firstFieldRef}
                  className={styles.input}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Как к вам обращаться"
                  autoComplete="name"
                />
              </label>
              <label className={styles.field}>
                <span>Телефон *</span>
                <input
                  className={styles.input}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+7 (___) ___-__-__"
                  autoComplete="tel"
                  inputMode="tel"
                  required
                  aria-invalid={Boolean(error)}
                />
              </label>

              {error ? <p className={styles.error}>{error}</p> : null}

              <button
                className={`btn btn--primary ${styles.submit}`}
                type="submit"
                disabled={status === 'sending'}
              >
                {status === 'sending' ? 'Отправляем…' : 'Жду звонка'}
              </button>

              <p className={styles.consent}>
                Нажимая кнопку, вы соглашаетесь с{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer">
                  политикой конфиденциальности
                </a>
                .
              </p>
            </form>

            <a className={styles.directCall} href={COMPANY.phonePrimary.href}>
              <PhoneIcon size={16} /> Или позвоните: {COMPANY.phonePrimary.display}
            </a>
          </>
        )}
      </div>
    </div>
  );
}
