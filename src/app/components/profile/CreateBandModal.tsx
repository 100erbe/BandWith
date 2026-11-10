import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Users, Link, Check, Plus } from '@/app/components/icons';
import { HeaderAction, IconButton } from '@/app/components/bw/Screen';
import { RailCover } from '@/lib/railActions';
import { PillButton, PillField, Selector, FormError } from '@/app/components/bw/Form';
import { cn } from '@/app/components/ui/utils';
import { PeekingScrollContainer } from '@/app/components/ui/PeekingScrollContainer';
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
  { id: 'free', name: 'Free', description: '1 band', price: '€0' },
  { id: 'pro', name: 'Pro', description: 'coming soon', price: '€9.99/mo' },
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
        description: description.trim() || undefined,
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

  const initials = name?.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??';
  const planName = PLANS.find((p) => p.id === plan)?.name ?? 'Free';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bw-pane-detail fixed inset-0 z-[115] flex flex-col overflow-hidden bg-background text-foreground"
    >
      {/* Header (Figma: Band / Create band — Kicker + Outline close) */}
      <header className="px-4 shrink-0 bg-background" style={{ paddingTop: 'calc(var(--safe-top) + 8px)' }}>
        <div className="max-w-xl mx-auto w-full flex items-end gap-3">
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <p className="bw-label-sm text-muted-foreground">New entity · Start a band or project</p>
            <h2 className="bw-display-lg text-foreground">Create</h2>
          </div>
          <RailCover pane />
          <HeaderAction pane label="Close" icon={<X />} onClick={onClose} />
        </div>
      </header>

      <PeekingScrollContainer className="flex-1">
        <div className="px-4 pt-4 pb-6 max-w-xl mx-auto w-full flex flex-col gap-6">
          {/* Preview card */}
          <div className="p-5 rounded-[24px] bg-surface-inverse text-surface-inverse-foreground flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-accent text-accent-foreground flex items-center justify-center bw-h2 shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex flex-col gap-1">
              <h3 className="bw-h2 [overflow-wrap:anywhere]">{name || 'Band name'}</h3>
              <p className="bw-body-sm opacity-70 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 shrink-0" />
                {[genre, '1 member', planName].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>

          {error && <FormError>{error}</FormError>}

          <PillField
            label="Band name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. The Jazz Collective"
          />

          {/* Genre */}
          <fieldset className="flex flex-col gap-2">
            <legend className="bw-label-sm text-muted-foreground mb-2">Genre</legend>
            <div className="grid grid-cols-3 gap-2">
              {GENRES.map((g) => (
                <Selector
                  key={g}
                  selected={genre === g}
                  onClick={() => setGenre(genre === g ? '' : g)}
                  className={cn('justify-center', genre === g && 'bg-accent text-accent-foreground')}
                >
                  {g}
                </Selector>
              ))}
            </div>
          </fieldset>

          {/* Description */}
          <label className="flex flex-col gap-2 p-4 rounded-[24px] bg-field border border-border focus-within:border-foreground transition-colors">
            <span className="bw-label-xs text-muted-foreground">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us about your band…"
              rows={2}
              className="w-full bg-transparent bw-body-lg text-foreground placeholder:text-muted-foreground/60 outline-none resize-none"
            />
          </label>

          <PillField
            label="Website (optional)"
            type="url"
            icon={<Link className="w-5 h-5" />}
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://"
          />

          {/* Plan */}
          <fieldset className="flex flex-col gap-2">
            <legend className="bw-label-sm text-muted-foreground mb-2">Plan</legend>
            <div className="grid grid-cols-2 gap-3">
              {PLANS.map((p) => {
                const selected = plan === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setPlan(p.id)}
                    className={cn(
                      'p-4 rounded-[24px] text-left flex flex-col gap-2 active:scale-[0.98] transition-transform',
                      selected ? 'bg-accent text-accent-foreground' : 'bg-card border border-border text-foreground',
                    )}
                  >
                    <span className="bw-label-md">{p.name}</span>
                    <span className={cn('bw-body-sm', !selected && 'text-muted-foreground')}>
                      {p.price} · {p.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
      </PeekingScrollContainer>

      {/* Footer */}
      <div className="shrink-0 px-4 pt-3 bg-background" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
        <div className="max-w-xl mx-auto w-full">
          <PillButton
            onClick={handleCreate}
            disabled={!name.trim()}
            loading={saving}
            variant={success ? 'dark' : 'primary'}
            icon={success ? <Check className="w-[18px] h-[18px]" /> : <Plus className="w-[18px] h-[18px]" />}
          >
            {success ? 'Created' : 'Create band'}
          </PillButton>
        </div>
      </div>
    </motion.div>
  );
};

export default CreateBandModal;
