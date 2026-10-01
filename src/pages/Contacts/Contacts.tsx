/**
 * @file Contacts — contact details, a working callback form (posts to
 * /api/request-call) and an embedded Yandex map.
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowUpRight,
  Avito,
  Check,
  Clock,
  Instagram,
  MailIcon,
  MapPin,
  PhoneIcon,
  Telegram,
  Vk,
} from '../../components/icons';
import { PageHero } from '../../components/PageHero/PageHero';
import { COMPANY } from '../../data/site';
import { usePageTitle } from '../../lib/usePageTitle';
import styles from './Contacts.module.css';

type Status = 'idle' | 'sending' | 'success' | 'error';

function countDigits(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

const MAP_SRC =
  'https://yandex.ru/map-widget/v1/?ll=37.626789%2C55.616768&z=15&pt=37.626789,55.616768,pm2rdm';

/**
 * The contacts page.
 * @returns The page element.
 */
export function Contacts(): JSX.Element {
  usePageTitle('Контакты');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (countDigits(phone) < 10) {
      setError('Укажите корректный номер телефона');
      return;
    }
    setStatus('sending');
    setError('');
    try {
      const res = await fetch('/api/request-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || 'Клиент', phone: phone.trim(), message }),
      });
      const data: { success?: boolean; error?: string } = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setStatus('success');
        setName('');
        setPhone('');
        setMessage('');
      } else {
        setStatus('error');
        setError(data.error ?? 'Не удалось отправить заявку. Попробуйте ещё раз.');
      }
    } catch {
      setStatus('error');
      setError('Нет связи с сервером. Позвоните нам напрямую.');
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Контакты"
        title={
          <>
            Свяжитесь с&nbsp;<em>нами</em>
          </>
        }
        subtitle="Позвоните, напишите в мессенджер или оставьте заявку — ответим и подберём удобное время для бесплатного замера."
      />

      <section className={`container container--wide ${styles.main}`}>
        <div className={styles.infoCol}>
          <div className={styles.infoCard}>
            <a href={COMPANY.phonePrimary.href} className={styles.infoRow}>
              <span className={styles.infoIcon}>
                <PhoneIcon size={20} />
              </span>
              <span>
                <span className={styles.infoLabel}>Телефон</span>
                <strong>{COMPANY.phonePrimary.display}</strong>
                <em>{COMPANY.phoneSecondary.display}</em>
              </span>
            </a>
            <a href={COMPANY.email.href} className={styles.infoRow}>
              <span className={styles.infoIcon}>
                <MailIcon size={20} />
              </span>
              <span>
                <span className={styles.infoLabel}>Почта</span>
                <strong>{COMPANY.email.display}</strong>
              </span>
            </a>
            <div className={styles.infoRow}>
              <span className={styles.infoIcon}>
                <MapPin size={20} />
              </span>
              <span>
                <span className={styles.infoLabel}>Регион работы</span>
                <strong>{COMPANY.city}</strong>
                <em>{COMPANY.address}</em>
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoIcon}>
                <Clock size={20} />
              </span>
              <span>
                <span className={styles.infoLabel}>Часы работы</span>
                <strong>{COMPANY.hours}</strong>
              </span>
            </div>
          </div>

          <div className={styles.socials}>
            <span className={styles.socialsLabel}>Мы в соцсетях</span>
            <div className={styles.socialIcons}>
              <a href={COMPANY.social.instagram} aria-label="Instagram" target="_blank" rel="noopener noreferrer">
                <Instagram />
              </a>
              <a href={COMPANY.social.vk} aria-label="ВКонтакте" target="_blank" rel="noopener noreferrer">
                <Vk />
              </a>
              <a href={COMPANY.social.telegram} aria-label="Telegram" target="_blank" rel="noopener noreferrer">
                <Telegram />
              </a>
              <a href={COMPANY.social.avito} aria-label="Авито" target="_blank" rel="noopener noreferrer">
                <Avito />
              </a>
            </div>
          </div>
        </div>

        <div className={styles.formCard}>
          {status === 'success' ? (
            <div className={styles.success}>
              <span className={styles.successMark}>
                <Check size={30} />
              </span>
              <h2>Заявка отправлена</h2>
              <p>Спасибо! Мы перезвоним вам в ближайшее время.</p>
              <button className="btn btn--ghost" onClick={() => setStatus('idle')} type="button">
                Отправить ещё одну
              </button>
            </div>
          ) : (
            <>
              <h2 className={styles.formTitle}>Оставить заявку</h2>
              <p className={styles.formSub}>Перезвоним в течение 15 минут в рабочее время.</p>
              <form className={styles.form} onSubmit={handleSubmit} noValidate>
                <label className={styles.field}>
                  <span>Ваше имя</span>
                  <input
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
                <label className={styles.field}>
                  <span>Комментарий</span>
                  <textarea
                    className={styles.textarea}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Тип балкона, пожелания, удобное время для звонка"
                    rows={4}
                  />
                </label>
                {error ? <p className={styles.error}>{error}</p> : null}
                <button
                  className="btn btn--primary btn--lg"
                  type="submit"
                  disabled={status === 'sending'}
                >
                  {status === 'sending' ? 'Отправляем…' : 'Отправить заявку'}
                </button>
                <p className={styles.consent}>
                  Нажимая кнопку, вы соглашаетесь с{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer">
                    политикой конфиденциальности
                  </a>
                  .
                </p>
              </form>
            </>
          )}
        </div>
      </section>

      <section className={`container container--wide ${styles.mapWrap}`}>
        <div className={styles.mapCard}>
          {/* Stylised fallback shown behind the live map (graceful degradation
              if the Yandex widget is slow or blocked). */}
          <svg className={styles.mapFallback} viewBox="0 0 1200 460" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <rect width="1200" height="460" fill="#eae3d6" />
            <g stroke="#ddd3c0" strokeWidth="10" fill="none">
              <path d="M-20 120 H1220M-20 250 H1220M-20 360 H1220" />
              <path d="M180 -20 V480M430 -20 V480M720 -20 V480M980 -20 V480" />
            </g>
            <path d="M-20 60 L500 250 L760 200 L1220 420" stroke="#cdbf9f" strokeWidth="18" fill="none" />
            <g fill="#d8e0d2">
              <rect x="220" y="150" width="180" height="80" rx="8" />
              <rect x="760" y="270" width="170" height="70" rx="8" />
            </g>
            <circle cx="600" cy="250" r="60" fill="rgba(196,154,40,0.16)" />
          </svg>
          <span className={styles.mapPin} aria-hidden="true">
            <MapPin size={26} />
          </span>
          <iframe
            className={styles.map}
            src={MAP_SRC}
            title="Карта зоны работ БАЛКОН-МСК"
            loading="lazy"
            allowFullScreen
          />
          <a
            className={styles.mapBtn}
            href={COMPANY.mapHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            Открыть в Яндекс.Картах <ArrowUpRight size={16} />
          </a>
        </div>
      </section>
    </>
  );
}
