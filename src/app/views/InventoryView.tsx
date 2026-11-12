import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Package, Loader2, Plus, Minus, Trash2, Music, Mic, Link, Box, Sun, Briefcase, RefreshCw } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { ScreenHeader, IconButton, SearchField, Card, BwSheet } from '@/app/components/bw/Screen';
import { PillButton, PillField, Selector, FormError } from '@/app/components/bw/Form';
import {
  INVENTORY_CATEGORIES,
  canonicalCategory,
  createInventoryItem,
  deleteInventoryItem,
  listInventory,
  updateInventoryItem,
  type InventoryInput,
  type InventoryItem,
} from '@/lib/services/inventory';
import { useT } from '@/lib/i18n';

interface InventoryViewProps {
  onBack: () => void;
  bandId: string;
}

/** Figma "Gear / Inventory" tabs: All, Instruments, Cables, Microphones, Stands, Lighting — then Cases, Other. */
const CATEGORIES = ['All', ...INVENTORY_CATEGORIES];

/** Figma "Status": a dot + Label/XS. */
const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  available: { label: 'Available', dot: 'bg-success' },
  in_use: { label: 'In use', dot: 'bg-warning' },
  maintenance: { label: 'Maintenance', dot: 'bg-destructive' },
  lost: { label: 'Lost', dot: 'bg-destructive' },
};

const EDITABLE_STATUSES = ['available', 'in_use', 'maintenance'] as const;

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Instruments: Music,
  Microphones: Mic,
  Cables: Link,
  Stands: Box,
  Lighting: Sun,
  Cases: Briefcase,
};

/** Choice chip on the dark sheet (the shared Selector is built for light surfaces). */
const SheetChip: React.FC<{ selected: boolean; onClick: () => void; children: React.ReactNode }> = ({ selected, onClick, children }) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={onClick}
    className={cn(
      'inline-flex items-center h-9 px-4 rounded-full bw-label-sm whitespace-nowrap active:scale-[var(--press-scale,0.97)] transition-[transform,background-color]',
      selected ? 'bg-sheet-foreground text-sheet' : 'border border-sheet-foreground/30 text-sheet-foreground',
    )}
  >
    {children}
  </button>
);

const EMPTY_FORM: InventoryInput = {
  name: '',
  category: 'Instruments',
  quantity: 1,
  status: 'available',
  location: '',
  notes: '',
  serialNumber: '',
  purchaseDate: '',
  purchasePrice: '',
};

const formFromItem = (item: InventoryItem): InventoryInput => ({
  name: item.name ?? '',
  category: canonicalCategory(item.category),
  quantity: Number(item.quantity) || 0,
  status: item.status || 'available',
  location: item.location ?? '',
  notes: item.notes ?? '',
  serialNumber: item.serial_number ?? '',
  purchaseDate: item.purchase_date ?? '',
  purchasePrice: item.purchase_price != null && item.purchase_price !== '' ? String(item.purchase_price) : '',
});

