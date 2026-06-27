'use client';

import { useEffect, useState } from 'react';
import {
  Copy,
  Check,
  LogOut,
  KeyRound,
  ShieldCheck,
  CircleUserRound,
  RefreshCw,
  Network,
} from 'lucide-react';
import { Nav } from '@/components/layout/Nav';
import { ConnectGate } from '@/components/layout/ConnectGate';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { useWallet } from '@/components/wallet/WalletProvider';
import { useProfile } from '@/hooks/useProfile';
import {
  hasLocalKey,
  getStoredPublicKeyB64,
  createAndStoreKeyPair,
} from '@/lib/keystore';
import { CONTRACT_IDS } from '@/lib/stellar';
import { registerUser, validateUsername } from '@/lib/registry';

export default function SettingsPage() {
  const { isConnected, address, disconnect, signTransaction } = useWallet();
  const { data: profile, isLoading, refetch } = useProfile(address);

  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [keyPresent, setKeyPresent] = useState(false);
  const [pubKey, setPubKey] = useState<string | null>(null);

  useEffect(() => {
    // Client-only: read persisted key state after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKeyPresent(hasLocalKey());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPubKey(getStoredPublicKeyB64());
  }, []);

  useEffect(() => {
    // Seed the editable field from the on-chain profile once it loads.
    if (profile?.username) setUsername(profile.username);
  }, [profile?.username]);

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const generateKeys = async () => {
    const { publicKeyB64 } = await createAndStoreKeyPair();
    setKeyPresent(true);
    setPubKey(publicKeyB64);
    setStatus('New encryption keys generated and stored locally.');
  };

  const handleRegister = async () => {
    const name = username.trim();
    if (!name || saving || !address || !CONTRACT_IDS.userRegistry) return;

    const v = validateUsername(name);
    if (!v.ok) {
      setStatus(v.reason ?? 'Invalid username');
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      await registerUser(address, name, signTransaction);
      setKeyPresent(true);
      setPubKey(getStoredPublicKeyB64());
      setStatus('Profile submitted on-chain.');
      refetch();
    } catch (err) {
      console.error('[Settings] register failed:', err);
      setStatus('Registration failed — see console for details.');
    } finally {
      setSaving(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col">
        <Nav />
        <ConnectGate message="Authenticate to manage your profile" />
      </div>
    );
  }

  const truncated = address ? `${address.slice(0, 10)}…${address.slice(-8)}` : '';

  return (
    <div className="flex min-h-screen flex-col">
      <Nav />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <header className="mb-8">
          <h1 className="font-mono text-2xl font-black tracking-tight">Settings</h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.15em] text-[var(--text-muted)]">
            Identity · Keys · Account
          </p>
        </header>

        <div className="flex flex-col gap-6">
          {/* Profile / identity */}
          <section className="brutal-static bg-[var(--bg-surface)] p-6">
            <div className="mb-5 flex items-center gap-2 text-[var(--accent)]">
              <CircleUserRound className="h-4 w-4" strokeWidth={2} aria-hidden />
              <h2 className="font-mono text-xs uppercase tracking-[0.15em]">Profile</h2>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : (
              <>
                <div className="mb-5 flex items-center gap-4">
                  <Avatar seed={address ?? 'anon'} size={56} online />
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-black tracking-tight text-white">
                      {profile?.username ? `@${profile.username}` : 'Unregistered'}
                    </p>
                    <p className="truncate font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                      {truncated}
                    </p>
                  </div>
                </div>
                <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Username
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="satoshi"
                    className="brutal-input flex-1 bg-[var(--bg)] px-4 py-3 font-mono text-sm text-white"
                  />
                  <button
                    onClick={handleRegister}
                    disabled={saving || !username.trim()}
                    className="brutal-accent flex items-center justify-center gap-2 bg-black px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-[var(--accent)] disabled:opacity-30"
                  >
                    {saving ? '…' : profile ? 'Update' : 'Register'}
                  </button>
                </div>
                <p className="mt-3 font-mono text-[11px] leading-relaxed text-[var(--text-faint)]">
                  {profile
                    ? 'Registered on-chain via UserRegistry. Updating re-publishes your profile.'
                    : 'Registers your username and encryption public key to the UserRegistry contract.'}
                </p>
              </>
            )}
          </section>

          {/* Encryption keys */}
          <section className="brutal-static bg-[var(--bg-surface)] p-6">
            <div className="mb-5 flex items-center gap-2 text-[var(--cyan)]">
              <KeyRound className="h-4 w-4" strokeWidth={2} aria-hidden />
              <h2 className="font-mono text-xs uppercase tracking-[0.15em]">Encryption Keys</h2>
            </div>

            <div className="flex items-center gap-2">
              {keyPresent ? (
                <ShieldCheck className="h-4 w-4 text-[var(--accent)]" strokeWidth={2} aria-hidden />
              ) : (
                <ShieldCheck className="h-4 w-4 text-[var(--text-faint)]" strokeWidth={2} aria-hidden />
              )}
              <span className="font-mono text-sm text-white">
                {keyPresent ? 'Local keypair active' : 'No local keypair'}
              </span>
            </div>

            {pubKey && (
              <p className="mt-3 break-all border border-[var(--border)] bg-[var(--bg-inset)] p-3 font-mono text-[10px] leading-relaxed text-[var(--text-muted)]">
                {pubKey.slice(0, 88)}…
              </p>
            )}

            <button
              onClick={generateKeys}
              className="brutal mt-4 flex items-center gap-2 bg-[var(--bg)] px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              {keyPresent ? 'Rotate Keys' : 'Generate Keys'}
            </button>
            <p className="mt-3 font-mono text-[11px] leading-relaxed text-[var(--text-faint)]">
              Private key stays in this browser only. Rotating invalidates your ability to decrypt
              older messages — re-register afterward to publish the new public key.
            </p>
          </section>

          {/* Account */}
          <section className="brutal-static bg-[var(--bg-surface)] p-6">
            <div className="mb-5 flex items-center gap-2 text-[var(--violet)]">
              <Network className="h-4 w-4" strokeWidth={2} aria-hidden />
              <h2 className="font-mono text-xs uppercase tracking-[0.15em]">Account</h2>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Address
                </span>
                <div className="mt-1.5 flex items-center gap-3">
                  <code className="font-mono text-sm text-white">{truncated}</code>
                  <button
                    onClick={copyAddress}
                    aria-label="Copy address"
                    className="text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-[var(--accent)]" strokeWidth={2} />
                    ) : (
                      <Copy className="h-4 w-4" strokeWidth={2} />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Network
                </span>
                <p className="mt-1.5 flex items-center gap-2 font-mono text-sm text-white">
                  <span className="status-dot bg-[var(--accent)] text-[var(--accent)]" />
                  Stellar Testnet
                </p>
              </div>

              <button
                onClick={() => disconnect()}
                className="brutal mt-2 flex w-fit items-center gap-2 bg-[var(--bg)] px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-[var(--danger)]"
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                Disconnect
              </button>
            </div>
          </section>

          {status && (
            <p className="brutal-static bg-[var(--bg-inset)] p-4 font-mono text-xs text-[var(--accent)]">
              {status}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
