import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Mail, ArrowLeft, Loader2 } from 'lucide-react';

interface PendingInvite {
  id: string;
  band_id: string;
  email: string;
  role: 'admin' | 'member';
  status: string;
  created_at: string;
  expires_at: string;
  band: {
    id: string;
    name: string;
    logo_url?: string;
    description?: string;
  };
  member_count?: number;
}

interface JoinerEmailLookupProps {
  onBack: () => void;
  onInvitesFound: (invites: PendingInvite[], email: string) => void;
  onNoInvites: (email: string) => void;
}

export const JoinerEmailLookup: React.FC<JoinerEmailLookupProps> = ({
  onBack,
  onInvitesFound,
  onNoInvites,
}) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleLookup = async () => {
    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use direct fetch to Edge Function (bypasses RLS for anonymous users)
      // supabase.functions.invoke has issues with aborted signals during auth initialization
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/setup-invite-rls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          action: 'lookup_invites',
          email: email.toLowerCase(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to check invitations');
      }

      const result = await response.json();

      if (!result?.success) {
        throw new Error(result?.error || 'Failed to check invitations');
      }

      const invitations = result.invites || [];

      if (invitations.length === 0) {
        onNoInvites(email);
        return;
      }

      onInvitesFound(invitations, email);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && email && !isLoading) {
      handleLookup();
    }
  };

  return (
    <div
      className="min-h-screen bg-black flex flex-col relative overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Subtle gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div 
          className="absolute bottom-0 left-0 right-0 h-[60%]"
          style={{
            background: 'linear-gradient(to top, rgba(0, 71, 255, 0.03) 0%, transparent 100%)',
          }}
        />
      </div>

      {/* Header */}
      <div className="px-6 pt-6 relative z-10 flex items-center justify-between">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white/60 hover:bg-white/10 transition-all"
        >
          <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>
        
        <motion.img
          src="/brand/Logo - full text White.png"
          alt="BANDWITH"
          className="h-5 opacity-40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
        />
        
        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-6 pt-16 relative z-10">
        {/* Editorial headline */}
        <motion.div
          className="mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
        >
          <h1 className="text-[48px] font-black text-white leading-[0.95] tracking-tight mb-4">
            Find your
            <br />
            <span className="text-[#0047FF]">invite</span>
          </h1>
          <p className="text-white/40 text-[17px] font-medium leading-relaxed max-w-[280px]">
            Enter the email where your band invitation was sent.
          </p>
        </motion.div>

        {/* Email input */}
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" strokeWidth={1.5} />
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="your@email.com"
              className="w-full h-14 pl-12 pr-4 bg-white/5 border border-white/10 rounded-2xl text-white text-[17px] placeholder:text-white/20 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
              autoComplete="email"
              autoCapitalize="none"
              autoFocus
            />
          </div>

          {/* Error */}
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-400/80 text-[14px] font-medium px-1"
            >
              {error}
            </motion.p>
          )}
        </motion.div>
      </div>

      {/* Footer */}
      <motion.div
        className="px-6 pb-10 pt-6 relative z-10 space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        {/* Primary CTA */}
        <button
          onClick={handleLookup}
          disabled={!email || isLoading}
          className="w-full h-14 rounded-full text-[15px] font-black uppercase tracking-[0.15em] bg-[#D4FB46] text-black hover:bg-[#c8ef3a] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              Find Invite
              <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
            </>
          )}
        </button>

        {/* Helper text */}
        <p className="text-center text-white/20 text-[13px] font-medium px-8">
          We'll look for pending invitations sent to this address
        </p>
      </motion.div>
    </div>
  );
};

export default JoinerEmailLookup;
