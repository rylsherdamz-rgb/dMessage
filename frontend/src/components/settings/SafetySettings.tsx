'use client';

import { useEffect, useState } from 'react';
import { Cpu, Fingerprint, ScanEye, ShieldAlert, Trash2, UserX } from 'lucide-react';
import { useImageModerationState, useModerationState } from '@/hooks/useModeration';
import {
  getImageMlPreference,
  getMlPreference,
  setImageMlPreference,
  setMlPreference,
} from '@/lib/moderation';
import { clearBlocked, loadBlocked, STRANGER_APP_ID } from '@/lib/stranger-blocklist';

/** Model files cached by Transformers.js in the browser's Cache Storage. */
const MODEL_CACHES = ['transformers-cache', 'experimental_transformers-hash-cache'];

/**
 * Safety & privacy controls. Everything here is local to this browser —
 * there is no account or server setting behind any of these switches.
 */
export function SafetySettings() {
  const text = useModerationState();
  const image = useImageModerationState();
  const [mlOn, setMlOn] = useState(false);
  const [imageOn, setImageOn] = useState(false);
  const [blockedCount, setBlockedCount] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setMlOn(getMlPreference());
    setImageOn(getImageMlPreference());
    setBlockedCount(loadBlocked().size);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const flash = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 4000);
  };

  const clearModels = async () => {
    try {
      await Promise.all(MODEL_CACHES.map((c) => caches.delete(c)));
      flash('Downloaded AI models removed from this device. They re-download only if needed.');
    } catch {
      flash('Could not clear the model cache in this browser.');
    }
  };

  const resetIdentity = async () => {
    const { clearUserIdentity } = await import('trystero');
    await clearUserIdentity(STRANGER_APP_ID);
    flash('New anonymous identity will be used for your next stranger chat.');
  };

  return (
    <section className="brutal-static bg-[var(--bg-surface)] p-6">
      <div className="mb-2 flex items-center gap-2 text-[var(--cyan)]">
        <ShieldAlert className="h-4 w-4" strokeWidth={2} aria-hidden />
        <h2 className="font-mono text-xs uppercase tracking-[0.15em]">Safety &amp; Privacy</h2>
      </div>
      <p className="mb-5 font-mono text-[11px] leading-relaxed text-[var(--text-faint)]">
        Moderation runs entirely in your browser. Messages, images and video frames are never sent to
        any server for checking.
      </p>

      <div className="flex flex-col divide-y-2 divide-[var(--border)]">
        <Row
          icon={<Cpu className="h-4 w-4" aria-hidden />}
          title="AI text moderation"
          desc={describe(mlOn, text.status, text.progress, '~110 MB')}
          action={
            <Switch
              checked={mlOn}
              label="AI text moderation"
              onChange={(v) => {
                setMlOn(v);
                setMlPreference(v);
              }}
            />
          }
        />
        <Row
          icon={<ScanEye className="h-4 w-4" aria-hidden />}
          title="AI image & video safety"
          desc={describe(imageOn, image.status, image.progress, '~90 MB, only when first needed')}
          action={
            <Switch
              checked={imageOn}
              label="AI image and video safety"
              onChange={(v) => {
                setImageOn(v);
                setImageMlPreference(v);
              }}
            />
          }
        />
        <Row
          icon={<UserX className="h-4 w-4" aria-hidden />}
          title="Blocked strangers"
          desc={`${blockedCount} blocked on this device. You won't be matched with them again.`}
          action={
            <Button
              disabled={!blockedCount}
              onClick={() => {
                clearBlocked();
                setBlockedCount(0);
                flash('Block list cleared.');
              }}
            >
              Clear
            </Button>
          }
        />
        <Row
          icon={<Fingerprint className="h-4 w-4" aria-hidden />}
          title="Anonymous stranger identity"
          desc="A random key (not your wallet) that lets blocks work. Reset it to start fresh."
          action={<Button onClick={() => void resetIdentity()}>Reset</Button>}
        />
        <Row
          icon={<Trash2 className="h-4 w-4" aria-hidden />}
          title="Downloaded AI models"
          desc="Free up storage by removing cached model files."
          action={<Button onClick={() => void clearModels()}>Remove</Button>}
        />
      </div>

      {status && <p className="mt-4 font-mono text-[11px] text-[var(--accent)]">{status}</p>}
    </section>
  );
}

function describe(on: boolean, status: string, progress: number, size: string) {
  if (!on) return `Off — built-in rules still apply. Turning on downloads a model (${size}).`;
  if (status === 'loading') return `Downloading to this device… ${Math.round(progress * 100)}%`;
  if (status === 'ready') return 'On · running locally';
  if (status === 'error') return 'Model failed to load — built-in rules still apply.';
  return `On · ${size}`;
}

function Row({
  icon,
  title,
  desc,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
      <span className="text-[var(--text-muted)]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm text-[var(--text)]">{title}</p>
        <p className="mt-0.5 font-mono text-[11px] leading-relaxed text-[var(--text-faint)]">{desc}</p>
      </div>
      {action}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`h-6 w-11 shrink-0 border-2 p-0.5 ${checked ? 'border-[var(--accent)]' : 'border-[var(--border-strong)]'}`}
    >
      <span
        className={`block h-full w-1/2 transition-transform ${checked ? 'translate-x-full bg-[var(--accent)]' : 'bg-[var(--text-faint)]'}`}
      />
    </button>
  );
}

function Button({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 border-2 border-[var(--border-strong)] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40"
    >
      {children}
    </button>
  );
}
