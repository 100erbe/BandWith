/**
 * Whether an existing direct chat can be reused for a new DM between `a` and
 * `b`. A direct chat is between two people for good: reusing one that someone
 * else was ever in would show them that history (and add `b` to it).
 *
 * - participantIds: the rows in chat_participants now
 * - createdBy: chats.created_by
 * - writers: which of a / b wrote at least one message in it
 * - foreignWriter: someone other than a and b wrote in it
 *
 * A side whose participant row is gone (old hard deletes, or they removed
 * themselves) only counts when it is proven: they created the chat or wrote in it.
 */
export interface DirectChatFacts {
  participantIds: string[];
  createdBy?: string | null;
  writers: string[];
  foreignWriter: boolean;
}

export const isDirectChatBetween = (c: DirectChatFacts, a: string, b: string): boolean => {
  if (!a || !b || a === b || c.foreignWriter) return false;
  const pair = new Set([a, b]);
  const people = new Set([...c.participantIds, ...c.writers, ...(c.createdBy ? [c.createdBy] : [])]);
  for (const p of people) if (!pair.has(p)) return false;
  return people.has(a) && people.has(b);
};
