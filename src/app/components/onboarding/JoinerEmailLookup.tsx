import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Search } from '@/app/components/icons';
import { AuthScreen, BackButton, Kicker, PillButton, PillField } from '@/app/components/bw/Form';

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
      const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(`${supabaseUrl}/functions/v1/setup-invite-rls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Publishable keys go on `apikey` only: they are not JWTs.
          apikey: supabasePublishableKey,
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
    <AuthScreen
      bodyClassName="pt-3 gap-5"
      top={<BackButton onClick={onBack} className="bw-duo-rail-back" />}
      footer={
        <PillButton
          variant="dark"
          onClick={handleLookup}
          disabled={!email}
          loading={isLoading}
          trailingIcon={<Search className="w-5 h-5" />}
        >
          {isLoading ? 'Searching…' : 'Find invite'}
        </PillButton>
      }
    >
      <motion.div
        className="flex flex-col gap-5"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="dark w-16 h-16 rounded-[24px] bg-sheet text-sheet-foreground flex items-center justify-center">
          <Search className="w-[29px] h-[29px]" aria-hidden />
        </div>

        <Kicker overline="Join a band" title="Find your invite" />

        <p className="text-[16px] leading-[1.45] tracking-[-0.003em] text-muted-foreground max-w-[340px]">
          Enter the email where your band invitation was sent.
        </p>

        <PillField
          label="Email"
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="your@email.com"
          autoComplete="email"
          autoCapitalize="none"
          autoFocus
          icon={<Mail className="w-5 h-5" strokeWidth={1.75} />}
          error={error}
          hint="We'll look for pending invitations sent to this address."
        />
      </motion.div>
    </AuthScreen>
  );
};

export default JoinerEmailLookup;
