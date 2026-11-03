import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Search, Package, Loader2, Plus, X, Trash2 } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { supabase } from '@/lib/supabase';

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

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  available: { label: 'Available', color: 'bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20' },
  in_use: { label: 'In Use', color: 'bg-primary/10 text-primary border border-primary/20' },
  maintenance: { label: 'Maintenance', color: 'bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20' },
  lost: { label: 'Lost', color: 'bg-[var(--destructive)]/10 text-[var(--destructive)] border border-[var(--destructive)]/20' },
};

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
      {/* Sticky Header */}
      <div
        className="px-4 shrink-0 border-b border-foreground/10 bg-background/95 backdrop-blur-md sticky top-0 z-30"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
          paddingBottom: '14px',
        }}
      >
        <div className="max-w-2xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              aria-label="Go back"
              className="w-10 h-10 rounded-full border border-foreground/20 bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center text-foreground transition-all active:scale-90 shrink-0"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                EQUIPMENT & ASSETS
              </span>
              <h1 className="text-[22px] font-black uppercase text-foreground leading-none">
                GEAR & INVENTORY
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs active:scale-95 transition-all shrink-0"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 flex-1 flex flex-col gap-5 max-w-2xl mx-auto w-full pb-32">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search equipment, mics, cables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 pl-10 rounded-[12px] bg-foreground/5 border border-foreground/10 text-sm font-medium text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary transition-colors"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
        </div>

        {/* Category Filter */}
        <div className="overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
          <div className="flex gap-2 w-max">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'px-3.5 py-1.5 rounded-[8px] text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border',
                  selectedCategory === cat
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-foreground/5 hover:bg-foreground/10 text-foreground/70 border-foreground/10'
                )}
              >
                {cat} {cat !== 'All' && categoryCounts[cat] ? `(${categoryCounts[cat]})` : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Inventory List */}
        <div className="flex flex-col gap-2.5">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-7 h-7 animate-spin text-foreground/30" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <div className="w-16 h-16 rounded-[16px] bg-foreground/5 flex items-center justify-center text-foreground/30">
                <Package className="w-8 h-8" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-bold text-foreground/50 uppercase tracking-wide">
                  No equipment found
                </p>
                <p className="text-xs text-foreground/30 uppercase">
                  Add items to keep track of your band's gear
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="mt-2 px-4 py-2 rounded-[12px] bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider shadow-xs active:scale-95 transition-all"
              >
                + Add Equipment
              </button>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 p-4 rounded-[16px] bg-card border border-foreground/10 hover:border-foreground/20 transition-all shadow-2xs"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-[12px] bg-foreground/5 flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-foreground/50" />
                  </div>
                  <div className="flex flex-col min-w-0 gap-0.5">
                    <p className="text-sm font-bold text-foreground uppercase truncate">
                      {item.name}
                    </p>
                    <span className="text-xs font-medium text-foreground/50 uppercase">
                      {item.category} · Qty: {item.quantity}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span
                    className={cn(
                      'px-2.5 py-0.5 rounded-[6px] text-[10px] font-bold uppercase tracking-wider',
                      STATUS_CONFIG[item.status]?.color || STATUS_CONFIG.available.color
                    )}
                  >
                    {STATUS_CONFIG[item.status]?.label || item.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id)}
                    className="w-8 h-8 rounded-[8px] hover:bg-[var(--destructive)]/10 text-foreground/40 hover:text-[var(--destructive)] flex items-center justify-center transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Item Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.form
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              onSubmit={handleAddItem}
              onClick={(e) => e.stopPropagation()}
              className="bg-background text-foreground rounded-t-[24px] sm:rounded-[20px] border border-foreground/10 p-6 w-full max-w-md flex flex-col gap-4 shadow-xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black uppercase text-foreground leading-none">
                  Add Gear / Equipment
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-8 h-8 rounded-full border border-foreground/20 flex items-center justify-center text-foreground hover:bg-foreground/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                  Item Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shure SM58, Drum Kit, DI Box..."
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-foreground/5 border border-foreground/10 text-sm font-bold text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                    Category
                  </label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-foreground/5 border border-foreground/10 text-xs font-bold text-foreground focus:outline-none"
                  >
                    {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c} className="bg-background text-foreground">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-foreground/5 border border-foreground/10 text-sm font-bold text-foreground focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-[12px] bg-foreground/5 text-xs font-bold uppercase tracking-wider text-foreground/70"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingItem}
                  className="px-5 py-2.5 rounded-[12px] bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider shadow-xs hover:opacity-95 disabled:opacity-50"
                >
                  {savingItem ? 'Saving...' : 'Save Item'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default InventoryView;
