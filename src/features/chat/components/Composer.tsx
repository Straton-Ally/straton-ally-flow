import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type ComponentProps,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Paperclip, SendHorizontal, Smile, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatBytes, namesToTokens, QUICK_EMOJI } from '../format';
import type { DirectoryPerson } from '../types';
import { PersonAvatar } from './PersonAvatar';

/** Pseudo-person so "@assistant" shows up in mention suggestions. Never stored as a mention token. */
const ASSISTANT_PERSON: DirectoryPerson = {
  user_id: 'assistant',
  full_name: 'Assistant',
  email: 'assistant',
  avatar_url: null,
  designation: 'AI · summaries, tasks',
};

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MENTION_QUERY = /(^|\s)@([^\s@][^@\n]{0,30})?$/;

export interface ComposerSubmit {
  body: string;
  mentions: string[];
  files: File[];
}

interface ComposerProps {
  people: DirectoryPerson[];
  placeholder: string;
  onSubmit: (value: ComposerSubmit) => Promise<unknown> | void;
  initialText?: string;
  initialPicked?: DirectoryPerson[];
  allowFiles?: boolean;
  autoFocus?: boolean;
  onCancel?: () => void;
  submitLabel?: string;
  compact?: boolean;
}

export function Composer({
  people,
  placeholder,
  onSubmit,
  initialText = '',
  initialPicked = [],
  allowFiles = true,
  autoFocus = true,
  onCancel,
  submitLabel = 'Send',
  compact,
}: ComposerProps) {
  const [text, setText] = useState(initialText);
  const [files, setFiles] = useState<File[]>([]);
  const [picked, setPicked] = useState(() => new Map(initialPicked.map((p) => [p.user_id, p])));
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [text]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    const matches = people.filter((p) => p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().startsWith(q)).slice(0, 6);
    return 'assistant'.startsWith(q) ? [ASSISTANT_PERSON, ...matches].slice(0, 6) : matches;
  }, [mentionQuery, people]);

  const updateMentionQuery = (value: string, caret: number) => {
    const match = value.slice(0, caret).match(MENTION_QUERY);
    setMentionQuery(match ? match[2] ?? '' : null);
    setMentionIndex(0);
  };

  const insertAtCaret = (insert: string, replaceBack = 0) => {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? text.length;
    const next = text.slice(0, caret - replaceBack) + insert + text.slice(caret);
    setText(next);
    const pos = caret - replaceBack + insert.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  };

  const pickMention = (person: DirectoryPerson) => {
    const typed = (mentionQuery ?? '').length + 1; // include "@"
    if (person.user_id === ASSISTANT_PERSON.user_id) {
      insertAtCaret('@assistant ', typed);
      setMentionQuery(null);
      return;
    }
    insertAtCaret(`@${person.full_name} `, typed);
    setPicked((prev) => new Map(prev).set(person.user_id, person));
    setMentionQuery(null);
  };

  const addFiles = (list: FileList | File[]) => {
    const next: File[] = [];
    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`${file.name} is larger than 25 MB`);
        continue;
      }
      next.push(file);
    }
    setFiles((prev) => [...prev, ...next].slice(0, 10));
  };

  const submit = async () => {
    const trimmed = text.trim();
    if ((!trimmed && files.length === 0) || sending) return;
    const { body, mentions } = namesToTokens(trimmed, picked);
    const pendingFiles = files;
    setSending(true);
    // Clear immediately so sending feels instant; restore on failure.
    setText('');
    setFiles([]);
    try {
      await onSubmit({ body, mentions, files: pendingFiles });
      setPicked(new Map());
    } catch (error) {
      setText(trimmed);
      setFiles(pendingFiles);
      toast.error(error instanceof Error ? error.message : 'Message not sent');
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        setMentionIndex((i) => (i + delta + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        pickMention(suggestions[mentionIndex]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
    if (event.key === 'Escape' && onCancel) {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!allowFiles) return;
    if (event.clipboardData.files.length > 0) {
      event.preventDefault();
      addFiles(event.clipboardData.files);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!allowFiles) return;
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files);
  };

  const canSend = (text.trim().length > 0 || files.length > 0) && !sending;

  return (
    <div
      className={cn(
        'relative rounded-lg border border-border bg-card transition-colors focus-within:border-ring/60',
        dragging && 'border-primary bg-primary/5',
      )}
      onDragOver={(e) => {
        if (!allowFiles) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {suggestions.length > 0 ? (
        <div
          role="listbox"
          aria-label="Mention someone"
          className="absolute bottom-full left-2 z-20 mb-1 w-72 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md"
        >
          {suggestions.map((person, index) => (
            <button
              key={person.user_id}
              type="button"
              role="option"
              aria-selected={index === mentionIndex}
              onMouseDown={(e) => {
                e.preventDefault();
                pickMention(person);
              }}
              onMouseEnter={() => setMentionIndex(index)}
              className={cn(
                'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px]',
                index === mentionIndex && 'bg-accent text-accent-foreground',
              )}
            >
              <PersonAvatar person={person} assistant={person.user_id === ASSISTANT_PERSON.user_id} className="h-5 w-5 rounded" />
              <span className="truncate font-medium">{person.full_name}</span>
              <span className="ml-auto truncate text-[11px] text-muted-foreground">{person.designation}</span>
            </button>
          ))}
        </div>
      ) : null}

      {files.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-b border-border px-2 pb-2 pt-2">
          {files.map((file, index) => (
            <span
              key={`${file.name}-${index}`}
              className="flex max-w-[220px] items-center gap-1.5 rounded-md border border-border bg-muted/50 py-1 pl-2 pr-1 text-[12px]"
            >
              <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{file.name}</span>
              <span className="shrink-0 text-muted-foreground">{formatBytes(file.size)}</span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <textarea
        ref={textareaRef}
        value={text}
        rows={1}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          updateMentionQuery(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={() => setTimeout(() => setMentionQuery(null), 150)}
        className={cn(
          'block w-full resize-none bg-transparent px-3 text-[14px] leading-relaxed outline-none placeholder:text-muted-foreground',
          compact ? 'py-2' : 'py-2.5',
        )}
      />

      <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
        {allowFiles ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <ComposerIconButton label="Attach files" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-4 w-4" />
            </ComposerIconButton>
          </>
        ) : null}
        <Popover>
          <PopoverTrigger asChild>
            <ComposerIconButton label="Insert emoji">
              <Smile className="h-4 w-4" />
            </ComposerIconButton>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-auto p-1.5">
            <div className="grid grid-cols-6 gap-0.5">
              {QUICK_EMOJI.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertAtCaret(emoji)}
                  className="flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-muted"
                  aria-label={`Insert ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <span className="ml-2 hidden text-[11px] text-muted-foreground sm:inline">
          <kbd className="font-sans">Enter</kbd> to send · <kbd className="font-sans">Shift + Enter</kbd> for a new line
        </span>
        <div className="ml-auto flex items-center gap-1">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="h-7 rounded-md px-2.5 text-[12px] font-medium text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSend}
            aria-label={submitLabel}
            className={cn(
              'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors',
              canSend ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground',
            )}
          >
            {onCancel ? submitLabel : <SendHorizontal className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

const ComposerIconButton = forwardRef<HTMLButtonElement, { label: string; children: ReactNode } & ComponentProps<'button'>>(
  ({ label, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      {...props}
    >
      {children}
    </button>
  ),
);
ComposerIconButton.displayName = 'ComposerIconButton';
