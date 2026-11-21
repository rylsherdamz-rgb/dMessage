'use client';

/**
 * On-device moderation client.
 *
 * Message text is handed to a dedicated Web Worker (public/moderation-worker.js)
 * that runs a rules layer plus an optional local ML classifier. Only a verdict
 * comes back. Nothing is ever sent to a server — there is no moderation API.
 */

export type ModerationAction = 'allow' | 'warn' | 'block';

export interface ModerationLabel {
  label: string;
  score: number;
}

export interface ModerationVerdict {
  action: ModerationAction;
  severe: boolean;
  labels: ModerationLabel[];
  /** Personal info detected in the text (email, phone, …). Used to warn senders. */
  pii: string[];
}

export type ModelStatus = 'idle' | 'rules-only' | 'loading' | 'ready' | 'error';

export interface ModerationState {
  status: ModelStatus;
  progress: number;
  error?: string;
}

const SETTINGS_KEY = 'dmessage:moderation:ml';
const MODEL_ID = process.env.NEXT_PUBLIC_MODERATION_MODEL || 'Xenova/toxic-bert';

export const LABEL_TEXT: Record<string, string> = {
  toxic: 'toxic',
  severe_toxic: 'severely toxic',
  obscene: 'obscene',
  threat: 'threat',
  insult: 'insult',
  identity_hate: 'hate speech',
  minor_safety: 'possible child-safety risk',
  scam: 'possible scam',
  link: 'suspicious link',
};

export const PII_TEXT: Record<string, string> = {
  email: 'an email address',
  phone: 'a phone number',
  secret_key: 'a Stellar secret key',
  seed_phrase: 'a seed phrase',
  address: 'a street address',
};

/** Whether the user wants the ML model (defaults on, off for data-saver). */
export function getMlPreference(): boolean {
  try {
    const v = localStorage.getItem(SETTINGS_KEY);
    if (v !== null) return v === '1';
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    return !conn?.saveData;
  } catch {
    return false;
  }
}

export function setMlPreference(on: boolean) {
  try {
    localStorage.setItem(SETTINGS_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
  getModerator()?.init(on);
}

type Listener = (s: ModerationState) => void;

class Moderator {
  private worker: Worker;
  private seq = 0;
  private pending = new Map<number, (v: ModerationVerdict) => void>();
  private listeners = new Set<Listener>();
  state: ModerationState = { status: 'idle', progress: 0 };

  constructor() {
    this.worker = new Worker('/moderation-worker.js', { type: 'module' });
    this.worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m?.type === 'result') {
        this.pending.get(m.id)?.(m.verdict);
        this.pending.delete(m.id);
      } else if (m?.type === 'status') {
        this.state = { status: m.status, progress: m.progress ?? 0, error: m.error };
        this.listeners.forEach((l) => l(this.state));
      }
    };
  }

  init(useML: boolean) {
    this.worker.postMessage({ type: 'init', useML, modelId: MODEL_ID });
  }

  classify(text: string): Promise<ModerationVerdict> {
    const id = ++this.seq;
    return new Promise((resolve) => {
      // Never block chat on moderation: fall back to "allow" after 4s.
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) resolve({ action: 'allow', severe: false, labels: [], pii: [] });
      }, 4000);
      this.pending.set(id, (v) => {
        clearTimeout(timer);
        resolve(v);
      });
      this.worker.postMessage({ type: 'classify', id, text });
    });
  }

  subscribe(l: Listener) {
    this.listeners.add(l);
    l(this.state);
    return () => {
      this.listeners.delete(l);
    };
  }
}

let instance: Moderator | null = null;

export function getModerator(): Moderator | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;
  if (!instance) {
    instance = new Moderator();
    instance.init(getMlPreference());
  }
  return instance;
}

export function describeLabels(labels: ModerationLabel[]): string {
  return labels.map((l) => LABEL_TEXT[l.label] ?? l.label).join(', ');
}
