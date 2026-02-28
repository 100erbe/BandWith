import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Search,
  Package,
  Tag,
  CheckCircle,
  AlertTriangle,
  MoreVertical,
  Edit2,
  Trash2,
  X,
  Loader2,
  Boxes,
  Wrench,
  MapPin,
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

const STATUS_CONFIG = {
  available: { label: 'Available', color: 'bg-green-500/10 text-green-600', icon: CheckCircle },
  in_use: { label: 'In Use', color: 'bg-blue-500/10 text-blue-600', icon: Package },
  maintenance: { label: 'Maintenance', color: 'bg-orange-500/10 text-orange-600', icon: AlertTriangle },
  lost: { label: 'Lost', color: 'bg-red-500/10 text-red-600', icon: AlertTriangle },
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
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
      className="fixed inset-0 z-[70] bg-[#E6E5E1] overflow-y-auto flex flex-col"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Header */}
      <div className="px-6 shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">Equipment</p>
            <h1 className="text-4xl font-black text-black tracking-tight uppercase">INVENTORY</h1>
            <p className="text-sm text-black/50 font-bold tracking-tight mt-1">{items.length} items total</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={openAddModal}
              className="w-12 h-12 rounded-full bg-[#D4FB46] flex items-center justify-center active:scale-95 transition-transform"
            >
              <Plus className="w-5 h-5 text-black" />
            </button>
            <button
              onClick={onBack}
              className="w-12 h-12 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-all"
            >
              <X className="w-6 h-6 text-black/50" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search inventory..."
            className="w-full h-12 pl-11 pr-4 rounded-2xl bg-white text-sm font-medium text-black placeholder:text-black/30 border border-black/5 focus:outline-none focus:border-black/20 transition-colors"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="px-5 py-3 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all",
                selectedCategory === cat
                  ? "bg-black text-white"
                  : "bg-white/60 text-black/50 hover:bg-white"
              )}
            >
              {cat}
              {categoryCounts[cat] > 0 && (
                <span className="ml-1.5 text-xs opacity-60">
                  {categoryCounts[cat]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 px-5 pb-20 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-black/40" />
          </div>
        ) : filteredItems.length === 0 && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="w-12 h-12 text-black/20 mb-3" />
            <p className="text-black/50 font-medium">No items found</p>
            <p className="text-black/40 text-sm">Add your first item to get started</p>
          </div>
        ) : (
          <>
            {/* Hero Card - Inventory Overview */}
            {items.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-6 p-6 bg-gradient-to-br from-[#1A1A1A] to-[#2A2A2E] rounded-[2rem] relative overflow-hidden shadow-xl"
              >
                {/* Decorative gradient */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4FB46]/10 rounded-full blur-3xl" />
                
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <span className="text-[#D4FB46] text-[10px] font-bold uppercase tracking-widest block mb-1">Equipment</span>
                      <div className="flex items-baseline gap-3">
                        <h3 className="text-4xl font-black text-white tracking-tighter">{stats.totalItems}</h3>
                        <span className="text-stone-500 text-lg font-medium">items</span>
                      </div>
                    </div>
                    <div className="w-14 h-14 bg-[#D4FB46] rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(212,251,70,0.3)]">
                      <Boxes className="w-7 h-7 text-[#1A1A1A]" />
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="bg-white/5 rounded-xl p-3 border border-white/10"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-[10px] font-bold text-stone-500 uppercase">Available</span>
                      </div>
                      <span className="text-xl font-black text-white">{stats.available}</span>
                    </motion.div>
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.25 }}
                      className="bg-white/5 rounded-xl p-3 border border-white/10"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Package className="w-4 h-4 text-blue-400" />
                        <span className="text-[10px] font-bold text-stone-500 uppercase">In Use</span>
                      </div>
                      <span className="text-xl font-black text-white">{stats.inUse}</span>
                    </motion.div>
                    {stats.maintenance > 0 && (
                      <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white/5 rounded-xl p-3 border border-white/10"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Wrench className="w-4 h-4 text-orange-400" />
                          <span className="text-[10px] font-bold text-stone-500 uppercase">Repair</span>
                        </div>
                        <span className="text-xl font-black text-white">{stats.maintenance}</span>
                      </motion.div>
                    )}
                  </div>

                  {/* Status Progress Bar */}
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 }}
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold text-stone-500 mb-2">
                      <span>STATUS OVERVIEW</span>
                      <span>{stats.totalQuantity} total units</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden flex">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(stats.available / stats.totalItems) * 100}%` }}
                        transition={{ delay: 0.4, duration: 0.5, ease: "easeOut" }}
                        className="bg-green-500 h-full"
                      />
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(stats.inUse / stats.totalItems) * 100}%` }}
                        transition={{ delay: 0.5, duration: 0.5, ease: "easeOut" }}
                        className="bg-blue-500 h-full"
                      />
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(stats.maintenance / stats.totalItems) * 100}%` }}
                        transition={{ delay: 0.6, duration: 0.5, ease: "easeOut" }}
                        className="bg-orange-500 h-full"
                      />
                    </div>
                    {stats.locations.length > 0 && (
                      <div className="flex items-center gap-2 mt-3 text-[10px] font-bold text-stone-500">
                        <MapPin className="w-3 h-3" />
                        {stats.locations.slice(0, 3).join(', ')}{stats.locations.length > 3 && ` +${stats.locations.length - 3}`}
                      </div>
                    )}
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* Items List Header */}
            {items.length > 0 && (
              <h4 className="text-[10px] font-bold text-black/40 uppercase tracking-widest mb-3 px-1">
                {filteredItems.length === 0 ? 'No matches' : `All Items (${filteredItems.length})`}
              </h4>
            )}

            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Search className="w-8 h-8 text-black/20 mb-2" />
                <p className="text-black/50 font-medium text-sm">No items match your filter</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item, index) => {
              const statusConfig = STATUS_CONFIG[item.status];
              const StatusIcon = statusConfig.icon;
              
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-2xl p-4 relative"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-black/5 flex items-center justify-center">
                      <Package className="w-5 h-5 text-black/50" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-black truncate">{item.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-black/40 flex items-center gap-1">
                              <Tag className="w-3 h-3" />
                              {item.category}
                            </span>
                            <span className="text-xs text-black/40">
                              × {item.quantity}
                            </span>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
                          className="p-2 -mr-2 -mt-1 rounded-lg hover:bg-black/5 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4 text-black/40" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mt-3">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1",
                          statusConfig.color
                        )}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig.label}
                        </span>
                        {item.location && (
                          <span className="text-xs text-black/40 truncate">
                            📍 {item.location}
                          </span>
                        )}
                      </div>

                      {item.notes && (
                        <p className="text-xs text-black/40 mt-2 line-clamp-1">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Context Menu */}
                  <AnimatePresence>
                    {menuOpenId === item.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute right-4 top-12 bg-white rounded-xl shadow-xl border border-black/5 overflow-hidden z-10"
                      >
                        <button
                          onClick={() => openEditModal(item)}
                          className="w-full px-4 py-3 flex items-center gap-3 text-sm font-medium text-black/70 hover:bg-white/80"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="w-full px-4 py-3 flex items-center gap-3 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
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
              className="px-6 pt-6 pb-4 flex-shrink-0"
              style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1">Inventory</p>
                  <h1 className="text-4xl font-black text-black tracking-tight">
                    {editingItem ? 'EDIT' : 'ADD ITEM'}
                  </h1>
                  <p className="text-sm text-black/50 mt-1">Track your equipment</p>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="w-12 h-12 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition-colors"
                >
                  <X className="w-5 h-5 text-black" />
                </button>
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
