import React from 'react';
import { createPortal } from 'react-dom';
import { useRailLayout } from '@/lib/deviceRegions';
import { motion } from 'motion/react';
import { Plus } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { Band } from '@/app/data/bands';
import { BwSheet, Tag } from '@/app/components/bw/Screen';
import { useT } from '@/lib/i18n';

interface SwitchBandPopupProps {
  isOpen: boolean;
  onClose: () => void;
  bands: Band[];
  selectedBand: Band;
  onSelectBand: (band: Band) => void;
  onAddNewBand: () => void;
}

/** Figma: Home / Switch band (dark sheet, lime row for the active band). */
export const SwitchBandPopup: React.FC<SwitchBandPopupProps> = ({
  isOpen,
  onClose,
  bands,
  selectedBand,
  onSelectBand,
  onAddNewBand,
}) => {
  // iPhone Duo open (Figma "Open · Home / Admin | Home / Switch band"): the
  // sheet opens on the trailing page next to the home. Creating a band moves
  // it to the leading page so the list stays in view while the new band is
  // set up on the right ("Open · Home / Switch band | Band / Create band").
  const { twoPane } = useRailLayout();
  const t = useT();
  const [docked, setDocked] = React.useState(false);
  React.useEffect(() => {
    if (!isOpen || !twoPane) setDocked(false);
  }, [isOpen, twoPane]);

  // Rendered at the top level: the home scroller it is declared in keeps
  // fixed layers on the leading page in iOS WebKit. Above a detail on the
  // trailing page (z 90), which it covers like the Figma frame.
  const sheet = (
    <BwSheet open={isOpen} onClose={onClose} zIndex={95} overline={t('Select band')} title={t('Your bands')} leading={docked}>
      <div className="flex flex-col gap-3 pb-2">
        <ul className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto">
          {bands.map((band) => {
            const isActive = selectedBand.id === band.id;
            const isAdmin = band.role === 'ADMIN';
            const initials =
              band.initials || band.name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

            return (
              <li key={band.id}>
                <motion.button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    onSelectBand(band);
                    onClose();
                  }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'w-full text-left p-4 rounded-[16px] flex items-center gap-3',
                    isActive ? 'bg-accent text-accent-foreground' : 'bg-sheet-foreground/[0.08] text-sheet-foreground',
                  )}
                >
                  <span className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center bw-h3 shrink-0">
                    {initials}
                  </span>
                  <span className="flex-1 min-w-0 flex flex-col gap-1">
                    <span className="flex items-center gap-1.5 bw-label-xs">
                      {!isAdmin && <span className="w-2 h-2 rounded-full bg-accent shrink-0" aria-hidden />}
                      {isAdmin ? t('Admin') : t('Member')}
                    </span>
                    <span className="bw-h3 truncate">{band.name}</span>
                    <span className={cn('bw-body-sm', !isActive && 'text-sheet-foreground/70')}>
                      {band.members === 1 ? t('{count} member', { count: band.members }) : t('{count} members', { count: band.members })}
                    </span>
                  </span>
                  {isActive && (
                    <Tag variant="subtle" className="bg-white text-black">
                      {t('Active')}
                    </Tag>
                  )}
                </motion.button>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => {
            onAddNewBand();
            if (twoPane) setDocked(true);
            else onClose();
          }}
          className="w-full h-[52px] rounded-full border-[1.5px] border-dashed border-sheet-foreground/70 flex items-center justify-center gap-2 text-sheet-foreground bw-button-md active:scale-[0.98] transition-transform"
        >
          <Plus className="w-[18px] h-[18px]" />
          {t('Create band')}
        </button>
      </div>
    </BwSheet>
  );
  return typeof document === 'undefined' ? sheet : createPortal(sheet, document.body);
};
