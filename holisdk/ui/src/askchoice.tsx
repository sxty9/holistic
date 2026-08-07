import { useState } from 'react';
import { cn } from './lib/cn';
import { Stack, Text } from './primitives';
import { Button } from './controls';
import { CheckIcon } from './icons';
import { useT } from './i18n';

// One selectable answer within a question: a short `label` (the value sent back on the wire) and an
// optional `description` that explains the choice. Mirrors the aigentic backend's Ask option shape,
// so the whole `ask.questions` payload drops straight into <AskChoice> with no reshaping.
export interface AskOption {
  label: string;
  description?: string;
}

// A structured question the assistant posed on an interactive turn: an optional `header` (a short
// grouping caption), the `question` prose itself, its selectable `options`, and whether more than
// one option may be picked (`multiSelect`). Mirrors the aigentic backend's Ask question shape.
export interface AskQuestion {
  header?: string;
  question: string;
  options: AskOption[];
  multiSelect?: boolean;
}

export interface AskChoiceProps {
  /** The question(s) to answer, rendered as clickable option cards (à la Claude Code). */
  questions: AskQuestion[];
  /** Called with the composed answer text once the user commits their pick(s): a lone single-select
   *  question answers immediately on click; a multi-select question, or several questions at once,
   *  commit together via the confirm button. */
  onAnswer: (answer: string) => void;
  /** Freeze the control — e.g. while a reply is pending, or once a later turn has superseded it. */
  disabled?: boolean;
}

// AskChoice turns a model's structured question into clickable options in the chat bubble, the way
// Claude Code offers a menu. It is stateless upward: it never sends on its own — it composes the
// picked option label(s) into a plain answer string and hands it to `onAnswer`, which the host
// (aigentic's ChatView) posts as the next user turn. The common case — one single-select question —
// answers on the first click; multi-select or several questions accumulate and commit together.
export function AskChoice({ questions, onAnswer, disabled }: AskChoiceProps) {
  const t = useT();
  // Selected option indices per question. A lone single-select question bypasses this and answers on
  // the first click; every other shape accumulates picks here until the user confirms.
  const [picks, setPicks] = useState<Record<number, number[]>>({});

  if (questions.length === 0) return null;

  // Quick-pick: a single single-select question commits the moment an option is clicked.
  const quick = questions.length === 1 && !questions[0].multiSelect;

  function toggle(qi: number, oi: number, multi: boolean) {
    setPicks((prev) => {
      const cur = prev[qi] ?? [];
      const has = cur.includes(oi);
      // multi-select toggles the option in/out; single-select replaces (or clears) the lone pick.
      const next = multi ? (has ? cur.filter((i) => i !== oi) : [...cur, oi]) : has ? [] : [oi];
      return { ...prev, [qi]: next };
    });
  }

  function labelsFor(qi: number): string[] {
    return (picks[qi] ?? []).map((oi) => questions[qi].options[oi]?.label).filter((l): l is string => !!l);
  }

  function commit() {
    // One question → just the picked label(s). Several at once → pair each answer with its question
    // text so the model can tell them apart when the transcript is replayed.
    const parts = questions.map((q, qi) => {
      const answer = labelsFor(qi).join(', ');
      return questions.length === 1 ? answer : `${q.question} ${answer}`;
    });
    onAnswer(parts.join('\n'));
  }

  const ready = questions.every((_, qi) => (picks[qi] ?? []).length > 0);

  return (
    <Stack gap={3} className="mt-1">
      {questions.map((q, qi) => (
        <Stack key={qi} gap={2}>
          {q.header && (
            <Text variant="caption" color="tertiary" weight="medium" className="uppercase tracking-wide">
              {q.header}
            </Text>
          )}
          <Text variant="subhead" color="secondary">
            {q.question}
          </Text>
          <Stack gap={2}>
            {q.options.map((opt, oi) => {
              const selected = (picks[qi] ?? []).includes(oi);
              return (
                <button
                  key={oi}
                  type="button"
                  disabled={disabled}
                  aria-pressed={quick ? undefined : selected}
                  onClick={() => (quick ? onAnswer(opt.label) : toggle(qi, oi, !!q.multiSelect))}
                  className={cn(
                    'flex w-full items-start gap-2.5 rounded-md border px-3 py-2 text-left transition-colors duration-fast',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                    'disabled:opacity-50 disabled:pointer-events-none',
                    selected ? 'border-accent bg-accent/10' : 'border-separator bg-surface-raised hover:bg-fill/10',
                  )}
                >
                  {q.multiSelect && (
                    <span
                      aria-hidden
                      className={cn(
                        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-fast',
                        selected ? 'border-accent bg-accent text-accent-fg' : 'border-separator',
                      )}
                    >
                      {selected && <CheckIcon className="h-3 w-3" />}
                    </span>
                  )}
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <Text variant="subhead" color={selected ? 'accent' : 'primary'}>
                      {opt.label}
                    </Text>
                    {opt.description && (
                      <Text variant="footnote" color="secondary">
                        {opt.description}
                      </Text>
                    )}
                  </span>
                </button>
              );
            })}
          </Stack>
        </Stack>
      ))}
      {!quick && (
        <Stack direction="row" justify="end">
          <Button variant="primary" size="sm" disabled={disabled || !ready} onClick={commit}>
            {t('ask.confirm')}
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
