import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Stack, Text, Spinner, Avatar, EmptyState } from '../primitives';
import { Button, IconButton, Textarea } from '../controls';
import { PlusIcon, TrashIcon, SendIcon } from '../icons';
import { ContextMenu, type MenuItem } from '../overlay/menu';
import { confirm } from '../overlay/confirm';
import { Markdown } from '../markdown';
import { useT } from '../i18n';
import { EnginePicker } from './EnginePicker';
import type { ChatAdapter, ChatEngine, ChatMessage, Conversation, EngineChoice } from './types';

export interface ChatProps {
  /** The host contract: where conversations, models and answers come from. */
  adapter: ChatAdapter;
  /** Controlled selected-conversation id (wire to the route for reload restore). Leave undefined
   *  to let the chat own selection internally. */
  activeId?: string | null;
  onActiveChange?: (id: string | null) => void;
  /** Uncontrolled reload-restore: persist the open conversation under this localStorage key so a
   *  page reload reopens the same one. Ignored when `activeId` is controlled. */
  persistKey?: string;
  /** Service-specific composer extras (kept OUT of the shared building block) — e.g. aigentic's
   *  file attach, presentr's document-pool indicator. */
  composerAccessory?: ReactNode;
  placeholder?: string;
  className?: string;
}

// A local, throwaway id for optimistic messages before the backend assigns real ones.
let tempSeq = 0;
const tempId = (p: string) => `tmp-${p}-${Date.now().toString(36)}-${tempSeq++}`;

/** Chat is the one conversational-AI surface for the whole landscape: a list of conversations on
 *  the left (switch / new / delete), the active transcript on the right, engine+model choice in
 *  the header, and a composer below. It stores nothing itself — the injected adapter owns the
 *  data — so history belongs to the user and a reload reopens the same conversation. */
