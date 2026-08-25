import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Package } from 'lucide-react';
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

  useEffect(() => {
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
    fetchItems();
  }, [bandId]);

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
    <div className="fixed inset-0 z-50 bg-card flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-surface-inverse/5 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold">Inventory</h1>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <input
            type="text"
            placeholder="Search inventory..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2.5 pl-10 rounded-xl bg-surface-inverse/5 text-sm font-medium placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-foreground/10"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Category Filter */}
      <div className="overflow-x-auto pb-1 px-4 scrollbar-hide">
        <div className="flex gap-2 w-max">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all',
                selectedCategory === cat
                  ? 'bg-surface-inverse text-surface-inverse-foreground'
                  : 'bg-surface-inverse/5 text-foreground/60 hover:bg-surface-inverse/10'
              )}
            >
              {cat} {cat !== 'All' && categoryCounts[cat] ? `(${categoryCounts[cat]})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-foreground/30" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="w-12 h-12 text-foreground/20 mb-3" />
            <p className="text-sm font-bold text-foreground/40">No items found</p>
            <p className="text-xs text-foreground/30 mt-1">Add equipment to get started</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-surface-inverse/5 hover:bg-surface-inverse/5 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-surface-inverse/5 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-foreground/40" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{item.name}</p>
                <p className="text-xs font-medium text-foreground/40">{item.category} · Qty: {item.quantity}</p>
              </div>
              <div className={cn(
                'px-2 py-0.5 rounded-full text-xs font-bold',
                item.status === 'available' ? 'bg-success/10 text-success' :
                item.status === 'in_use' ? 'bg-accent-quote/10 text-accent-quote' :
                item.status === 'maintenance' ? 'bg-warning/10 text-warning' :
                'bg-destructive/10 text-destructive'
              )}>
                {STATUS_CONFIG[item.status]?.label || item.status}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default InventoryView;
