import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Package,
  MoreHorizontal,
  Edit2,
  Trash2,
  X,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { supabase } from '@/lib/supabase';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  status: 'available' | 'in_use' | 'maintenance' | 'lost';
  location?: string;
  notes?: string;
  band_id: string;
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

const STATUS_CONFIG: Record<string, { label: string }> = {
  available: { label: 'Available' },
  in_use: { label: 'In Use' },
  maintenance: { label: 'Maintenance' },
  lost: { label: 'Lost' },
};

export const InventoryView: React.FC<InventoryViewProps> = ({ onBack, bandId }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Instruments');
  const [formQuantity, setFormQuantity] = useState(1);
  const [formStatus, setFormStatus] = useState<InventoryItem['status']>('available');
  const [formLocation, setFormLocation] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadInventory();
  }, [bandId]);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('band_id', bandId)
        .order('name');

      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error('Error loading inventory:', err);
      // Show empty state if table doesn't exist
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats for hero card
  const stats = useMemo(() => {
    const available = items.filter(i => i.status === 'available').length;
    const inUse = items.filter(i => i.status === 'in_use').length;
    const maintenance = items.filter(i => i.status === 'maintenance').length;
    const lost = items.filter(i => i.status === 'lost').length;
    const totalQuantity = items.reduce((acc, i) => acc + (i.quantity || 1), 0);
    const categories = [...new Set(items.map(i => i.category))];
    const locations = [...new Set(items.map(i => i.location).filter(Boolean))];
    
    return {
      totalItems: items.length,
      totalQuantity,
      available,
      inUse,
      maintenance,
      lost,
      categories,
      locations
    };
  }, [items]);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const openAddModal = () => {
    setFormName('');
    setFormCategory('Instruments');
    setFormQuantity(1);
    setFormStatus('available');
    setFormLocation('');
    setFormNotes('');
    setEditingItem(null);
    setShowAddModal(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setFormName(item.name);
    setFormCategory(item.category);
    setFormQuantity(item.quantity);
    setFormStatus(item.status);
    setFormLocation(item.location || '');
    setFormNotes(item.notes || '');
    setEditingItem(item);
    setShowAddModal(true);
    setMenuOpenId(null);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);

    const itemData = {
      name: formName,
      category: formCategory,
      quantity: formQuantity,
      status: formStatus,
      location: formLocation || null,
      notes: formNotes || null,
      band_id: bandId,
    };

    try {
      if (editingItem) {
        // Update
        const { error } = await supabase
          .from('inventory')
          .update(itemData)
          .eq('id', editingItem.id);

        if (error) throw error;
        setItems(items.map(i => i.id === editingItem.id ? { ...i, ...itemData } : i));
      } else {
        // Create
        const { data, error } = await supabase
          .from('inventory')
          .insert(itemData)
          .select()
          .single();

        if (error) throw error;
        if (data) setItems([...items, data]);
      }
      setShowAddModal(false);
    } catch (err) {
      console.error('Error saving item:', err);
      // For demo, update local state
      if (editingItem) {
        setItems(items.map(i => i.id === editingItem.id ? { ...i, ...itemData } : i));
      } else {
        const newItem: InventoryItem = {
          ...itemData,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
        };
        setItems([...items, newItem]);
      }
      setShowAddModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Error deleting item:', err);
    }
    setItems(items.filter(i => i.id !== id));
    setMenuOpenId(null);
  };

  const getCategoryCounts = () => {
    const counts: Record<string, number> = { All: items.length };
    items.forEach(item => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    return counts;
  };

  const categoryCounts = getCategoryCounts();

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-0 z-[70] bg-[#E6E5E1] overflow-y-auto overflow-x-hidden flex flex-col"
      style={{ overscrollBehaviorX: 'none', touchAction: 'pan-y' }}
    >
      {/* Header */}
      <div className="px-4 shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}>
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="w-[50px] h-[50px] rounded-full flex items-center justify-center border-2 border-black shrink-0 active:scale-90 transition-transform"
            style={{ backgroundColor: 'rgba(216,216,216,0.2)' }}
          >
            <ArrowLeft className="w-[24px] h-[24px] text-black" />
          </button>
          <div className="flex flex-col leading-none flex-1">
            <span className="text-[32px] font-bold text-black leading-none">GEAR</span>
            <span className="text-[32px] font-bold text-black leading-none">LIST</span>
          </div>
          <button
            onClick={openAddModal}
            className="w-[50px] h-[50px] rounded-full flex items-center justify-center bg-[#D5FB46] shrink-0 active:scale-90 transition-transform"
          >
            <Plus className="w-[20px] h-[20px] text-black" />
          </button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search inventory..."
            className="w-full bg-transparent border-b-2 border-black/10 py-3 text-sm font-bold text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-colors"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="px-4 py-3 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase whitespace-nowrap transition-all",
                selectedCategory === cat
                  ? "bg-black text-white"
                  : "bg-black/5 text-black/40 active:bg-black/10"
              )}
            >
              {cat}
              {categoryCounts[cat] > 0 && (
                <span className="ml-1 opacity-60">
                  {categoryCounts[cat]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 px-4 pb-20 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-black/30" />
          </div>
        ) : filteredItems.length === 0 && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Package className="w-12 h-12 text-black/15 mb-3" />
            <span className="text-xs font-bold text-black/40 uppercase tracking-wide mb-1">No items found</span>
            <span className="text-[10px] font-medium text-black/30 uppercase">Add your first item to get started</span>
          </div>
        ) : (
          <>
            {/* Stats Row */}
            {items.length > 0 && (
              <div className="flex gap-5 mb-10">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="flex-1 flex flex-col gap-1 items-start">
                  <span className="text-xs font-bold text-black tracking-wide">TOTAL</span>
                  <span className="text-[42px] font-bold leading-tight text-black">{stats.totalItems}</span>
                  <span className="text-[10px] font-medium text-black/40 uppercase">{stats.totalQuantity} UNITS</span>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex-1 flex flex-col gap-1 items-start">
                  <span className="text-xs font-bold text-black tracking-wide">AVAILABLE</span>
                  <span className="text-[42px] font-bold leading-tight text-black">{stats.available}</span>
                  <span className="text-[10px] font-medium text-black/40 uppercase">READY TO USE</span>
                </motion.div>
              </div>
            )}

            {/* Section Title */}
            {items.length > 0 && (
              <div className="flex flex-col mb-5">
                <span className="text-[32px] font-bold leading-none text-black">ALL</span>
                <span className="text-[32px] font-bold leading-none text-black">ITEMS</span>
              </div>
            )}

            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <span className="text-[10px] font-medium text-black/40 uppercase">No items match your filter</span>
              </div>
            ) : (
              <div className="flex flex-col gap-0">
                {filteredItems.map((item, index) => {
              const statusConfig = STATUS_CONFIG[item.status];
              
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="relative"
                >
                  <div className="flex items-center justify-between py-4 border-b border-black/10">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-[10px] bg-[#CDCACA] flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-black/50" />
                      </div>
                      <div className="flex flex-col items-start min-w-0">
                        <span className="text-xs font-bold text-black uppercase tracking-wide truncate max-w-full">{item.name}</span>
                        <span className="text-[10px] font-medium text-black/40 uppercase">
                          {item.category} · ×{item.quantity} · {statusConfig.label}
                          {item.location ? ` · ${item.location}` : ''}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
                      className="w-8 h-8 flex items-center justify-center active:opacity-70 transition-opacity shrink-0"
                    >
                      <MoreHorizontal className="w-4 h-4 text-black" />
                    </button>
                  </div>

                  {/* Inline Action Menu */}
                  <AnimatePresence>
                    {menuOpenId === item.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden border-b border-black/10"
                      >
                        <div className="py-2 flex flex-col gap-0">
                          <button
                            onClick={() => openEditModal(item)}
                            className="flex items-center gap-3 py-3 px-2 active:opacity-70 transition-opacity"
                          >
                            <Edit2 className="w-4 h-4 text-black/40" />
                            <span className="text-xs font-bold text-black uppercase tracking-wide">EDIT</span>
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="flex items-center gap-3 py-3 px-2 active:opacity-70 transition-opacity"
                          >
                            <Trash2 className="w-4 h-4 text-[#A73131]" />
                            <span className="text-xs font-bold text-[#A73131] uppercase tracking-wide">DELETE</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Modal - Swiss Editorial Fullscreen */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#E6E5E1]"
          >
            {/* Header */}
            <div
              className="px-4 shrink-0"
              style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
            >
              <div className="flex items-center gap-4 mb-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-[50px] h-[50px] rounded-full flex items-center justify-center border-2 border-black shrink-0 active:scale-90 transition-transform"
                  style={{ backgroundColor: 'rgba(216,216,216,0.2)' }}
                >
                  <ArrowLeft className="w-[24px] h-[24px] text-black" />
                </button>
                <div className="flex flex-col leading-none">
                  <span className="text-[32px] font-bold text-black leading-none">
                    {editingItem ? 'EDIT' : 'ADD'}
                  </span>
                  <span className="text-[32px] font-bold text-black leading-none">ITEM</span>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 pb-32">
              <div className="space-y-8">
                {/* Name */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-3 block">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. SM58 Microphone"
                    className="w-full bg-transparent border-b-2 border-black/10 py-3 text-2xl font-bold text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-colors"
                  />
                </div>

                {/* Category & Quantity */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-3 block">
                      Category
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full bg-transparent border-b-2 border-black/10 py-3 text-lg font-bold text-black focus:outline-none focus:border-black transition-colors"
                    >
                      {CATEGORIES.filter(c => c !== 'All').map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-3 block">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={formQuantity}
                      onChange={(e) => setFormQuantity(parseInt(e.target.value) || 1)}
                      className="w-full bg-transparent border-b-2 border-black/10 py-3 text-lg font-bold text-black focus:outline-none focus:border-black transition-colors"
                    />
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-3 block">
                    Status
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(Object.keys(STATUS_CONFIG) as InventoryItem['status'][]).map(status => (
                      <button
                        key={status}
                        onClick={() => setFormStatus(status)}
                        className={cn(
                          "py-4 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all border-2",
                          formStatus === status
                            ? "bg-black border-black text-white"
                            : "bg-white/50 border-black/10 text-black/50 hover:bg-white"
                        )}
                      >
                        {STATUS_CONFIG[status].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-3 block">
                    Location (optional)
                  </label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="e.g. Studio A, Gig Bag"
                    className="w-full bg-transparent border-b-2 border-black/10 py-3 text-lg font-medium text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-colors"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-3 block">
                    Notes (optional)
                  </label>
                  <textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Any additional details..."
                    rows={3}
                    className="w-full bg-white/50 rounded-2xl p-4 text-base font-medium text-black placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-black resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div 
              className="fixed bottom-0 inset-x-0 bg-[#E6E5E1] border-t border-black/10 px-6 py-4"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
            >
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-4 bg-black/5 text-black rounded-full font-bold text-sm uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!formName.trim() || saving}
                  className="flex-[2] py-4 bg-black text-white rounded-full font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-all"
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Package className="w-4 h-4" />
                      {editingItem ? 'Save Changes' : 'Add Item'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default InventoryView;
