/**
 * @file ChatWidget — floating AI renovation advisor on every page.
 *
 * Sends the conversation + current page + live configurator state to
 * POST /api/ai-chat (Claude). The assistant replies in Russian and may return a
 * `config` patch (applied to the configurator scene in real time) and/or a `lead`
 * flag (opens the callback modal). Conversation persists in sessionStorage.
 */
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useCallModal } from '../CallModal/CallModalProvider';
import { useConfiguratorState } from '../../pages/Configurator/ConfiguratorContext';
import type { Dispatch } from 'react';
import type { Action, ConfigState } from '../../pages/Configurator/useConfigurator';
import { normalizeVamSelection, vamAutoPicks, vamChosen } from '../../pages/Configurator/vamCatalog';
import type { HotspotKind, VamSelection } from '../../pages/Configurator/vamCatalog';
import { Logo } from '../Header/Logo';
import styles from './ChatWidget.module.css';

interface ChatMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

/** The ids the assistant speaks in (must match AI_VALID in server/server.js). */
interface AiConfigPatch {
  layout?: string;
  wallFamily?: string;
  floorFamily?: string;
  glazing?: string;
  plintus?: string;
  lamp?: string;
}

const STORAGE_KEY = 'balkon-chat-v1';
const GREETING: ChatMessage = {
  role: 'assistant',
  content:
    'Здравствуйте! Я консультант STROY-BALKON. Помогу подобрать остекление и отделку и могу менять ваш балкон в конфигураторе. Чем помочь?',
};

/** Baseboard colour / lamp model ↔ the assistant's names (numbers are the app's picker order). */
const PLINTUS_BY_NAME: Readonly<Record<string, number | null>> = { none: null, white: 1, grey: 2, brown: 3 };
const LAMP_BY_NAME: Readonly<Record<string, number | null>> = {
  none: null,
  pendant: 1,
  flat: 2,
  cylinder: 3,
  loft: 4,
  'track-black': 5,
  'track-white': 6,
};

function nameOf(map: Readonly<Record<string, number | null>>, value: number | null): string {
  return Object.entries(map).find(([, v]) => v === value)?.[0] ?? 'none';
}

function pageLabel(pathname: string): string {
  if (pathname.startsWith('/configurator')) return 'Конфигуратор';
  if (pathname.startsWith('/services')) return 'Услуги';
  if (pathname.startsWith('/portfolio')) return 'Портфолио';
  if (pathname.startsWith('/about')) return 'О компании';
  if (pathname.startsWith('/contacts')) return 'Контакты';
  if (pathname.startsWith('/admin')) return 'Админ';
  return 'Главная';
}

/** The assistant says classic / panoramic; the app calls the glazings parapet / to the floor. */
const GLAZING_TO_AI: Readonly<Record<string, string>> = { parapet: 'classic', floor: 'panoramic' };
const GLAZING_FROM_AI: Readonly<Record<string, string>> = { classic: 'parapet', panoramic: 'floor' };

function stateToConfig(state: ConfigState): AiConfigPatch {
  const { vam } = state;
  const wall = vamChosen(vam, 'wall');
  const floor = vamChosen(vam, 'floor');
  return {
    layout: vam.shape,
    wallFamily: wall?.o ?? 'none',
    floorFamily: floor?.o ?? 'none',
    glazing: GLAZING_TO_AI[vam.glazing] ?? vam.glazing,
    plintus: nameOf(PLINTUS_BY_NAME, vamChosen(vam, 'plintus')?.k ?? null),
    lamp: nameOf(LAMP_BY_NAME, vamChosen(vam, 'light')?.k ?? null),
  };
}

/** Where each furniture id the assistant may add goes: tap-target kind, slot and option. */
const FURNITURE: Readonly<Record<string, { kind: HotspotKind; slot?: string; option?: string }>> = {
  'cabinet-low': { kind: 'cabinet', option: '0j' },
  'cabinet-2door': { kind: 'cabinet', option: '1j' },
  'cabinet-3door': { kind: 'cabinet', option: '2j' },
  'cabinet-4door': { kind: 'cabinet', option: '3j' },
  'bar-stool': { kind: 'decor', slot: 'chair' },
  dryer: { kind: 'decor', slot: 'dryer' },
  plant: { kind: 'decor', slot: 'flowers' },
};

/**
 * Apply an AI config patch (and an optional furniture add) as ONE scene update — the
 * catalogue normaliser then drops anything the chosen balcony doesn't have.
 */
