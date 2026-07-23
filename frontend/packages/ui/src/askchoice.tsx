import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from './lib/cn';
import { Button, Input } from './controls';
import { Badge, Stack, Text } from './primitives';
import { useT } from './i18n';

// AskChoice renders a structured question an AI posed — a header, the question, and a set of
// clickable options — so the user answers by clicking inside the chat bubble rather than typing.
// It is the shared presentation for aigentic's "interactive" protocol (the model emits a question
// block; the server surfaces it as a typed shape). Modeled on Claude Code's AskUserQuestion.
//
// The user is never boxed in: an "answer in your own words" escape always sits below the options,
// because the model was told the answer set is a suggestion, not a cage. onAnswer receives a
// single human-readable string — exactly what the user would have typed — which the caller sends
// as the next turn.

export interface AskChoiceOption {
  label: string;
  description?: string;
}

export interface AskChoiceQuestion {
  /** Short topic label, shown as a chip. */
  header?: string;
  /** The question, in words. */
  question: string;
  options: AskChoiceOption[];
  /** Allow several options to be chosen together. */
  multiSelect?: boolean;
}

export interface AskChoiceProps {
  questions: AskChoiceQuestion[];
  /** Called with the composed answer when the user confirms a choice or types their own. */
  onAnswer: (text: string) => void;
  /** Freeze the control (a historical turn that was already answered): options render static. */
  disabled?: boolean;
  className?: string;
}

// composeAnswer turns the current selection into the text sent as the user's turn: just the chosen
// label(s) for a single question, or "Topic: choice" lines when several questions are batched, so
// the model can tell the answers apart.
function composeAnswer(questions: AskChoiceQuestion[], sel: number[][]): string {
  return questions
    .map((q, qi) => {
      const labels = (sel[qi] ?? []).map((oi) => q.options[oi]?.label).filter(Boolean);
      if (!labels.length) return '';
      const value = labels.join(', ');
      return questions.length > 1 ? `${q.header || q.question}: ${value}` : value;
    })
    .filter(Boolean)
    .join('\n');
}

export function AskChoice({ questions, onAnswer, disabled, className }: AskChoiceProps) {
  const t = useT();
  const [sel, setSel] = useState<number[][]>(() => questions.map(() => []));
  const [own, setOwn] = useState('');
  const [typing, setTyping] = useState(false);
  const optRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  // The common case — one single-select question — submits on click, no confirm step (Claude Code's
  // snappy feel). Multi-select or batched questions collect a selection first, then a Send button.
  const single = questions.length === 1 && !questions[0]?.multiSelect;
  const answer = useMemo(() => composeAnswer(questions, sel), [questions, sel]);
  const canSend = answer.trim().length > 0;

  function pick(qi: number, oi: number) {
    if (disabled) return;
    if (single) {
      onAnswer(questions[0].options[oi]?.label ?? '');
      return;
    }
    setSel((prev) => {
      const next = prev.map((a) => a.slice());
      if (questions[qi].multiSelect) {
        const at = next[qi].indexOf(oi);
        if (at >= 0) next[qi].splice(at, 1);
        else next[qi].push(oi);
      } else {
        next[qi] = next[qi][0] === oi ? [] : [oi];
      }
      return next;
    });
  }

  // Keyboard: arrow keys rove between options; Cmd/Ctrl+Enter submits the collected answer.
  function onOptKeyDown(e: KeyboardEvent<HTMLButtonElement>, qi: number, oi: number, count: number) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      optRefs.current.get(`${qi}:${(oi + step + count) % count}`)?.focus();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !single && canSend) {
      e.preventDefault();
      onAnswer(answer);
    }
  }

  function submitOwn() {
    const text = own.trim();
    if (text) onAnswer(text);
  }

  return (
    <Stack gap={3} className={cn('mt-2', className)}>
      {questions.map((q, qi) => (
        <Stack key={qi} gap={2}>
          <Stack direction="row" align="center" gap={2} wrap>
            {q.header && <Badge variant="accent">{q.header}</Badge>}
            <Text variant="subhead" className="font-medium">
              {q.question}
            </Text>
          </Stack>
          <div role={q.multiSelect ? 'group' : 'radiogroup'} className="flex flex-col gap-1.5">
            {q.options.map((o, oi) => {
              const selected = sel[qi]?.includes(oi) ?? false;
              return (
                <button
                  key={oi}
                  ref={(el) => {
                    optRefs.current.set(`${qi}:${oi}`, el);
                  }}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  onClick={() => pick(qi, oi)}
                  onKeyDown={(e) => onOptKeyDown(e, qi, oi, q.options.length)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors duration-fast',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                    selected ? 'border-accent bg-accent/10' : 'border-separator bg-surface-raised',
                    disabled ? 'cursor-default opacity-70' : 'hover:border-accent/60 hover:bg-fill/10',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                      selected ? 'border-accent bg-accent text-accent-fg' : 'border-separator',
                    )}
                  >
                    {selected && (
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <path d="m5 12 5 5 9-11" />
                      </svg>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-subhead text-text-primary">{o.label}</span>
                    {o.description && <span className="block text-caption text-text-secondary">{o.description}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </Stack>
      ))}

      {!disabled && (
        <Stack direction="row" gap={2} align="center" wrap>
          {!single && (
            <Button variant="primary" size="sm" disabled={!canSend} onClick={() => canSend && onAnswer(answer)}>
              {t('ask.send')}
            </Button>
          )}
          {typing ? (
            <Stack direction="row" gap={2} align="center" grow>
              <Input
                autoFocus
                value={own}
                onChange={(e) => setOwn(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitOwn();
                  }
                }}
                placeholder={t('ask.ownPlaceholder')}
                className="grow"
              />
              <Button variant="tinted" size="sm" disabled={!own.trim()} onClick={submitOwn}>
                {t('ask.send')}
              </Button>
            </Stack>
          ) : (
            <button
              type="button"
              onClick={() => setTyping(true)}
              className="text-caption text-text-tertiary underline-offset-2 hover:text-text-secondary hover:underline"
            >
              {t('ask.ownToggle')}
            </button>
          )}
        </Stack>
      )}
    </Stack>
  );
}
