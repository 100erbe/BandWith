import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Package, Loader2, Plus, Minus, Trash2, Music, Mic, Link, Box, Sun, Briefcase } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { supabase } from '@/lib/supabase';
import { ScreenHeader, IconButton, SearchField, Card, BwSheet } from '@/app/components/bw/Screen';
import { PillButton, PillField, Selector } from '@/app/components/bw/Form';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  status: string;
  condition: string;
  notes: string | null;
  created_at: string;
}

interface InventoryViewProps {
  onBack: () => void;
  bandId: string;
}

const CATEGORIES = [
  'All',
  'Instruments',
  'Cables',
  'Stands',
  'Microphones',
  'Cases',
  'Lighting',
  'Other',
];

/** Figma "Status": a dot + Label/XS. */
const STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
  available: { label: 'Available', dot: 'bg-success' },
  in_use: { label: 'In use', dot: 'bg-warning' },
  maintenance: { label: 'Maintenance', dot: 'bg-destructive' },
  lost: { label: 'Lost', dot: 'bg-destructive' },
};

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

export const InventoryView: React.FC<InventoryViewProps> = ({ onBack, bandId }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Instruments');
  const [newItemQty, setNewItemQty] = useState(1);
  const [savingItem, setSavingItem] = useState(false);

  useEffect(() => {
    fetchItems();
  }, [bandId]);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('band_id', bandId)
        .order('name', { ascending: true });
      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || savingItem) return;
    setSavingItem(true);
    try {
      const { data, error } = await supabase
        .from('inventory')
        .insert({
          band_id: bandId,
          name: newItemName.trim(),
          category: newItemCategory,
          quantity: newItemQty,
          status: 'available',
          condition: 'good',
        })
        .select()
        .single();
      if (error) throw error;
      if (data) {
        setItems((prev) => [...prev, data]);
      }
      setNewItemName('');
      setNewItemQty(1);
      setShowAddModal(false);
    } catch (err) {
      console.error('Error adding inventory item:', err);
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await supabase.from('inventory').delete().eq('id', id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error('Error deleting inventory item:', err);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categoryCounts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-0 z-[70] bg-background text-foreground flex flex-col overflow-y-auto"
    >
      <ScreenHeader
        sticky
        onBack={onBack}
        backLabel="Go back"
        overline="Equipment & assets"
        title="Gear & inventory"
        actions={<IconButton label="Add equipment" variant="filled" icon={<Plus />} onClick={() => setShowAddModal(true)} />}
      />

      <div className="flex-1 flex flex-col gap-4 px-4 pt-4 max-w-2xl mx-auto w-full" style={{ paddingBottom: 'calc(var(--safe-bottom) + 40px)' }}>
        <SearchField value={searchQuery} onChange={setSearchQuery} label="Search equipment" placeholder="Search equipment, mics, cables…" />

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
                {cat}
              </Selector>
            );
          })}
        </div>

        {/* Inventory list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredItems.length === 0 ? (
          <Card className="items-center text-center py-10 gap-4">
            <Package className="w-10 h-10 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <h2 className="bw-h3">No equipment found</h2>
              <p className="bw-body-sm text-muted-foreground max-w-xs">Add items to keep track of your band's gear.</p>
            </div>
          </Card>
        ) : (
          <ul className="flex flex-col gap-4">
            {filteredItems.map((item) => {
              const status = STATUS_CONFIG[item.status];
              const Icon = CATEGORY_ICON[item.category] ?? Package;
              return (
                <li key={item.id} className="flex items-center gap-3 p-4 pr-2 rounded-[24px] bg-card text-card-foreground">
                  <span className="w-11 h-11 rounded-full bg-foreground/[0.08] flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </span>
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <p className="bw-label-md truncate">{item.name}</p>
                    <p className="bw-body-sm text-muted-foreground truncate">
                      {item.category} · qty {item.quantity}
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span className={cn('w-2 h-2 rounded-full', status?.dot ?? 'bg-muted-foreground')} aria-hidden />
                    <span className="bw-label-xs">{status?.label ?? item.status}</span>
                  </span>
                  <IconButton
                    label={`Delete ${item.name}`}
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 />}
                    className="text-muted-foreground"
                    onClick={() => handleDeleteItem(item.id)}
                  />
                </li>
              );
            })}
          </ul>
        )}

        {!loading && (
          <PillButton icon={<Plus className="w-[18px] h-[18px]" />} onClick={() => setShowAddModal(true)}>
            Add equipment
          </PillButton>
        )}
      </div>

      {/* Add item (Figma Sheet, Style=Dark) */}
      <BwSheet
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        overline="Gear & inventory"
        title="Add equipment"
        zIndex={80}
        footer={
          <PillButton type="submit" form="add-gear-form" loading={savingItem} disabled={!newItemName.trim()}>
            Save item
          </PillButton>
        }
      >
        <form id="add-gear-form" onSubmit={handleAddItem} className="flex flex-col gap-6">
          <PillField
            tone="sheet"
            label="Item name"
            required
            placeholder="Shure SM58, drum kit, DI box…"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
          />

          <fieldset className="flex flex-col gap-2">
            <legend className="bw-label-sm text-sheet-foreground/70 mb-2">Category</legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                <SheetChip key={c} selected={newItemCategory === c} onClick={() => setNewItemCategory(c)}>
                  {c}
                </SheetChip>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2">
            <label htmlFor="gear-qty" className="bw-label-sm text-sheet-foreground/70">
              Quantity
            </label>
            <div className="flex items-center gap-3">
              <IconButton
                label="Decrease quantity"
                variant="sheet"
                icon={<Minus />}
                onClick={() => setNewItemQty((q) => Math.max(1, q - 1))}
                disabled={newItemQty <= 1}
              />
              <input
                id="gear-qty"
                type="number"
                min="1"
                inputMode="numeric"
                value={newItemQty}
                onChange={(e) => setNewItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 h-[52px] rounded-full bg-white/10 border border-white/20 text-center bw-num text-sheet-foreground outline-none focus:border-2 focus:border-white [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <IconButton label="Increase quantity" variant="sheet" icon={<Plus />} onClick={() => setNewItemQty((q) => q + 1)} />
            </div>
          </div>
        </form>
      </BwSheet>
    </motion.div>
  );
};

export default InventoryView;
