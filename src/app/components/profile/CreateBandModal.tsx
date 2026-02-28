import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  X,
  Music2,
  Users,
  Globe,
  Loader2,
  Check,
  Plus,
  Sparkles
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { createBand } from '@/lib/services/bands';
import { useBand } from '@/lib/BandContext';

interface CreateBandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBandCreated?: (bandId: string) => void;
}

const GENRES = [
  'Rock', 'Jazz', 'Pop', 'Blues', 'Country', 'Electronic',
  'Hip-Hop', 'R&B', 'Classical', 'Folk', 'Metal', 'Reggae',
  'Funk', 'Soul', 'Latin', 'World', 'Other'
];

const PLANS = [
  { id: 'free', name: 'Free', description: 'Basic features', price: '$0' },
  { id: 'pro', name: 'Pro', description: 'Advanced features', price: '$9.99/mo' },
];

export const CreateBandModal: React.FC<CreateBandModalProps> = ({
  isOpen,
  onClose,
  onBandCreated
}) => {
  const { refreshBands } = useBand();
  
  const [name, setName] = useState('');
  const [genre, setGenre] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [plan, setPlan] = useState('free');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Band name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data, error: createError } = await createBand({
        name: name.trim(),
        genre: genre || undefined,
        description: description.trim() || undefined,
        website: website.trim() || undefined,
        plan: plan as 'free' | 'pro' | 'enterprise',
      });

      if (createError) throw createError;

      setSuccess(true);
      
      // Refresh bands list
      await refreshBands();

      setTimeout(() => {
        if (data) {
          onBandCreated?.(data.id);
        }
        onClose();
        resetForm();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to create band');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName('');
    setGenre('');
    setDescription('');
    setWebsite('');
    setPlan('free');
    setSuccess(false);
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#E6E5E1]"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Header */}
      <div className="px-6 pt-8 pb-4 flex justify-between items-start shrink-0">
        <div>
          <span className="text-black/40 text-xs font-black uppercase tracking-[0.3em] mb-2 block">
            New Entity
          </span>
          <h2 className="text-4xl font-black text-black tracking-tighter uppercase leading-none">
            CREATE
          </h2>
          <p className="text-black/50 font-bold text-sm mt-1 tracking-tight">Start a new band or project</p>
        </div>
        
        <button 
          onClick={onClose}
          className="w-12 h-12 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-black/50 hover:text-black transition-all hover:rotate-90"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-32">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-600 text-sm font-medium">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Band Name */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-2 flex items-center gap-2">
              <Music2 className="w-4 h-4" />
              Band Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., The Jazz Collective"
              className="w-full bg-transparent border-b-2 border-black/10 py-3 text-2xl font-black text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-all"
            />
          </motion.div>

          {/* Genre */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-3">
              Genre
            </label>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <button
                  key={g}
                  onClick={() => setGenre(genre === g ? '' : g)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-bold uppercase transition-all",
                    genre === g
                      ? "bg-black text-white"
                      : "bg-white/50 text-black/60 hover:bg-white"
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Description */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us about your band..."
              rows={3}
              className="w-full bg-transparent border-b-2 border-black/10 py-3 text-base font-medium text-black placeholder:text-black/30 focus:outline-none focus:border-black transition-all min-h-[96px] resize-none"
            />
          </motion.div>

          {/* Website */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-2 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Website
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://yourband.com"
              className="w-full bg-transparent border-b-2 border-black/10 py-3 text-lg font-medium text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-all"
            />
          </motion.div>

          {/* Plan Selection */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Plan
            </label>
            <div className="grid grid-cols-2 gap-3">
              {PLANS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlan(p.id)}
                  className={cn(
                    "p-4 rounded-2xl border-2 transition-all text-left",
                    plan === p.id
                      ? "border-black bg-black text-white"
                      : "border-black/10 bg-white/50 text-black hover:border-black/30"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-black text-lg">{p.name}</span>
                    <span className={cn(
                      "text-sm font-bold",
                      plan === p.id ? "text-[#D4FB46]" : "text-black/50"
                    )}>{p.price}</span>
                  </div>
                  <p className={cn(
                    "text-sm",
                    plan === p.id ? "text-white/70" : "text-black/50"
                  )}>{p.description}</p>
                </button>
              ))}
            </div>
          </motion.div>

          {/* Preview Card */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="p-6 bg-[#1A1A1A] rounded-[2rem] text-white"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#D4FB46] mb-3">Preview</p>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#D4FB46] flex items-center justify-center text-black font-black text-xl">
                {name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??'}
              </div>
              <div>
                <h3 className="font-black text-xl">{name || 'Band Name'}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {genre && (
                    <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">{genre}</span>
                  )}
                  <span className="text-xs text-stone-500 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    1 member
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <div
        className="absolute bottom-0 left-0 right-0 px-6 pb-6 pt-4 bg-gradient-to-t from-[#E6E5E1] via-[#E6E5E1] to-transparent"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
      >
        <button
          onClick={handleCreate}
          disabled={!name.trim() || saving}
          className={cn(
            "w-full h-14 rounded-full font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98]",
            success
              ? "bg-green-500 text-white"
              : name.trim()
                ? "bg-black text-white hover:scale-[1.02]"
                : "bg-black/20 text-black/40 cursor-not-allowed"
          )}
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : success ? (
            <>
              <Check className="w-5 h-5" />
              Created!
            </>
          ) : (
            <>
              <Plus className="w-5 h-5" />
              Create Band
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};

export default CreateBandModal;
