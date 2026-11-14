/**
 * The public iReal Pro forum, to import chord charts by tapping their links.
 *
 * On iOS and Android the forum opens inside the app (IrealForumPlugin, see
 * ios/App/App/IrealForumPlugin.swift and the Android twin): a tap on an
 * irealb:// link comes back here instead of opening the iReal Pro app,
 * because phones and tablets don't offer "Copy Link" for those links. On the
 * web the forum opens in a new tab and the user pastes the link.
 *
 * Nothing is read, scraped or indexed from the forum: only the link the user
 * taps is passed back.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { openExternal } from './nativeFiles';

/** The forum's song and playlist boards. */
export const IREAL_FORUM_URL = 'https://forums.irealpro.com/';

interface IrealForumPlugin {
  /** Rejects when the forum can't be loaded (offline). */
  open(opts: { url: string; title?: string; closeLabel?: string; backLabel?: string }): Promise<{ link: string | null }>;
}

const IrealForum = registerPlugin<IrealForumPlugin>('IrealForum');

/** True where a tapped link can come back to the app (iOS and Android). */
export const canBrowseForumInApp = () => Capacitor.isNativePlatform();

/**
 * Opens the forum. In the app: resolves the irealb:// link the user tapped,
 * or null when they closed it. On the web: opens a new tab and resolves null.
 * Rejects when the forum can't be loaded. `labels`: the browser's buttons, for
 * screen readers in the app's language.
 */
export async function browseIrealForum(title?: string, labels?: { close: string; back: string }): Promise<string | null> {
  if (!canBrowseForumInApp()) {
    void openExternal(IREAL_FORUM_URL);
    return null;
  }
  const { link } = await IrealForum.open({ url: IREAL_FORUM_URL, title, closeLabel: labels?.close, backLabel: labels?.back });
  return link || null;
}
