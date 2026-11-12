import React from 'react';
import { BrandMark } from '@/app/components/bw/BrandMark';
import { cn } from '@/app/components/ui/utils';
import { useT } from '@/lib/i18n';

/* ─────────────────────────────────────────────────────────────────────────
 * iPhone Duo, open (Figma "Duo · 01 Auth & Onboarding"): a BRAND page on the
 * leading page and the form on the trailing page. During onboarding the
 * brand page names every step instead of the progress pills, so you always
 * know how far you are; done steps stay visible.
 *
 * The brand page only shows on the open display (`data-bw-two-pane`, see
 * src/styles/duo-panes.css); everywhere else the wrappers are plain blocks
 * and the screens look as they always did.
 * ───────────────────────────────────────────────────────────────────────── */

/** Figma "Brand pane · Steps" (creator path). */
export const CREATOR_BRAND_STEPS = [
  'Create account',
  'Intent',
  'Name your band',
  'About you',
  'Invite bandmates',
  'Build your repertoire',
  'Ready to rock',
] as const;

/** Solo path: the same names, only the steps it goes through. */
export const SOLO_BRAND_STEPS = ['Create account', 'Intent', 'About you', 'Ready to rock'] as const;

export interface DuoAuthBrandProps {
  /** Named steps; omit for the plain brand page (sign-in, joiner). */
  steps?: readonly string[];
  /** 1-based current step. */
  current?: number;
}

/** Figma "Brand pane": black page, Logo/Mark 56, BANDWITH label, Display 44 headline, step list. */
export const DuoAuthBrand: React.FC<DuoAuthBrandProps> = ({ steps, current = 1 }) => {
  const t = useT();
  // Step names stay the keys passed in; only what is shown is translated.
  const stepLabel: Record<string, string> = {
    'Create account': t('Create account'),
    Intent: t('Intent'),
    'Name your band': t('Name your band'),
    'About you': t('About you'),
    'Invite bandmates': t('Invite bandmates'),
    'Build your repertoire': t('Build your repertoire'),
    'Ready to rock': t('Ready to rock'),
  };
  return (
  <aside className="bw-auth-brand select-none" aria-hidden="true">
    <BrandMark size={56} color="#fff" title="" />
    <p className="bw-label-md text-white mt-5">BandWith</p>
    <p className="bw-display-lg text-white mt-5">
      {steps ? (
        <>
          {t('Set up')}
          <br />
          {t('your band.')}
        </>
      ) : (
        <>
          {t('Run the')}
          <br />
          {t('band.')}
        </>
      )}
    </p>
    {steps && (
      <ol className="mt-[63px] flex flex-col gap-[10px]">
        {steps.map((label, i) => {
          const n = i + 1;
          const isCurrent = n === current;
          return (
            <li
              key={label}
              className={cn('flex items-center gap-[10px] h-[14px]', n < current ? 'opacity-75' : n > current ? 'opacity-40' : '')}
            >
              <span className={cn('w-2 h-2 rounded-full shrink-0', isCurrent ? 'bg-accent' : 'bg-white')} />
              <span className="bw-label-md text-white whitespace-pre">{`${n}  ${stepLabel[label] ?? label}`}</span>
            </li>
          );
        })}
      </ol>
    )}
  </aside>
  );
};

/**
 * Brand page + trailing page around an auth/onboarding screen. On the closed
 * display and on phones the wrappers add nothing.
 */
export const DuoAuthLayout: React.FC<
  DuoAuthBrandProps & {
    /** Changes with the screen shown: the trailing page starts at the top again. */
    screenKey?: string;
    children: React.ReactNode;
  }
> = ({ steps, current, screenKey, children }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [screenKey]);
  return (
    <>
      <DuoAuthBrand steps={steps} current={current} />
      <div className="bw-auth-trailing">
        <div ref={scrollRef} className="bw-auth-trailing-scroll">
          {children}
        </div>
      </div>
    </>
  );
};
