import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Camera, Loader2, Check, ArrowLeft, Lock } from '@/app/components/icons';
import { IconButton, NavBackButton } from '@/app/components/bw/Screen';
import { PillButton, PillField, Selector, FormError } from '@/app/components/bw/Form';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
}

async function resizeImageToDataUrl(file: File, maxSize: number = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas unavailable'));

        // Center crop to square
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;

        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, maxSize, maxSize);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image file'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Primary instrument chips. Figma set first (Vocals, Guitar, Bass, Drums,
 * Keys, Sax), then the extra roles, Other last. `aliases` keep older stored
 * values selected: this modal used to save "Keyboard"/"Saxophone" and
 * onboarding saves lowercase ids ("keys", "saxophone", "guitar, vocals").
 */
const INSTRUMENT_OPTIONS: { value: string; aliases?: string[] }[] = [
  { value: 'Vocals', aliases: ['vocal', 'voice', 'singer'] },
  { value: 'Guitar' },
  { value: 'Bass' },
  { value: 'Drums' },
  { value: 'Keys', aliases: ['keyboard', 'keyboards'] },
  { value: 'Sax', aliases: ['saxophone'] },
  { value: 'Piano' },
  { value: 'Trumpet' },
  { value: 'Violin' },
  { value: 'Cello' },
  { value: 'DJ' },
  { value: 'Producer' },
  { value: 'Other' },
];

