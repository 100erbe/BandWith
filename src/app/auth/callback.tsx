import { useEffect, useState } from 'react';
import { supabase, RECOVERY_FLAG } from '@/lib/supabase';
import { Loader2 } from '@/app/components/icons';

/**
 * Auth callback page — handles OAuth redirects from Google/Apple.
 * 
 * When Supabase redirects back with the OAuth tokens in the URL hash
 * (e.g. #access_token=xxx&refresh_token=yyy), this page:
 * 1. Extracts tokens from URL hash (implicit flow)
 * 2. Sets the session via supabase.auth.setSession()
 * 3. Cleans the URL hash so isAuthCallback() won't match on next render
 * 4. Redirects to the main app root
 */
export default function AuthCallback() {
  const [status, setStatus] = useState<'processing' | 'redirecting'>('processing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const handleCallback = async () => {
      try {
        // Parse hash params (implicit flow: #access_token=xxx&refresh_token=yyy...)
        const hashParams = new URLSearchParams(
          window.location.hash.substring(1)
        );
        const accessToken = hashParams.get('access_token');

        // Also check query params (PKCE flow or error callback)
        const queryParams = new URLSearchParams(window.location.search);
        const code = queryParams.get('code');
        const errorDesc = queryParams.get('error_description');

        if (errorDesc) {
          console.error('[AuthCallback] OAuth error:', errorDesc);
          setError(decodeURIComponent(errorDesc));
          // Wait a moment then redirect back
          setTimeout(() => {
            if (!cancelled) {
              cleanupAndRedirect();
            }
          }, 3000);
          return;
        }

        if (code) {
          // PKCE flow. With detectSessionInUrl the client may already have
          // exchanged the code during init; getSession() waits for that.
          const { data: { session: existing } } = await supabase.auth.getSession();
          const { error: exchangeError } = existing
            ? { error: null }
            : await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('[AuthCallback] PKCE exchange error:', exchangeError);
            setError(exchangeError.message);
            setTimeout(() => {
              if (!cancelled) cleanupAndRedirect();
            }, 3000);
            return;
          }
          console.log('[AuthCallback] PKCE exchange successful');
        } else if (accessToken) {
          // Tokens in the URL fragment (legacy implicit flow) are rejected:
          // they cannot be tied to a sign-in this app started (login CSRF).
          setError('This sign-in link is no longer valid. Please sign in again.');
          setTimeout(() => {
            if (!cancelled) cleanupAndRedirect();
          }, 3000);
          return;
        } else {
          // No tokens found — auth listener might have already caught them,
          // or this is a stale callback
          console.log('[AuthCallback] No tokens in URL, checking existing session...');
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            console.warn('[AuthCallback] No session found');
            setError('Sign in did not complete. Please try again.');
            setTimeout(() => {
              if (!cancelled) cleanupAndRedirect();
            }, 3000);
            return;
          }
        }

        if (cancelled) return;
        setStatus('redirecting');

        // Clean the URL — remove hash and query params
        cleanupAndRedirect();
      } catch (err) {
        console.error('[AuthCallback] Unexpected error:', err);
        setError('An unexpected error occurred');
        setTimeout(() => {
          if (!cancelled) cleanupAndRedirect();
        }, 3000);
      }
    };

    const cleanupAndRedirect = () => {
      if (cancelled) return;
      const isRecovery = new URLSearchParams(window.location.search).get(RECOVERY_FLAG) === '1';
      // Replace the URL to remove all OAuth params, preventing
      // isAuthCallback() from triggering again after redirect
      window.history.replaceState(
        null,
        document.title,
        window.location.pathname
      );
      // Redirect to app root, keeping only the password-recovery flag so the
      // app can ask for a new password.
      window.location.href = isRecovery
        ? `${window.location.origin}/?${RECOVERY_FLAG}=1`
        : window.location.origin;
    };

    handleCallback();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-white" />
      {error ? (
        <>
          <span className="text-red-400 text-sm font-medium">{error}</span>
          <span className="text-white/40 text-xs">Redirecting back...</span>
        </>
      ) : (
        <span className="text-white/60 text-sm font-medium">
          {status === 'processing' ? 'Completing sign in...' : 'Redirecting...'}
        </span>
      )}
    </div>
  );
}
