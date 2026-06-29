'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChevronRight, ArrowRight, Wallet, KeyRound, UserPen, CheckCircle2 } from 'lucide-react';
import { Nav } from '@/components/layout/Nav';
import { ConnectGate } from '@/components/layout/ConnectGate';
import { useWallet } from '@/components/wallet/WalletProvider';
import { hasLocalKey, createAndStoreKeyPair } from '@/lib/keystore';

const STEPS = ['wallet', 'keys', 'username', 'done'] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const { isConnected } = useWallet();
  const [stepIdx, setStepIdx] = useState(0);
  const [keyDone, setKeyDone] = useState(() => hasLocalKey());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('dmessage_onboarding_done');
    if (stored === 'true') {
      router.replace('/dashboard');
    }
  }, [router]);

  const completeOnboarding = () => {
    localStorage.setItem('dmessage_onboarding_done', 'true');
    router.replace('/dashboard');
  };

  const step = STEPS[stepIdx];

  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col">
        <Nav />
        <ConnectGate message="Connect your wallet to start" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-6 py-10">
        {/* Step indicator */}
        <div className="mb-8 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center border-2 font-mono text-xs font-bold ${
                  i <= stepIdx
                    ? 'border-[var(--accent)] bg-black text-[var(--accent)]'
                    : 'border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-muted)]'
                }`}
              >
                0{i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <ChevronRight className="h-3.5 w-3.5 text-[var(--text-faint)]" strokeWidth={2} />
              )}
            </div>
          ))}
        </div>

        {step === 'wallet' && (
          <WalkthroughCard
            icon={<Wallet className="h-6 w-6" strokeWidth={1.75} />}
            title="Connect Your Wallet"
            desc="dMessage uses the Stellar network. Your Freighter wallet handles identity and signing — no passwords, no email."
            tips={['Ensure Freighter is installed', 'Set network to Testnet', 'Fund your account via the Stellar faucet']}
            action={
              <button
                onClick={() => setStepIdx(1)}
                className="brutal-accent flex items-center gap-2 bg-black px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-[var(--accent)]"
              >
                Connected — Next Step
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </button>
            }
            skip={() => { completeOnboarding(); }}
          />
        )}

        {step === 'keys' && (
          <WalkthroughCard
            icon={<KeyRound className="h-6 w-6" strokeWidth={1.75} />}
            title="Generate Encryption Keys"
            desc="Your browser generates a keypair locally. The public key is published on-chain so peers can send you encrypted messages. The private key never leaves your device."
            tips={['Keys are stored in browser storage', 'Rotate them anytime in Settings', 'Re-register username after rotation']}
            action={
              keyDone ? (
                <button
                  onClick={() => setStepIdx(2)}
                  className="brutal-accent flex items-center gap-2 bg-black px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-[var(--accent)]"
                >
                  Keys Ready — Next Step
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </button>
              ) : (
                <button
                  onClick={async () => {
                    await createAndStoreKeyPair();
                    setKeyDone(true);
                  }}
                  className="brutal-accent flex items-center gap-2 bg-black px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-[var(--accent)]"
                >
                  Generate Keys Now
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </button>
              )
            }
            skip={() => setStepIdx(2)}
          />
        )}

        {step === 'username' && (
          <WalkthroughCard
            icon={<UserPen className="h-6 w-6" strokeWidth={1.75} />}
            title="Register a Username"
            desc="Pick a unique username to make your profile recognizable. Your username is stored on the Stellar blockchain in the UserRegistry contract."
            tips={['3–20 characters', 'Letters, numbers, underscores', 'Not required — you can chat with just an address']}
            action={
              <button
                onClick={() => setStepIdx(3)}
                className="brutal-accent flex items-center gap-2 bg-black px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-[var(--accent)]"
              >
                I&apos;ll Do It Later
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </button>
            }
            skip={() => setStepIdx(3)}
          />
        )}

        {step === 'done' && (
          <WalkthroughCard
            icon={<CheckCircle2 className="h-6 w-6" strokeWidth={1.75} />}
            title="You&apos;re All Set!"
            desc="Your wallet is connected and your keys are ready. Start a conversation by pasting a friend's Stellar address into the sidebar."
            tips={['Share your address via QR in Settings', 'Messages are end-to-end encrypted', 'No servers — your data stays yours']}
            action={
              <button
                onClick={completeOnboarding}
                className="brutal-accent flex items-center gap-2 bg-black px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-[var(--accent)]"
              >
                Start Messaging
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </button>
            }
            skip={null}
          />
        )}
      </main>
    </div>
  );
}

function WalkthroughCard({
  icon,
  title,
  desc,
  tips,
  action,
  skip,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  tips: string[];
  action: React.ReactNode;
  skip: (() => void) | null;
}) {
  return (
    <div className="brutal-static w-full bg-[var(--bg-surface)] p-6 sm:p-8">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center bg-[var(--bg-inset)] text-[var(--accent)]">
          {icon}
        </div>
        <div>
          <h2 className="font-mono text-lg font-black tracking-tight text-[var(--text)]">
            {title}
          </h2>
        </div>
      </div>

      <p className="mb-6 font-mono text-sm leading-relaxed text-[var(--text-muted)]">
        {desc}
      </p>

      <div className="mb-6 border-l-2 border-[var(--accent)] bg-[var(--bg-inset)] px-4 py-3">
        <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--accent)]">
          Tips
        </p>
        <ul className="space-y-1">
          {tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-2 font-mono text-[11px] text-[var(--text-muted)]">
              <span className="mt-0.5 text-[var(--accent)]">*</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-3">
        {action}
        {skip && (
          <button
            onClick={skip}
            className="font-mono text-xs text-[var(--text-faint)] underline underline-offset-2 transition-colors hover:text-[var(--text-muted)]"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