export const InventoryView: React.FC<InventoryViewProps> = ({ onBack, bandId }) => {
  const t = useT();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Add / edit sheet: `editing` null = closed, 'new' = add, item = edit.
  const [editing, setEditing] = useState<InventoryItem | 'new' | null>(null);
  const [form, setForm] = useState<InventoryInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isNew = editing === 'new';
  // Display labels only; category ids and status values stay English (stored in the DB).
  const categoryLabel: Record<string, string> = {
    All: t('All'),
    Instruments: t('Instruments'),
    Cables: t('Cables'),
    Microphones: t('Microphones'),
    Stands: t('Stands'),
    Lighting: t('Lighting'),
    Cases: t('Cases'),
    Other: t('Other'),
  };
  const statusLabel: Record<string, string> = {
    available: t('Available'),
    in_use: t('In use'),
    maintenance: t('Maintenance'),
    lost: t('Lost'),
  };
  const set = <K extends keyof InventoryInput>(key: K, value: InventoryInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await listInventory(bandId);
    if (error) setLoadError(error.message);
    else setItems(data || []);
    setLoading(false);
  }, [bandId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setEditing('new');
  };

  const openEdit = (item: InventoryItem) => {
    setForm(formFromItem(item));
    setFormError(null);
    setEditing(item);
  };

  const closeSheet = () => {
    if (saving || deleting) return;
    setEditing(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || saving || !editing) return;
    setSaving(true);
    setFormError(null);
    const { data, error } = isNew ? await createInventoryItem(bandId, form) : await updateInventoryItem((editing as InventoryItem).id, form);
    setSaving(false);
    if (error || !data) {
      setFormError(error?.message || t('Could not save the item.'));
      return;
    }
    setItems((prev) => {
      const next = isNew ? [...prev, data] : prev.map((i) => (i.id === data.id ? data : i));
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
    setEditing(null);
  };

  const handleDeleteFromSheet = async () => {
    if (!editing || isNew || deleting) return;
    const item = editing as InventoryItem;
    setDeleting(true);
    setFormError(null);
    const { error } = await deleteInventoryItem(item.id);
    setDeleting(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setEditing(null);
  };

  const handleDeleteItem = async (item: InventoryItem) => {
    if (deletingId) return;
    setDeletingId(item.id);
    setListError(null);
    const { error } = await deleteInventoryItem(item.id);
    setDeletingId(null);
    if (error) {
      setListError(t("Couldn't delete {name}. {error}", { name: item.name, error: error.message }));
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || canonicalCategory(item.category) === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categoryCounts = items.reduce<Record<string, number>>((acc, item) => {
    const cat = canonicalCategory(item.category);
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const statusChoices = EDITABLE_STATUSES.includes(form.status as (typeof EDITABLE_STATUSES)[number])
    ? EDITABLE_STATUSES
    : [...EDITABLE_STATUSES, form.status];
  const minQty = isNew ? 1 : 0;
  const sheetField = 'w-full px-4 py-3.5 rounded-[24px] bg-white/10 border border-white/20 text-[18px] font-medium text-white placeholder:text-white/40 outline-none focus:border-2 focus:border-white resize-none';

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="bw-pane-hub fixed inset-0 z-[70] bg-background text-foreground flex flex-col overflow-y-auto"
    >
      <ScreenHeader
        sticky
        onBack={onBack}
        backLabel={t('Go back')}
        overline={t('Equipment & assets')}
        title={t('Gear & inventory')}
        actions={<IconButton label={t('Add equipment')} variant="filled" icon={<Plus />} onClick={openAdd} />}
      />

      <div className="flex-1 flex flex-col gap-4 px-4 pt-4 max-w-2xl mx-auto w-full" style={{ paddingBottom: 'calc(var(--safe-bottom) + 40px)' }}>
        <SearchField value={searchQuery} onChange={setSearchQuery} label={t('Search equipment')} placeholder={t('Search equipment, mics, cables…')} />

        {/* Category filter (Figma Selector MD, wrapping) */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const count = cat === 'All' ? items.length : categoryCounts[cat];
            return (
              <Selector
                key={cat}
                size="md"
                selected={selectedCategory === cat}
                onClick={() => setSelectedCategory(cat)}
                count={count ? count : undefined}
              >
                {categoryLabel[cat] ?? cat}
              </Selector>
            );
          })}
        </div>

        {listError && <FormError>{listError}</FormError>}

        {/* Inventory list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : loadError ? (
          <Card className="items-center text-center py-10 gap-4" role="alert">
            <Package className="w-10 h-10 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <h2 className="bw-h3">{t("Couldn't load your gear")}</h2>
              <p className="bw-body-sm text-muted-foreground max-w-xs [overflow-wrap:anywhere]">{loadError}</p>
            </div>
            <PillButton size="md" fullWidth={false} icon={<RefreshCw className="w-4 h-4" />} onClick={fetchItems}>
              {t('Try again')}
            </PillButton>
          </Card>
        ) : filteredItems.length === 0 ? (
          <Card className="items-center text-center py-10 gap-4">
            <Package className="w-10 h-10 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <h2 className="bw-h3">{t('No equipment found')}</h2>
              <p className="bw-body-sm text-muted-foreground max-w-xs">{t("Add items to keep track of your band's gear.")}</p>
            </div>
          </Card>
        ) : (
          <ul className="flex flex-col gap-4">
            {filteredItems.map((item) => {
              const status = STATUS_CONFIG[item.status];
              const category = canonicalCategory(item.category);
              const Icon = CATEGORY_ICON[category] ?? Package;
              return (
                <li key={item.id} className="relative flex items-center gap-3 p-4 pr-2 rounded-[24px] bg-card text-card-foreground">
                  <span className="w-11 h-11 rounded-full bg-foreground/[0.08] flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </span>
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    aria-label={t('Edit {name}', { name: item.name })}
                    className="flex-1 min-w-0 flex flex-col gap-1 text-left after:absolute after:inset-0 after:rounded-[24px] after:content-['']"
                  >
                    <span className="bw-label-md truncate">{item.name}</span>
                    <span className="bw-body-sm text-muted-foreground truncate">
                      {[categoryLabel[category] ?? category, t('qty {count}', { count: item.quantity }), item.location].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span className={cn('w-2 h-2 rounded-full', status?.dot ?? 'bg-muted-foreground')} aria-hidden />
                    <span className="bw-label-xs">{statusLabel[item.status] ?? item.status}</span>
                  </span>
                  <IconButton
                    label={t('Delete {name}', { name: item.name })}
                    variant="ghost"
                    size="sm"
                    icon={deletingId === item.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                    className="relative z-10 text-muted-foreground"
                    disabled={!!deletingId}
                    onClick={() => handleDeleteItem(item)}
                  />
                </li>
              );
            })}
          </ul>
        )}

        {!loading && !loadError && (
          <PillButton icon={<Plus className="w-[18px] h-[18px]" />} onClick={openAdd}>
            {t('Add equipment')}
          </PillButton>
        )}
      </div>

      {/* Add / edit item (Figma Sheet, Style=Dark) */}
      <BwSheet
        open={!!editing}
        onClose={closeSheet}
        overline={t('Gear & inventory')}
        title={isNew ? t('Add equipment') : t('Edit equipment')}
        zIndex={80}
        footer={
          <div className="flex flex-col gap-2">
            <PillButton type="submit" form="gear-form" loading={saving} disabled={!form.name.trim() || deleting}>
              {isNew ? t('Save item') : t('Save changes')}
            </PillButton>
            {!isNew && (
              <PillButton
                variant="ghost"
                className="text-destructive"
                icon={<Trash2 className="w-[18px] h-[18px]" />}
                loading={deleting}
                disabled={saving}
                onClick={handleDeleteFromSheet}
              >
                {t('Delete item')}
              </PillButton>
            )}
          </div>
        }
      >
        <form id="gear-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
          {formError && <FormError>{formError}</FormError>}

          <PillField
            tone="sheet"
            label={t('Item name', { context: 'inventory' })}
            required
            placeholder={t('Shure SM58, drum kit, DI box…')}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />

          <fieldset className="flex flex-col gap-2">
            <legend className="bw-label-sm text-sheet-foreground/70 mb-2">{t('Category')}</legend>
            <div className="flex flex-wrap gap-2">
              {INVENTORY_CATEGORIES.map((c) => (
                <SheetChip key={c} selected={form.category === c} onClick={() => set('category', c)}>
                  {categoryLabel[c] ?? c}
                </SheetChip>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="bw-label-sm text-sheet-foreground/70 mb-2">{t('Status')}</legend>
            <div className="flex flex-wrap gap-2">
              {statusChoices.map((s) => (
                <SheetChip key={s} selected={form.status === s} onClick={() => set('status', s)}>
                  {statusLabel[s] ?? s}
                </SheetChip>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2">
            <label htmlFor="gear-qty" className="bw-label-sm text-sheet-foreground/70">
              {t('Quantity')}
            </label>
            <div className="flex items-center gap-3">
              <IconButton
                label={t('Decrease quantity')}
                variant="sheet"
                icon={<Minus />}
                onClick={() => set('quantity', Math.max(minQty, form.quantity - 1))}
                disabled={form.quantity <= minQty}
              />
              <input
                id="gear-qty"
                type="number"
                min={minQty}
                inputMode="numeric"
                value={form.quantity}
                onChange={(e) => set('quantity', Math.max(minQty, parseInt(e.target.value) || minQty))}
                className="w-20 h-[52px] rounded-full bg-white/10 border border-white/20 text-center bw-num text-sheet-foreground outline-none focus:border-2 focus:border-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <IconButton label={t('Increase quantity')} variant="sheet" icon={<Plus />} onClick={() => set('quantity', form.quantity + 1)} />
            </div>
          </div>

          <PillField
            tone="sheet"
            label={t('Location / who has it')}
            placeholder={t("Rehearsal room, Alex's van…")}
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
          />
          <PillField
            tone="sheet"
            label={t('Serial number')}
            placeholder={t('Optional')}
            value={form.serialNumber}
            onChange={(e) => set('serialNumber', e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <PillField
              tone="sheet"
              label={t('Purchase date')}
              type="date"
              value={form.purchaseDate}
              onChange={(e) => set('purchaseDate', e.target.value)}
            />
            <PillField
              tone="sheet"
              label={t('Purchase price')}
              inputMode="decimal"
              placeholder="0.00"
              value={form.purchasePrice}
              onChange={(e) => set('purchasePrice', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="gear-notes" className="bw-label-sm text-sheet-foreground/70">
              {t('Notes')}
            </label>
            <textarea
              id="gear-notes"
              rows={3}
              placeholder={t('Condition, spare parts, who to ask…')}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              className={sheetField}
            />
          </div>
        </form>
      </BwSheet>
    </motion.div>
  );
};

export default InventoryView;
