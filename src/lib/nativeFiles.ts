import { Capacitor } from '@capacitor/core';
import { t } from '@/lib/i18n';

export type FileShareResult = 'shared' | 'downloaded' | 'cancelled';

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Could not read the file'));
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });

const safeName = (name: string) => name.replace(/[^\w.\- ]+/g, '_').trim() || 'document';

const isCancel = (err: unknown) => {
  const e = err as { name?: string; message?: string } | undefined;
  return e?.name === 'AbortError' || /cancel|abort|dismiss/i.test(String(e?.message || ''));
};

/** Browser download through a temporary link (web only: WebViews ignore it). */
export const downloadBlobOnWeb = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName(fileName);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};

/**
 * Hands a generated file to the system share sheet.
 * - iOS / Android: writes it to the app cache and opens the native sheet
 *   (Save to Files, Mail with attachment, WhatsApp, AirDrop…).
 * - Web: Web Share with the file when supported, otherwise a download.
 * Resolves 'cancelled' when the user closes the sheet.
 */
export const shareFile = async (
  blob: Blob,
  fileName: string,
  opts: { title?: string; text?: string; dialogTitle?: string } = {}
): Promise<FileShareResult> => {
  const name = safeName(fileName);

  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const data = await blobToBase64(blob);
    const written = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache });
    try {
      await Share.share({
        title: opts.title,
        text: opts.text,
        files: [written.uri],
        dialogTitle: opts.dialogTitle || opts.title,
      });
      return 'shared';
    } catch (err) {
      if (isCancel(err)) return 'cancelled';
      throw err;
    }
  }

  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ title: opts.title, text: opts.text, files: [file] } as ShareData);
      return 'shared';
    } catch (err) {
      if (isCancel(err)) return 'cancelled';
      // Fall through to a plain download.
    }
  }
  downloadBlobOnWeb(blob, name);
  return 'downloaded';
};

/**
 * Saves a generated file on the device (the "Download" action, distinct from Share).
 * - iOS: app Documents folder, visible in Files › On My iPhone › BandWith.
 * - Android: the public Documents/BandWith folder.
 * - Web: a normal browser download.
 * Resolves where it went; falls back to the share sheet if the write fails.
 */
export const saveFile = async (
  blob: Blob,
  fileName: string
): Promise<{ result: 'saved' | 'downloaded' | FileShareResult; location?: string }> => {
  const name = safeName(fileName);
  if (!Capacitor.isNativePlatform()) {
    downloadBlobOnWeb(blob, name);
    return { result: 'downloaded' };
  }
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const data = await blobToBase64(blob);
  const isIOS = Capacitor.getPlatform() === 'ios';
  try {
    await Filesystem.writeFile({
      path: isIOS ? name : `BandWith/${name}`,
      data,
      directory: Directory.Documents,
      recursive: true,
    });
    return { result: 'saved', location: isIOS ? t('Files › BandWith') : t('Documents › BandWith') };
  } catch (err) {
    console.warn('[nativeFiles] Save failed, falling back to the share sheet:', err);
    return { result: await shareFile(blob, name, { dialogTitle: t('Save PDF') }) };
  }
};

/** Opens an external URL (wa.me, mailto:, https) outside the app on native. */
export const openExternal = async (url: string) => {
  if (Capacitor.isNativePlatform()) {
    // Capacitor hands target=_blank to the OS (UIApplication.open / an
    // Android intent), so wa.me opens WhatsApp and mailto: opens Mail.
    window.open(url, '_blank');
    return;
  }
  if (/^mailto:|^tel:|^sms:/i.test(url)) {
    window.location.href = url;
    return;
  }
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) window.location.href = url;
};

export type LinkShareResult = 'shared' | 'copied' | 'cancelled';

/**
 * Shares a link with a short message (the rider's web link). Native share
 * sheet on iOS / Android, Web Share in browsers that have it, otherwise the
 * link is copied to the clipboard.
 */
export const shareLink = async (url: string, opts: { title?: string; text?: string; dialogTitle?: string } = {}): Promise<LinkShareResult> => {
  if (Capacitor.isNativePlatform()) {
    const { Share } = await import('@capacitor/share');
    try {
      await Share.share({ title: opts.title, text: opts.text, url, dialogTitle: opts.dialogTitle || opts.title });
      return 'shared';
    } catch (err) {
      if (isCancel(err)) return 'cancelled';
      throw err;
    }
  }
  const nav = navigator as Navigator;
  if (nav.share) {
    try {
      await nav.share({ title: opts.title, text: opts.text, url });
      return 'shared';
    } catch (err) {
      if (isCancel(err)) return 'cancelled';
    }
  }
  await navigator.clipboard?.writeText(url);
  return 'copied';
};
