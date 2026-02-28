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
  Save
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
    if (!user) return;
    
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
      
      // Refresh profile data
      if (refreshProfile) {
        await refreshProfile();
      }
      
      setTimeout(() => {
        onProfileUpdated?.();
        onClose();
        setSuccess(false);
      }, 1000);
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
            Profile
          </span>
          <h2 className="text-4xl font-black text-black tracking-tighter uppercase leading-none">
            EDIT
          </h2>
          <p className="text-black/50 font-bold text-sm mt-1 tracking-tight">Update your information</p>
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
        {/* Avatar Section */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-8"
        >
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-[#1A1A1A] flex items-center justify-center text-white font-black text-2xl">
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
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 w-10 h-10 bg-[#D4FB46] rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
            >
              {uploadingAvatar ? (
                <Loader2 className="w-5 h-5 text-black animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-black" />
              )}
            </button>
          </div>
        </motion.div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-600 text-sm font-medium">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Full Name */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-2 flex items-center gap-2">
              <User className="w-4 h-4" />
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              className="w-full bg-transparent border-b-2 border-black/10 py-3 text-xl font-bold text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-all"
            />
          </motion.div>

          {/* Email (read-only) */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-2 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full bg-transparent border-b-2 border-black/5 py-3 text-xl font-bold text-black/40 cursor-not-allowed"
            />
            <p className="text-[10px] text-black/30 mt-1">Email cannot be changed</p>
          </motion.div>

          {/* Phone */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-2 flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 234 567 8900"
              className="w-full bg-transparent border-b-2 border-black/10 py-3 text-xl font-bold text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-all"
            />
          </motion.div>

          {/* Primary Instrument */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-3 flex items-center gap-2">
              <Music2 className="w-4 h-4" />
              Primary Instrument
            </label>
            <div className="flex flex-wrap gap-2">
              {instruments.map((inst) => (
                <button
                  key={inst}
                  onClick={() => setInstrument(inst)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-bold uppercase transition-all",
                    instrument === inst
                      ? "bg-black text-white"
                      : "bg-white/50 text-black/60 hover:bg-white"
                  )}
                >
                  {inst}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Bio */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            <label className="text-[10px] font-bold uppercase tracking-widest text-black/40 block mb-2">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              rows={4}
              className="w-full bg-transparent border-b-2 border-black/10 py-3 text-base font-medium text-black placeholder:text-black/30 focus:outline-none focus:border-black transition-all min-h-[120px] resize-none"
            />
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <div
        className="absolute bottom-0 left-0 right-0 px-6 pb-6 pt-4 bg-gradient-to-t from-[#E6E5E1] via-[#E6E5E1] to-transparent"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
      >
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "w-full h-14 rounded-full font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.98]",
            success
              ? "bg-green-500 text-white"
              : "bg-black text-white hover:scale-[1.02]"
          )}
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : success ? (
            <>
              <Check className="w-5 h-5" />
              Saved!
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};

export default EditProfileModal;