function applyConfig(
  vam: VamSelection,
  patch: AiConfigPatch,
  addObject: string | null | undefined,
  dispatch: Dispatch<Action>,
): void {
  let next = normalizeVamSelection({
    ...vam,
    ...(patch.layout ? { shape: patch.layout } : {}),
    ...(patch.glazing ? { glazing: GLAZING_FROM_AI[patch.glazing] ?? patch.glazing } : {}),
  });
  const apply = (kinds: readonly HotspotKind[], option?: string, colorK?: number, slot?: string): void => {
    next = { ...next, picks: vamAutoPicks(next, kinds, option, colorK, slot) };
  };
  if (patch.wallFamily && patch.wallFamily !== 'none') apply(['wall', 'ceiling'], patch.wallFamily);
  if (patch.floorFamily && patch.floorFamily !== 'none') apply(['floor'], patch.floorFamily);
  if (patch.plintus && patch.plintus in PLINTUS_BY_NAME) {
    const k = PLINTUS_BY_NAME[patch.plintus];
    if (k !== null && k !== undefined) apply(['plintus'], undefined, k);
  }
  if (patch.lamp && patch.lamp in LAMP_BY_NAME) {
    const k = LAMP_BY_NAME[patch.lamp];
    if (k !== null && k !== undefined) apply(['light'], undefined, k);
  }
  const furniture = addObject ? FURNITURE[addObject] : undefined;
  if (furniture) apply([furniture.kind], furniture.option, undefined, furniture.slot);
  dispatch({ type: 'vam', value: next });
}

function loadMessages(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ChatMessage[];
      if (Array.isArray(parsed) && parsed.length) {
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  return [GREETING];
}

/**
 * The chat widget.
 * @returns The widget element.
 */
export function ChatWidget(): JSX.Element {
  const location = useLocation();
  const { state, dispatch } = useConfiguratorState();
  const { open: openLead } = useCallModal();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onConfigurator = location.pathname.startsWith('/configurator');

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* ignore */
    }
  }, [messages]);

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      const t = window.setTimeout(() => inputRef.current?.focus(), 80);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [open, messages, sending]);

  async function send(event: FormEvent): Promise<void> {
    event.preventDefault();
    const text = input.trim();
    if (!text || sending) {
      return;
    }
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: pageLabel(location.pathname),
          config: stateToConfig(state),
          messages: next,
        }),
      });
      const data: {
        success?: boolean;
        message?: string;
        config?: AiConfigPatch;
        addObject?: string | null;
        lead?: boolean;
        error?: string;
      } = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.message) {
        setMessages((m) => [...m, { role: 'assistant', content: data.message as string }]);
        if (data.config || data.addObject) {
          applyConfig(state.vam, data.config ?? {}, data.addObject, dispatch);
        }
        if (data.lead) {
          window.setTimeout(() => openLead({ source: 'ai-chat' }), 400);
        }
      } else {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content:
              data.error ??
              'Извините, не удаётся ответить прямо сейчас. Оставьте заявку — менеджер перезвонит.',
          },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: 'Нет связи с сервером. Позвоните нам или оставьте заявку.' },
      ]);
    } finally {
      setSending(false);
    }
  }

  function reset(): void {
    setMessages([GREETING]);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={`${styles.root} ${onConfigurator ? styles.lifted : ''}`}>
      {open ? (
        <div className={styles.panel} role="dialog" aria-label="Чат с консультантом">
          <header className={styles.head}>
            <span className={styles.headBrand}>
              <Logo compact />
              <span>
                <strong>Консультант</strong>
                <em>обычно отвечает сразу</em>
              </span>
            </span>
            <div className={styles.headActions}>
              <button className={styles.headBtn} onClick={reset} type="button">
                Сбросить
              </button>
              <button
                className={styles.headBtn}
                onClick={() => setOpen(false)}
                aria-label="Закрыть чат"
                type="button"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </header>

          <div className={styles.messages} ref={scrollRef}>
            {messages.map((m, i) => (
              <div
                key={i}
                className={`${styles.msg} ${m.role === 'user' ? styles.msgUser : styles.msgAi}`}
              >
                {m.role === 'assistant' ? (
                  <span className={styles.avatar} aria-hidden="true">
                    <Logo compact />
                  </span>
                ) : null}
                <p className={styles.bubble}>{m.content}</p>
              </div>
            ))}
            {sending ? (
              <div className={`${styles.msg} ${styles.msgAi}`}>
                <span className={styles.avatar} aria-hidden="true">
                  <Logo compact />
                </span>
                <p className={`${styles.bubble} ${styles.typing}`}>
                  <span />
                  <span />
                  <span />
                </p>
              </div>
            ) : null}
          </div>

          <form className={styles.inputRow} onSubmit={send}>
            <input
              ref={inputRef}
              className={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Спросите о балконе…"
              aria-label="Сообщение"
            />
            <button className={styles.sendBtn} type="submit" disabled={!input.trim() || sending} aria-label="Отправить">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12h15M13 6l6 6-6 6" />
              </svg>
            </button>
          </form>
        </div>
      ) : null}

      <button
        className={styles.fab}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Свернуть чат' : 'Открыть чат с консультантом'}
        aria-expanded={open}
        type="button"
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

