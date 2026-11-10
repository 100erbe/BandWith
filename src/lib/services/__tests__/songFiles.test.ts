import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: { storage: { from: vi.fn() } } }));

import { songFileContentType, validateSongFile } from '../songFiles';

const file = (name: string, type = '', size = 1024) => ({ name, type, size });

describe('songFileContentType', () => {
  it('keeps a type the bucket accepts', () => {
    expect(songFileContentType(file('a.mp3', 'audio/mpeg'))).toBe('audio/mpeg');
    expect(songFileContentType(file('a.m4a', 'audio/x-m4a'))).toBe('audio/x-m4a');
    expect(songFileContentType(file('chart.pdf', 'application/pdf'))).toBe('application/pdf');
  });

  it('derives the type from the extension when the file has none', () => {
    expect(songFileContentType(file('Take 1.MP3'))).toBe('audio/mpeg');
    expect(songFileContentType(file('demo.m4a'))).toBe('audio/x-m4a');
    expect(songFileContentType(file('demo.wav'))).toBe('audio/wav');
    expect(songFileContentType(file('demo.aif'))).toBe('audio/aiff');
    expect(songFileContentType(file('demo.flac'))).toBe('audio/flac');
    expect(songFileContentType(file('chart.jpg'))).toBe('image/jpeg');
    expect(songFileContentType(file('chart.HEIC'))).toBe('image/heic');
    expect(songFileContentType(file('chart.webp'))).toBe('image/webp');
  });

  it('falls back to the extension when the browser reports an odd type', () => {
    expect(songFileContentType(file('demo.wav', 'audio/vnd.wave'))).toBe('audio/wav');
    expect(songFileContentType(file('chart.jpg', 'image/jpg'))).toBe('image/jpeg');
  });

  it('rejects types the bucket does not accept', () => {
    expect(songFileContentType(file('loop.gif', 'image/gif'))).toBeNull();
    expect(songFileContentType(file('take.caf', 'audio/x-caf'))).toBeNull();
    expect(songFileContentType(file('noextension'))).toBeNull();
  });
});

describe('validateSongFile', () => {
  it('gives a clear error for an audio/image type the bucket refuses', () => {
    expect(validateSongFile(file('take.caf', 'audio/x-caf'))).toMatch(/not supported/);
    expect(validateSongFile(file('loop.gif', 'image/gif'))).toMatch(/not supported/);
  });

  it('accepts supported files with no reported type', () => {
    expect(validateSongFile(file('demo.m4a'))).toBeNull();
    expect(validateSongFile(file('chart.pdf'))).toBeNull();
  });
});
