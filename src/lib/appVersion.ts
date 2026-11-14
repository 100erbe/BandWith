import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * The installed app's version (iOS / Android, from the native project), or
 * null on the web where there is no single release number to show.
 */
let cached: string | null | undefined;

export async function getAppVersion(): Promise<string | null> {
  if (cached !== undefined) return cached;
  if (!Capacitor.isNativePlatform()) return (cached = null);
  try {
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    cached = info.version || null;
  } catch {
    cached = null;
  }
  return cached;
}

export function useAppVersion(): string | null {
  const [version, setVersion] = useState<string | null>(cached ?? null);
  useEffect(() => {
    let alive = true;
    void getAppVersion().then((v) => {
      if (alive) setVersion(v);
    });
    return () => {
      alive = false;
    };
  }, []);
  return version;
}
