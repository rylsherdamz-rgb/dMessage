'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AtSign, Check, Loader2, X, AlertCircle } from 'lucide-react';
import { useWallet } from '@/components/wallet/WalletProvider';
import { useProfile } from '@/hooks/useProfile';
import { Avatar } from '@/components/ui/Avatar';
import { validateUsername, checkUsernameAvailable, registerUser } from '@/lib/registry';

const DISMISS_KEY = 'dmessage:username-prompt-dismissed';

type AvailState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'available' }
  | { kind: 'taken'; reason: string };

/**
 * Shown once after a wallet connects when the address has no on-chain profile.
 * Prompts for a real username (not just a numeric address) with live
 * validation + availability check, then registers it on UserRegistry.
 */
export function UsernamePrompt() {
  const { isConnected, address, signTransaction, signAuthEntry } = useWallet();
  const { data: profile, isLoading, isFetched, refetch } = useProfile(address);

  const [dismissed, setDismissed] = useState(true);
  const [value, setValue] = useState('');
  const [avail, setAvail] = useState<AvailState>({ kind: 'idle' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore dismissal (per session) so we don't nag.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(false);
    }
  }, []);

  const open = useMemo(
    () => isConnected && !!address && isFetched && !isLoading && !profile && !dismissed,
    [isConnected, address, isFetched, isLoading, profile, dismissed],
  );

  // Debounced live validation + availability.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvail({ kind: 'idle' });
      return;
    }
    const v = validateUsername(value);
    if (!v.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvail({ kind: 'invalid', reason: v.reason ?? 'Invalid' });
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAvail({ kind: 'checking' });
    debounceRef.current = setTimeout(async () => {
      const res = await checkUsernameAvailable(value);
      setAvail(
        res.available
          ? { kind: 'available' }
          : { kind: 'taken', reason: res.reason ?? 'Username taken' },
      );
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  const handleSubmit = async () => {
    if (avail.kind !== 'available' || submitting || !address) return;
    setSubmitting(true);
    setError(null);
    try {
      await registerUser(address, value.trim(), signTransaction, signAuthEntry);
      await refetch();
      dismiss();
    } catch (err) {
      console.error('[UsernamePrompt] register failed:', err);
      setError('Registration failed. Check your wallet and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={dismiss}
            aria-hidden
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Choose a username"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="brutal-accent relative z-10 w-full max-w-md bg-[var(--bg-surface)] p-7"
          >
            <button
              onClick={dismiss}
              aria-label="Skip for now"
              className="absolute right-4 top-4 text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>

            <div className="mb-1 flex items-center gap-3">
              <Avatar seed={address ?? 'anon'} size={44} />
              <div>
                <div className="flex items-center gap-2 text-[var(--accent)]">
                  <AtSign className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                  <span className="font-mono text-[10px] uppercase tracking-[0.25em]">
                    Claim your handle
                  </span>
                </div>
                <h2 className="font-mono text-xl font-black tracking-tight text-white">
                  Pick a username
                </h2>
              </div>
            </div>
            <p className="mt-2 font-mono text-xs leading-relaxed text-[var(--text-muted)]">
              So people see a name instead of a wallet address. Letters, numbers and underscores —
              not just digits.
            </p>

            <div className="mt-6">
              <div className="flex items-center border-2 border-[var(--border-strong)] bg-[var(--bg)] focus-within:border-[var(--accent)]">
                <span className="pl-4 font-mono text-sm text-[var(--text-faint)]">@</span>
                <input
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(e.target.value.toLowerCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder="satoshi"
                  maxLength={20}
                  className="w-full bg-transparent px-2 py-3 font-mono text-sm text-white outline-none"
                />
                <span className="pr-4">
                  {avail.kind === 'checking' && (
                    <Loader2 className="h-4 w-4 animate-spin text-[var(--text-muted)]" />
                  )}
                  {avail.kind === 'available' && (
                    <Check className="h-4 w-4 text-[var(--accent)]" strokeWidth={2.5} />
                  )}
                  {(avail.kind === 'invalid' || avail.kind === 'taken') && (
                    <AlertCircle className="h-4 w-4 text-[var(--danger)]" strokeWidth={2} />
                  )}
                </span>
              </div>

              <div className="mt-2 h-4 font-mono text-[11px]">
                {avail.kind === 'invalid' && (
                  <span className="text-[var(--danger)]">{avail.reason}</span>
                )}
                {avail.kind === 'taken' && (
                  <span className="text-[var(--danger)]">{avail.reason}</span>
                )}
                {avail.kind === 'available' && (
                  <span className="text-[var(--accent)]">@{value} is available</span>
                )}
              </div>
            </div>

            {error && (
              <p className="mt-2 font-mono text-[11px] text-[var(--danger)]">{error}</p>
            )}

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={handleSubmit}
                disabled={avail.kind !== 'available' || submitting}
                className="brutal flex flex-1 items-center justify-center gap-2 bg-[var(--accent)] px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-black disabled:opacity-30"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Register on-chain'
                )}
              </button>
              <button
                onClick={dismiss}
                className="font-mono text-xs uppercase tracking-wider text-[var(--text-muted)] transition-colors hover:text-white"
              >
                Skip
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