export function Chat({ adapter, activeId, onActiveChange, persistKey, composerAccessory, placeholder, className }: ChatProps) {
  const t = useT();

  const [engines, setEngines] = useState<ChatEngine[]>([]);
  const [choice, setChoice] = useState<EngineChoice | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');

  // Selection: controlled by the host (activeId defined) or owned here, seeded from persisted state.
  const controlled = activeId !== undefined;
  const [internalId, setInternalId] = useState<string | null>(() => {
    if (activeId !== undefined) return activeId;
    if (persistKey && typeof localStorage !== 'undefined') return localStorage.getItem(persistKey);
    return null;
  });
  const active = controlled ? activeId ?? null : internalId;

  const selectConversation = useCallback(
    (id: string | null) => {
      if (!controlled) {
        setInternalId(id);
        if (persistKey && typeof localStorage !== 'undefined') {
          if (id) localStorage.setItem(persistKey, id);
          else localStorage.removeItem(persistKey);
        }
      }
      onActiveChange?.(id);
    },
    [controlled, persistKey, onActiveChange],
  );

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const modelLabel = useCallback(
    (c: EngineChoice | null): string | undefined => {
      if (!c) return undefined;
      return engines.find((e) => e.id === c.engineId)?.models.find((m) => m.id === c.modelId)?.label;
    },
    [engines],
  );

  // Load engines + conversations once. Restore-or-default the engine/model selection.
  useEffect(() => {
    let alive = true;
    Promise.resolve(adapter.engines()).then((es) => {
      if (!alive) return;
      setEngines(es);
      setChoice((prev) => prev ?? (es[0]?.models[0] ? { engineId: es[0].id, modelId: es[0].models[0].id } : null));
    });
    adapter
      .listConversations()
      .then((cs) => {
        if (!alive) return;
        setConversations(cs);
        // Drop a stale persisted selection that no longer exists so the empty state shows instead.
        if (active && !cs.some((c) => c.id === active)) selectConversation(null);
      })
      .finally(() => alive && setLoadingConvos(false));
    return () => {
      alive = false;
    };
    // Run once on mount; selectConversation/active are intentionally not deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter]);

  // Load the active conversation's messages (and adopt its stored engine/model) whenever it changes.
  useEffect(() => {
    if (!active) {
      setMessages([]);
      return;
    }
    let alive = true;
    setLoadingMsgs(true);
    adapter
      .loadMessages(active)
      .then((ms) => {
        if (!alive) return;
        setMessages(ms);
      })
      .finally(() => alive && setLoadingMsgs(false));
    const conv = conversations.find((c) => c.id === active);
    if (conv?.engineId && conv?.modelId) setChoice({ engineId: conv.engineId, modelId: conv.modelId });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, adapter]);

  // Keep the transcript pinned to the newest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const newConversation = useCallback(() => {
    selectConversation(null);
    setMessages([]);
    setInput('');
  }, [selectConversation]);

  const removeConversation = useCallback(
    async (id: string) => {
      const ok = await confirm({ title: t('chat.deleteConfirm'), danger: true, confirmLabel: t('common.delete') });
      if (!ok) return;
      await adapter.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (active === id) newConversation();
    },
    [adapter, active, newConversation, t],
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !choice) return;

    // Ensure a conversation exists: create one on the first turn, titled from the message.
    let convId = active;
    if (!convId) {
      const title = text.length > 40 ? `${text.slice(0, 40)}…` : text;
      const conv = await adapter.createConversation({ title, engineId: choice.engineId, modelId: choice.modelId });
      convId = conv.id;
      setConversations((prev) => [conv, ...prev]);
      selectConversation(conv.id);
    }

    const label = modelLabel(choice);
    const userMsg: ChatMessage = { id: tempId('u'), role: 'user', content: text, createdAt: Date.now() };
    const pendingId = tempId('a');
    setMessages((prev) => [...prev, userMsg, { id: pendingId, role: 'assistant', content: '', model: label }]);
    setInput('');
    setSending(true);

    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const reply = await adapter.send({
        conversationId: convId,
        text,
        engineId: choice.engineId,
        modelId: choice.modelId,
        signal: ac.signal,
        onToken: (chunk) =>
          setMessages((prev) => prev.map((m) => (m.id === pendingId ? { ...m, content: m.content + chunk } : m))),
      });
      setMessages((prev) => prev.map((m) => (m.id === pendingId ? { ...reply, model: reply.model ?? label } : m)));
      setConversations((prev) => {
        const hit = prev.find((c) => c.id === convId);
        if (!hit) return prev;
        return [{ ...hit, updatedAt: Date.now() }, ...prev.filter((c) => c.id !== convId)];
      });
    } catch (err) {
      if (ac.signal.aborted) {
        setMessages((prev) => prev.filter((m) => m.id !== pendingId));
      } else {
        setMessages((prev) => prev.map((m) => (m.id === pendingId ? { ...m, content: t('chat.errorReply') } : m)));
      }
    } finally {
      abortRef.current = null;
      setSending(false);
    }
  }, [input, sending, choice, active, adapter, selectConversation, modelLabel, t]);

  // Abort any in-flight turn on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  function onComposerKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  // Roving keyboard navigation across the conversation list (Up/Down to move focus).
  function onListKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-conv-item]'));
    const idx = items.indexOf(document.activeElement as HTMLElement);
    const nextIdx = e.key === 'ArrowDown' ? Math.min(items.length - 1, idx + 1) : Math.max(0, idx - 1);
    if (items[nextIdx]) {
      e.preventDefault();
      items[nextIdx].focus();
    }
  }

  const canSend = input.trim().length > 0 && !!choice && !sending;

  return (
    <div className={cn('flex h-full min-h-0 w-full overflow-hidden', className)}>
      {/* Conversation rail */}
      <div className="flex w-64 shrink-0 flex-col border-r border-separator bg-surface">
        <div className="p-2">
          <Button variant="secondary" size="sm" className="w-full" iconLeft={<PlusIcon className="h-4 w-4" />} onClick={newConversation}>
            {t('chat.newConversation')}
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" onKeyDown={onListKey}>
          {loadingConvos ? (
            <div className="flex justify-center py-6">
              <Spinner className="h-4 w-4" />
            </div>
          ) : conversations.length === 0 ? (
            <Text variant="footnote" color="tertiary" className="block px-2 py-4">
              {t('chat.noConversations')}
            </Text>
          ) : (
            <Stack gap={1}>
              {conversations.map((c) => {
                const menu: MenuItem[] = [
                  { id: 'delete', label: t('chat.deleteConversation'), icon: <TrashIcon className="h-4 w-4" />, danger: true, onSelect: () => void removeConversation(c.id) },
                ];
                return (
                  <ContextMenu key={c.id} items={menu}>
                    <button
                      type="button"
                      data-conv-item
                      onClick={() => selectConversation(c.id)}
                      className={cn(
                        'group flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors duration-fast',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                        c.id === active ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-fill/10',
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate text-subhead">{c.title || t('chat.untitled')}</span>
                      <span
                        role="button"
                        tabIndex={-1}
                        aria-label={t('chat.deleteConversation')}
                        title={t('chat.deleteConversation')}
                        onClick={(e) => {
                          e.stopPropagation();
                          void removeConversation(c.id);
                        }}
                        className="shrink-0 rounded p-0.5 text-text-tertiary opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  </ContextMenu>
                );
              })}
            </Stack>
          )}
        </div>
      </div>

      {/* Conversation surface */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-raised">
        <div className="flex items-center gap-2 border-b border-separator px-3 py-2">
          <EnginePicker engines={engines} value={choice} onChange={setChoice} disabled={sending} />
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loadingMsgs ? (
            <div className="flex justify-center py-8">
              <Spinner className="h-5 w-5" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <EmptyState title={t('chat.emptyTitle')} description={t('chat.emptyHint')} />
            </div>
          ) : (
            <Stack gap={4} className="mx-auto max-w-3xl">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} pending={sending && m.role === 'assistant' && m.content === ''} youLabel={t('chat.you')} />
              ))}
            </Stack>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-separator px-4 py-3">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            {composerAccessory}
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onComposerKey}
              rows={1}
              placeholder={placeholder ?? t('chat.placeholder')}
              className="min-h-11 max-h-40"
            />
            <IconButton label={t('chat.send')} variant="primary" onClick={() => void send()} disabled={!canSend}>
              {sending ? <Spinner className="h-4 w-4 text-current" /> : <SendIcon className="h-5 w-5" />}
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, pending, youLabel }: { message: ChatMessage; pending: boolean; youLabel: string }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <Avatar name={isUser ? youLabel : message.model || 'AI'} className="mt-0.5 shrink-0" />
      <div className={cn('flex min-w-0 flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
        {/* Every AI answer is stamped with the model that produced it. */}
        {!isUser && message.model && (
          <Text variant="caption" color="tertiary" weight="medium">
            {message.model}
          </Text>
        )}
        <div
          className={cn(
            'min-w-0 max-w-full rounded-xl px-3.5 py-2.5',
            // Prose wraps and breaks long words — never a single horizontally-scrolling line.
            'break-words [overflow-wrap:anywhere]',
            isUser ? 'bg-accent text-accent-fg' : 'bg-fill/10 text-text-primary',
          )}
        >
          {pending ? (
            <Spinner className="h-4 w-4" />
          ) : isUser ? (
            <Text className="whitespace-pre-wrap break-words">{message.content}</Text>
          ) : (
            <Markdown text={message.content} />
          )}
        </div>
      </div>
    </div>
  );
}
