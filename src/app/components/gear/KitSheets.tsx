/**
 * Kit sheets: create / edit a kit from the inventory, and "Use for a gig".
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2 } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { BwSheet, PillButton, PillField, FormError, SearchField } from '@/app/components/bw';
import type { InventoryItem } from '@/lib/services/inventory';
import type { GearKit, KitGig } from '@/lib/gearKits';
import { useT } from '@/lib/i18n';
import { GearStatus, gearCategoryLabel, kitGigDate } from './KitParts';

/* ───────────────────────────── Create / edit ──────────────────────────── */

export interface KitEditorValue {
  name: string;
  notes: string;
  itemIds: string[];
}

export const KitEditorSheet: React.FC<{
  open: boolean;
  kit: GearKit | null;
  initialItemIds: string[];
  inventory: InventoryItem[];
  saving: boolean;
  deleting?: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (value: KitEditorValue) => void;
  onDelete?: () => void;
}> = ({ open, kit, initialItemIds, inventory, saving, deleting, error, onClose, onSave, onDelete }) => {
  const t = useT();
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(kit?.name ?? '');
    setNotes(kit?.notes ?? '');
    setItemIds(initialItemIds);
    setQuery('');
    setConfirmDelete(false);
    // Reset only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kit?.id]);

  const selected = useMemo(() => new Set(itemIds), [itemIds]);
  const toggle = (id: string) => setItemIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const q = query.trim().toLowerCase();
  const shown = inventory.filter((i) => !q || i.name.toLowerCase().includes(q) || gearCategoryLabel(i.category).toLowerCase().includes(q));

  const busy = saving || !!deleting;
  const close = () => !busy && onClose();

  return (
    <BwSheet
      portal
      open={open}
      onClose={close}
      overline={t('Gear kit')}
      title={kit ? t('Edit kit') : t('New kit')}
      zIndex={110}
      footer={
        <div className="flex flex-col gap-2">
          <PillButton type="submit" form="kit-form" loading={saving} disabled={!name.trim() || busy}>
            {kit ? t('Save changes') : t('Create kit')}
          </PillButton>
          {kit && onDelete && (
            <PillButton variant="ghost" className="text-destructive" loading={deleting} disabled={saving} onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}>
              {confirmDelete ? t('Tap again to delete the kit') : t('Delete kit')}
            </PillButton>
          )}
        </div>
      }
    >
      <form
        id="kit-form"
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && name.trim()) onSave({ name, notes, itemIds });
        }}
      >
        {error && <FormError>{error}</FormError>}
        <PillField tone="sheet" label={t('Kit name')} required maxLength={80} placeholder={t('Club PA, acoustic duo…')} value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex flex-col gap-2">
          <label htmlFor="kit-notes" className="bw-label-sm text-sheet-foreground/70">
            {t('Notes')}
          </label>
          <textarea
            id="kit-notes"
            rows={2}
            maxLength={2000}
            placeholder={t('What it’s for, how it packs…')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-3.5 rounded-[24px] bg-white/10 border border-white/20 text-[18px] font-medium text-white placeholder:text-white/40 outline-none focus:border-2 focus:border-white resize-none"
          />
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="bw-label-sm text-sheet-foreground/70 mb-2 flex w-full">
            <span className="flex-1">{t('Items from your inventory')}</span>
            <span>{t('{count} selected', { count: itemIds.length })}</span>
          </legend>
          {inventory.length === 0 ? (
            <p className="bw-body-sm text-sheet-foreground/70">{t('Add items to your gear list first, then bundle them into a kit.')}</p>
          ) : (
            <>
              {inventory.length > 8 && <SearchField inline value={query} onChange={setQuery} label={t('Search items')} placeholder={t('Search items…')} className="bg-white/10 text-white" />}
              <ul className="flex flex-col rounded-[24px] bg-white/[0.06] px-4 divide-y divide-white/10">
                {shown.map((item) => {
                  const on = selected.has(item.id);
                  return (
                    <li key={item.id}>
                      <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(item.id)} className="w-full flex items-center gap-3 py-3 text-left">
                        <span className={cn('w-6 h-6 rounded-full border flex items-center justify-center shrink-0', on ? 'bg-accent border-accent text-accent-foreground' : 'border-white/40')}>
                          {on && <Check className="w-4 h-4" />}
                        </span>
                        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <span className="bw-body-md font-semibold leading-tight truncate">
                            {item.name}
                            {Number(item.quantity) > 1 && <span className="opacity-60 font-normal"> ×{item.quantity}</span>}
                          </span>
                          <span className="bw-label-xs opacity-60 truncate">{[gearCategoryLabel(item.category), item.location].filter(Boolean).join(' · ')}</span>
                        </span>
                        <GearStatus status={item.status} />
                      </button>
                    </li>
                  );
                })}
                {shown.length === 0 && <li className="py-4 bw-body-sm opacity-70">{t('No items match.')}</li>}
              </ul>
            </>
          )}
        </fieldset>
      </form>
    </BwSheet>
  );
};

/* ───────────────────────────── Use for a gig ──────────────────────────── */

export const UseKitSheet: React.FC<{
  open: boolean;
  kitName: string;
  gigs: KitGig[] | null;
  linkedIds: Set<string>;
  busyId: string | null;
  error: string | null;
  onClose: () => void;
  onToggle: (gig: KitGig) => void;
}> = ({ open, kitName, gigs, linkedIds, busyId, error, onClose, onToggle }) => {
  const t = useT();
  return (
    <BwSheet
      portal
      open={open}
      onClose={onClose}
      overline={kitName}
      title={t('Use for a gig')}
      zIndex={110}
      footer={<PillButton variant="white" onClick={onClose}>{t('Done')}</PillButton>}
    >
      <div className="flex flex-col gap-4">
        <p className="bw-body-sm text-sheet-foreground/70">{t('Every item in the kit goes with the band on that date.')}</p>
        {error && <FormError>{error}</FormError>}
        {gigs === null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin opacity-70" />
          </div>
        ) : gigs.length === 0 ? (
          <p className="bw-body-md">{t('No upcoming gigs yet.')}</p>
        ) : (
          <ul className="flex flex-col rounded-[24px] bg-white/[0.06] px-4 divide-y divide-white/10">
            {gigs.map((gig) => {
              const on = linkedIds.has(gig.id);
              return (
                <li key={gig.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    disabled={!!busyId}
                    onClick={() => onToggle(gig)}
                    className="w-full flex items-center gap-3 py-3 text-left disabled:opacity-60"
                  >
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                      <span className="bw-body-md font-semibold leading-tight truncate">{gig.title}</span>
                      <span className="bw-label-xs opacity-60">{kitGigDate(gig.date) || t('Date to be set')}</span>
                    </span>
                    {busyId === gig.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <span className={cn('h-8 px-3 rounded-full inline-flex items-center gap-1.5 bw-label-xs shrink-0', on ? 'bg-accent text-accent-foreground' : 'border border-white/40')}>
                        {on && <Check className="w-3.5 h-3.5" />}
                        {on ? t('Kit added') : t('Add kit')}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </BwSheet>
  );
};
