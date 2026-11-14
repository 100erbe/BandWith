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
 * The server copy of a message still being sent: new to the list, from the
 * same sender, same text. Each pending message hides at most one copy, so an
 * older "ok" already on screen stays while a new "ok" is on its way.
 */
const pendingCopies = (prev: Message[], incoming: Message[]): Set<string> => {
  const have = new Set(prev.map((m) => m.id));
  const pending = prev.filter(isTemp);
  const copies = new Set<string>();
  for (const d of incoming) {
    if (have.has(d.id)) continue;
    const i = pending.findIndex((o) => o.content === d.content && o.sender_id === d.sender_id);
    if (i === -1) continue;
    pending.splice(i, 1);
    copies.add(d.id);
  }
  return copies;
};

/**
 * Applies the latest page from the poll. Older messages the user loaded stay,
 * optimistic ones stay at the end (hiding only their own server copy until
 * the send completes), and an unchanged result returns `prev` itself so
 * nothing re-renders or scrolls.
 */
export const mergeLatestPage = (prev: Message[], page: Message[]): Message[] => {
  const optimistic = prev.filter(isTemp);
  const copies = pendingCopies(prev, page);
  const fromServer = page.filter((d) => !copies.has(d.id));
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

/**
 * A message from realtime. It replaces the pending bubble it is the copy of
 * (same sender and text); other pending bubbles stay at the end, so someone
 * else's message never makes yours vanish while it is being sent.
 */
export const appendIncoming = (prev: Message[], message: Message): Message[] => {
  if (prev.some((m) => m.id === message.id)) return prev;
  const i = prev.findIndex((m) => isTemp(m) && m.sender_id === message.sender_id && m.content === message.content);
  const rest = i === -1 ? prev : [...prev.slice(0, i), ...prev.slice(i + 1)];
  const settled = rest.filter((m) => !isTemp(m));
  return [...settled, message, ...rest.filter(isTemp)];
};

/** How far a message is dragged sideways (px) before it is answered (swipe to reply on touch). */
export const SWIPE_REPLY_PX = 56;

/** A mostly horizontal drag to the right, far enough: reply to that message. */
export const isReplySwipe = (dx: number, dy: number) => dx >= SWIPE_REPLY_PX && Math.abs(dy) < dx;
