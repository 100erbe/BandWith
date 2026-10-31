import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  User,
  Mail,
  Phone,
  Music2,
  Camera,
  Loader2,
  Check,
  Save,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
}

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

    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be smaller than 2MB');
      return;
    }

    setUploadingAvatar(true);
    setError(null);

    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      if (refreshProfile) await refreshProfile();
    } catch (err: any) {
      setError(err.message || 'Failed to upload photo');
    } finally {
      setUploadingAvatar(false);
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

  const instruments = [
    'Vocals', 'Guitar', 'Bass', 'Drums', 'Keyboard', 'Piano',
    'Saxophone', 'Trumpet', 'Violin', 'Cello', 'DJ', 'Producer', 'Other'
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-background text-foreground"
      >
        {/* ═══ STICKY HEADER ═══ */}
        <div
          className="px-4 shrink-0 border-b border-foreground/10 bg-background/95 backdrop-blur-md sticky top-0 z-30"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
            paddingBottom: '14px',
          }}
        >
          <div className="max-w-xl mx-auto w-full flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                aria-label="Go back"
                className="w-10 h-10 rounded-full border border-foreground/20 bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center text-foreground transition-all active:scale-90 shrink-0"
              >
                <ArrowLeft className="w-5 h-5 text-foreground" />
              </button>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-foreground/50 uppercase tracking-wider">
                  USER PROFILE
                </span>
                <h2 className="text-[20px] font-black uppercase text-foreground leading-none">
                  EDIT PROFILE
                </h2>
              </div>
            </div>

            <button 
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full border border-foreground/20 bg-foreground/5 hover:bg-foreground/10 flex items-center justify-center text-foreground/60 transition-all active:scale-90"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ═══ CONTENT ═══ */}
        <div className="flex-1 overflow-y-auto px-4 py-6 max-w-xl mx-auto w-full pb-32 space-y-6">
          {/* Avatar Section */}
          <div className="flex justify-center">
            <div className="relative">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover border-2 border-foreground/15 shadow-sm"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-primary/10 text-primary border-2 border-primary/20 flex items-center justify-center font-black text-2xl shadow-inner">
                  {fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || 'U'}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 w-9 h-9 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all"
                aria-label="Upload photo"
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-[12px] text-destructive text-xs font-semibold">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/50 block mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-foreground/50" />
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full px-4 py-2.5 rounded-[12px] bg-foreground/5 border border-foreground/10 text-sm font-semibold text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/50 block mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-foreground/50" />
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-2.5 rounded-[12px] bg-foreground/5 border border-foreground/10 text-sm font-semibold text-foreground/50 cursor-not-allowed"
              />
              <p className="text-[10px] text-foreground/40 mt-1 font-medium">Email address is linked to your account authentication</p>
            </div>

            {/* Phone */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/50 block mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-foreground/50" />
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 234 567 8900"
                className="w-full px-4 py-2.5 rounded-[12px] bg-foreground/5 border border-foreground/10 text-sm font-semibold text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {/* Primary Instrument */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/50 block mb-2 flex items-center gap-1.5">
                <Music2 className="w-3.5 h-3.5 text-foreground/50" />
                Primary Instrument / Role
              </label>
              <div className="flex flex-wrap gap-2">
                {instruments.map((inst) => (
                  <button
                    key={inst}
                    type="button"
                    onClick={() => setInstrument(inst)}
                    className={cn(
                      'px-3.5 py-1.5 rounded-[8px] text-[11px] font-bold uppercase tracking-wider transition-all border',
                      instrument === inst
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-foreground/5 hover:bg-foreground/10 text-foreground/70 border-foreground/10'
                    )}
                  >
                    {inst}
                  </button>
                ))}
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-foreground/50 block mb-1.5">
                Bio & Background
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share your musical background, credits, experience..."
                rows={3}
                className="w-full p-4 rounded-[12px] bg-foreground/5 border border-foreground/10 text-sm font-medium text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-primary transition-colors resize-none"
              />
            </div>
          </div>
        </div>

        {/* ═══ FOOTER ═══ */}
        <div
          className="sticky bottom-0 left-0 right-0 px-4 py-4 border-t border-foreground/10 bg-background/95 backdrop-blur-md"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
        >
          <div className="max-w-xl mx-auto w-full">
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                'w-full h-12 rounded-[12px] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-xs active:scale-[0.98]',
                success
                  ? 'bg-green-600 text-white'
                  : 'bg-primary text-primary-foreground hover:opacity-95'
              )}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : success ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EditProfileModal;