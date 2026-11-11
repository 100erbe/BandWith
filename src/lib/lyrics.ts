import { useSyncExternalStore } from 'react';

/**
 * Song lyrics (`songs.lyrics`): plain text, light Markdown or JSON, shown in
 * the in-app reader (LyricsViewer) instead of an external PDF.
 *
 * Markdown: `# Verse` / `[Chorus]` start a section, **bold**, *italic*,
 * blank lines separate stanzas.
 * JSON: ["line", …], { "lines": [...] }, { "lyrics": "…" },
 * { "sections": [{ "name": "Verse", "lines": [...] | "text": "…" }] }
 * or [{ "name": "Verse", "lines": [...] }].
 */

export interface LyricsSection {
  name: string | null;
  lines: string[];
}

const asLines = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map((x) => String(x ?? ''));
  if (typeof v === 'string') return v.split(/\r?\n/);
  return [];
};

const fromJson = (data: unknown): LyricsSection[] | null => {
  if (Array.isArray(data)) {
    if (data.every((x) => typeof x === 'string')) return [{ name: null, lines: data as string[] }];
    if (data.every((x) => x && typeof x === 'object')) {
      return data.map((s: any) => ({
        name: s.name ?? s.title ?? s.section ?? null,
        lines: asLines(s.lines ?? s.text ?? s.lyrics),
      }));
    }
    return null;
  }
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.sections)) return fromJson(o.sections);
    if (o.lines) return [{ name: null, lines: asLines(o.lines) }];
    if (typeof o.lyrics === 'string') return parseLyrics(o.lyrics);
    if (typeof o.text === 'string') return parseLyrics(o.text);
  }
  return null;
};

/** Lyrics text (Markdown or JSON) → sections of lines. */
export function parseLyrics(raw: string | null | undefined): LyricsSection[] {
  const text = (raw || '').trim();
  if (!text) return [];
  if (text[0] === '{' || text[0] === '[') {
    try {
      const parsed = fromJson(JSON.parse(text));
      if (parsed) return parsed.filter((s) => s.name || s.lines.some((l) => l.trim()));
    } catch {
      /* not JSON: "[Chorus]" etc. is read as Markdown below */
    }
  }
  const sections: LyricsSection[] = [];
  let cur: LyricsSection = { name: null, lines: [] };
  const push = () => {
    while (cur.lines.length && !cur.lines[cur.lines.length - 1].trim()) cur.lines.pop();
    if (cur.name || cur.lines.length) sections.push(cur);
  };
  for (const line of text.split(/\r?\n/)) {
    const h = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/) || line.match(/^\s*\[([^\]]{1,40})\]\s*$/);
    if (h) {
      push();
      cur = { name: h[1].trim(), lines: [] };
    } else if (line.trim() || cur.lines.length) {
      cur.lines.push(line.replace(/\s+$/, ''));
    }
  }
  push();
  return sections;
}

export type InlinePart = { text: string; bold?: boolean; italic?: boolean };

/** `**bold**`, `*italic*` / `_italic_` → parts (no HTML is ever produced). */
export function parseInline(line: string): InlinePart[] {
  const out: InlinePart[] = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push({ text: line.slice(last, m.index) });
    const t = m[0];
    if (t.startsWith('**') || t.startsWith('__')) out.push({ text: t.slice(2, -2), bold: true });
    else out.push({ text: t.slice(1, -1), italic: true });
    last = m.index + t.length;
  }
  if (last < line.length) out.push({ text: line.slice(last) });
  return out;
}

// ── Open the reader from anywhere (song menu, mini player) ──
export interface LyricsDoc {
  songId?: string;
  title: string;
  artist?: string | null;
  lyrics: string;
}

let current: LyricsDoc | null = null;
const listeners = new Set<() => void>();
export const openLyrics = (doc: LyricsDoc) => {
  current = doc;
  listeners.forEach((l) => l());
};
export const closeLyrics = () => {
  current = null;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useLyricsDoc = () => useSyncExternalStore(subscribe, () => current, () => current);