/** The chip matching a stored instrument (first match of a comma list). */
const instrumentOptionFor = (stored: string): string | null => {
  const parts = stored.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
  for (const part of parts) {
    const hit = INSTRUMENT_OPTIONS.find(
      (o) => o.value.toLowerCase() === part || o.aliases?.includes(part)
    );
    if (hit) return hit.value;
  }
  return null;
};

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  onProfileUpdated
}) => {
  const { user, profile, refreshProfile } = useAuth();
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [instrument, setInstrument] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Populate form with current profile data
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setInstrument(profile.instrument || '');
      setBio(profile.bio || '');
      setAvatarUrl(profile.avatar_url || null);
    }
  }, [profile]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.type && !['image/jpeg', 'image/png'].includes(file.type)) {
      setError('Use a JPG or PNG image');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError('Image must be smaller than 8MB');
      return;
    }

    setUploadingAvatar(true);
    setError(null);

    try {
      // 1. Generate optimized compact thumbnail (256x256 square)
      const optimizedDataUrl = await resizeImageToDataUrl(file, 256);
      let finalAvatarUrl = optimizedDataUrl;

      // 2. Try Supabase Storage ('avatars') if configured
      try {
        const ext = file.name.split('.').pop() || 'jpg';
        const filePath = `${user.id}/avatar.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, file, { upsert: true });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

          if (urlData?.publicUrl) {
            finalAvatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
          }
        } else {
          console.warn('[EditProfileModal] Supabase Storage upload note (using optimized thumbnail fallback):', uploadError.message);
        }
      } catch (storageErr) {
        console.warn('[EditProfileModal] Storage bucket unavailable, using optimized thumbnail fallback:', storageErr);
      }

      // 3. Persist the avatar URL in profiles table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: finalAvatarUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(finalAvatarUrl);
      if (refreshProfile) await refreshProfile();
      if (onProfileUpdated) onProfileUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to upload photo');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!user || saving) return;
    
    setSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          instrument: instrument.trim() || null,
          bio: bio.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setSuccess(true);
      
      if (refreshProfile) {
        await refreshProfile();
      }
      
      setTimeout(() => {
        onProfileUpdated?.();
        onClose();
        setSuccess(false);
      }, 800);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };


  if (!isOpen) return null;

  const selectedInstrument = instrumentOptionFor(instrument);

  const initials =
    fullName?.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() ||
    user?.email?.slice(0, 2).toUpperCase() ||
    'U';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="bw-pane-detail fixed inset-0 z-[100] flex flex-col overflow-hidden bg-background text-foreground"
      >
        {/* ═══ HEADER (Figma: Identity / Edit profile — back + H2 title) ═══ */}
        <header className="px-4 shrink-0 bg-background" style={{ paddingTop: 'calc(var(--safe-top) + 8px)' }}>
          <div className="max-w-xl mx-auto w-full flex items-center gap-3 min-h-11">
            <NavBackButton label="Go back" onClick={onClose} />
            <h2 className="bw-h2 text-foreground truncate">Edit profile</h2>
          </div>
        </header>

        {/* ═══ CONTENT ═══ */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-6 pb-6 max-w-xl mx-auto w-full flex flex-col gap-6">
            {/* Avatar */}
            <div className="flex flex-col gap-3">
              <div className="relative w-[92px] h-[92px]">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-full bg-accent text-accent-foreground flex items-center justify-center bw-h1">
                    {initials}
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleAvatarUpload} />
                <IconButton
                  label="Upload photo"
                  variant="filled"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  icon={uploadingAvatar ? <Loader2 className="animate-spin" /> : <Camera />}
                  className="absolute -bottom-1 -right-3"
                />
              </div>
              <p className="bw-label-xs text-muted-foreground">Max 8 MB · JPG or PNG</p>
            </div>

            {error && <FormError>{error}</FormError>}

            <PillField
              label="Full name"
              icon={<User className="w-5 h-5" />}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              autoComplete="name"
            />

            {/* Email (read-only) */}
            <div className="flex flex-col gap-2">
              <label htmlFor="edit-profile-email" className="bw-label-sm text-muted-foreground">
                Email
              </label>
              <div className="flex items-center gap-3 h-[52px] px-4 rounded-full bg-foreground/[0.06] text-muted-foreground">
                <Lock className="w-5 h-5 shrink-0" />
                <input
                  id="edit-profile-email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  aria-describedby="edit-profile-email-hint"
                  className="flex-1 min-w-0 bg-transparent outline-none bw-body-lg text-muted-foreground cursor-not-allowed"
                />
              </div>
              <p id="edit-profile-email-hint" className="bw-body-sm text-muted-foreground">
                Linked to your sign-in.
              </p>
            </div>

            <PillField
              label="Phone number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 234 567 8900"
              autoComplete="tel"
            />

            {/* Primary instrument */}
            <fieldset className="flex flex-col gap-2">
              <legend className="bw-label-sm text-muted-foreground mb-2">Primary instrument / role</legend>
              <div className="flex flex-wrap gap-2">
                {INSTRUMENT_OPTIONS.map(({ value }) => {
                  const isSelected = selectedInstrument === value;
                  return (
                    <Selector
                      key={value}
                      selected={isSelected}
                      onClick={() => setInstrument(value)}
                      className={isSelected ? 'bg-accent text-accent-foreground' : undefined}
                    >
                      {value}
                    </Selector>
                  );
                })}
              </div>
            </fieldset>

            {/* Bio */}
            <label className="flex flex-col gap-2 p-4 rounded-[24px] bg-field border border-border focus-within:border-foreground transition-colors">
              <span className="bw-label-xs text-muted-foreground">Bio &amp; background</span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share your musical background, credits, experience…"
                rows={3}
                className="w-full bg-transparent bw-body-lg text-foreground placeholder:text-muted-foreground/60 outline-none resize-none"
              />
            </label>
          </div>
        </div>

        {/* ═══ FOOTER ═══ */}
        <div className="shrink-0 px-4 pt-3 bg-background" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
          <div className="max-w-xl mx-auto w-full">
            <PillButton
              onClick={handleSave}
              loading={saving}
              variant={success ? 'dark' : 'primary'}
              icon={<Check className="w-[18px] h-[18px]" />}
            >
              {success ? 'Saved' : 'Save changes'}
            </PillButton>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EditProfileModal;