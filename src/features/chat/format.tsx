import { Fragment, type ReactNode } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import type { ChannelSummary, DirectoryPerson } from './types';

export const MENTION_TOKEN = /<@([0-9a-f-]{36})>/g;
export const QUICK_EMOJI = ['👍', '❤️', '😂', '🎉', '👀', '🙏', '✅', '🔥', '😮', '😢', '💯', '🚀'];

/** Replace `<@uuid>` tokens with `@Name` for editing and plain previews. */
export function tokensToNames(body: string, byId: Map<string, DirectoryPerson>) {
  return body.replace(MENTION_TOKEN, (_m, id: string) => `@${byId.get(id)?.full_name ?? 'someone'}`);
}

/** Turn `@Full Name` back into `<@uuid>` for every person the composer picked. */
export function namesToTokens(text: string, picked: Map<string, DirectoryPerson>) {
  let body = text;
  const mentions: string[] = [];
  // longest names first so "@Ali Khan" wins over "@Ali"
  const people = [...picked.values()].sort((a, b) => b.full_name.length - a.full_name.length);
  for (const person of people) {
    const needle = `@${person.full_name}`;
    if (body.includes(needle)) {
      body = body.split(needle).join(`<@${person.user_id}>`);
      mentions.push(person.user_id);
    }
  }
  return { body, mentions };
}

export function channelLabel(channel: Pick<ChannelSummary, 'kind' | 'name' | 'dm_user_ids'>, byId: Map<string, DirectoryPerson>, meId?: string) {
  if (channel.kind !== 'dm') return channel.name ?? 'channel';
  const others = (channel.dm_user_ids ?? []).filter((id) => id !== meId);
  if (others.length === 0) return 'Just you';
  return others.map((id) => byId.get(id)?.full_name ?? 'Unknown').join(', ');
}

export function dayLabel(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE, d MMMM');
}

export function timeLabel(iso: string) {
  return format(new Date(iso), 'h:mm a');
}

export function formatBytes(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(~~[^~\n]+~~)|(?<![\w])_([^_\n]+)_(?![\w])|<@([0-9a-f-]{36})>|(https?:\/\/[^\s<]+[^\s<.,:;"')\]])/g;

function renderInline(text: string, byId: Map<string, DirectoryPerson>, meId: string | undefined, keyBase: string) {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const match of text.matchAll(INLINE)) {
    const start = match.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const key = `${keyBase}-${i++}`;
    const [whole, code, bold, strike, italic, mention, url] = match;
    if (code) {
      out.push(
        <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">
          {code.slice(1, -1)}
        </code>,
      );
    } else if (bold) {
      out.push(<strong key={key}>{bold.slice(2, -2)}</strong>);
    } else if (strike) {
      out.push(<s key={key}>{strike.slice(2, -2)}</s>);
    } else if (italic) {
      out.push(<em key={key}>{italic}</em>);
    } else if (mention) {
      const person = byId.get(mention);
      out.push(
        <span
          key={key}
          className={
            mention === meId
              ? 'rounded bg-amber-500/15 px-0.5 font-medium text-amber-700 dark:text-amber-300'
              : 'rounded bg-primary/10 px-0.5 font-medium text-primary'
          }
        >
          @{person?.full_name ?? 'someone'}
        </span>,
      );
    } else if (url) {
      out.push(
        <a key={key} href={url} target="_blank" rel="noreferrer noopener" className="text-primary underline-offset-2 hover:underline">
          {url}
        </a>,
      );
    } else {
      out.push(whole);
    }
    last = start + whole.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Markdown-lite: ``` blocks, `code`, **bold**, _italic_, ~~strike~~, > quotes, links, mentions. */
export function RichText({ body, byId, meId }: { body: string; byId: Map<string, DirectoryPerson>; meId?: string }) {
  const parts = body.split(/```(?:[a-z]*\n)?([\s\S]*?)```/g);
  return (
    <>
      {parts.map((part, index) => {
        if (index % 2 === 1) {
          return (
            <pre key={index} className="my-1 overflow-x-auto rounded-md border border-border bg-muted/60 p-2 font-mono text-[12px] leading-relaxed">
              {part.replace(/\n$/, '')}
            </pre>
          );
        }
        const lines = part.split('\n');
        return (
          <Fragment key={index}>
            {lines.map((line, li) => {
              const isQuote = line.startsWith('> ');
              const content = renderInline(isQuote ? line.slice(2) : line, byId, meId, `${index}-${li}`);
              const node = isQuote ? (
                <span className="block border-l-2 border-border pl-2 text-muted-foreground">{content}</span>
              ) : (
                content
              );
              return (
                <Fragment key={li}>
                  {node}
                  {li < lines.length - 1 && !isQuote ? <br /> : null}
                </Fragment>
              );
            })}
          </Fragment>
        );
      })}
    </>
  );
}
