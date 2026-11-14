import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Search } from '@/app/components/icons';
import { AuthScreen, BackButton, Kicker, PillButton, PillField } from '@/app/components/bw/Form';
import { useT } from '@/lib/i18n';

interface JoinerEmailLookupProps {
  onBack: () => void;
  /** Invites are waiting for this address (which band is shown only once signed in with it). */
  onInvitesFound: (email: string) => void;
  onNoInvites: (email: string) => void;
}

/**
 * How many invites the lookup found. The function answers anyone who types
 * an address, so it only says how many (setup-invite-rls); an older
 * deployment still sends the list, of which only the length is used.
 */
export function lookupInviteCount(result: unknown): number {
  const r = result as { count?: unknown; invites?: unknown } | null;
  if (typeof r?.count === 'number' && r.count > 0) return r.count;
  return Array.isArray(r?.invites) ? r.invites.length : 0;
}

export const JoinerEmailLookup: React.FC<JoinerEmailLookupProps> = ({
  onBack,
  onInvitesFound,
  onNoInvites,
}) => {
  const t = useT();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleLookup = async () => {
    if (!validateEmail(email)) {
      setError(t('Please enter a valid email address'));
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

      if (response.status === 429) {
        setError(t('Too many attempts. Wait a minute and try again.'));
        return;
      }

      const result = response.ok ? await response.json().catch(() => null) : null;

      if (!result?.success) {
        setError(t('Failed to check invitations'));
        return;
      }

      if (lookupInviteCount(result) === 0) {
        onNoInvites(email);
        return;
      }

      onInvitesFound(email);
    } catch {
      // fetch() itself failed: no connection.
      setError(t('Check your connection and try again.'));
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
          {isLoading ? t('Searching…') : t('Find invite')}
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

        <Kicker overline={t('Join a band')} title={t('Find your invite')} />

        <p className="text-[16px] leading-[1.45] tracking-[-0.003em] text-muted-foreground max-w-[340px]">
          {t('Enter the email where your band invitation was sent.')}
        </p>

        <PillField
          label={t('Email')}
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
          hint={t("We'll look for pending invitations sent to this address.")}
        />
      </motion.div>
    </AuthScreen>
  );
};

export default JoinerEmailLookup;
