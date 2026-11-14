import { describe, expect, it } from 'vitest';
import { setStatusBarTone, syncSystemBarsAppearance } from '../systemBars';

const metaColor = () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content');

describe('systemBars', () => {
  it('gives the tone underneath back when a layer closes (Stage mode over a gig hero)', async () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
    await syncSystemBarsAppearance('light');
    expect(metaColor()).toBe('#E5E3E0');

    const releaseHero = setStatusBarTone('dark');
    const releaseStage = setStatusBarTone('light');
    expect(metaColor()).toBe('#E5E3E0');
    releaseStage();
    // Back to the hero's tone, not the theme default.
    expect(metaColor()).toBe('#313131');
    releaseHero();
    expect(metaColor()).toBe('#E5E3E0');

    // Released out of order: the newest remaining override stays.
    const a = setStatusBarTone('dark');
    const b = setStatusBarTone('light');
    a();
    expect(metaColor()).toBe('#E5E3E0');
    b();
    meta.remove();
  });
});
