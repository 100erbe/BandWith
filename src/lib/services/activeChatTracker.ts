/**
 * Simple tracker to know which chat is currently open
 * This prevents notifications when user is already viewing the chat
 */

let activeChatId: string | null = null;

export const setActiveChat = (chatId: string | null) => {
  activeChatId = chatId;
  console.log('[ActiveChat] Set to:', chatId);
};

export const getActiveChat = (): string | null => {
  return activeChatId;
};

export const isChattingWith = (chatId: string): boolean => {
  return activeChatId === chatId;
};
