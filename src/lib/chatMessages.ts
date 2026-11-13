import type { Message } from '@/lib/services/chats';

/** Messages per request; a full page means there may be older ones. */
export const CHAT_PAGE_SIZE = 50;

export type ChatKind = 'direct' | 'band' | 'event';

/** Stored chat types → the three the UI knows ("group" is a band chat). */
export const normalizeChatType = (type: string | null | undefined): ChatKind | null => {
  if (type === 'direct') return 'direct';
  if (type === 'band' || type === 'group') return 'band';
  if (type === 'event') return 'event';
  return null;
};

const isTemp = (m: Message) => m.id.startsWith('temp-');

const sameMessage = (a: Message, b: Message) =>
  a.id === b.id &&
  a.content === b.content &&
  a.edited === b.edited &&
  a.deleted === b.deleted &&
  a.created_at === b.created_at &&
  a.sender?.full_name === b.sender?.full_name &&
  a.sender?.avatar_url === b.sender?.avatar_url &&
  a.reply_to?.id === b.reply_to?.id;

const sameList = (a: Message[], b: Message[]) => a.length === b.length && a.every((m, i) => sameMessage(m, b[i]));

/**
 * Applies the latest page from the poll. Older messages the user loaded stay,
 * optimistic ones stay at the end (dropping a server copy with the same text,
 * as before), and an unchanged result returns `prev` itself so nothing
 * re-renders or scrolls.
 */
export const mergeLatestPage = (prev: Message[], page: Message[]): Message[] => {
  const optimistic = prev.filter(isTemp);
  const fromServer = page.filter((d) => !optimistic.some((o) => o.content === d.content));
  const pageIds = new Set(page.map((m) => m.id));
  const oldest = page[0]?.created_at;
  const older = oldest
    ? prev.filter((m) => !isTemp(m) && !pageIds.has(m.id) && m.created_at < oldest)
    : [];
  const next = [...older, ...fromServer, ...optimistic];
  return sameList(prev, next) ? prev : next;
};

/** Puts an older page in front of the list, skipping messages already there. */
export const prependOlder = (prev: Message[], olderPage: Message[]): Message[] => {
  const have = new Set(prev.map((m) => m.id));
  const fresh = olderPage.filter((m) => !have.has(m.id));
  return fresh.length ? [...fresh, ...prev] : prev;
};
