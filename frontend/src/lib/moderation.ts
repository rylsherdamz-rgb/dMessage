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
const IMAGE_SETTINGS_KEY = 'dmessage:moderation:image-ml';
const MODEL_ID = process.env.NEXT_PUBLIC_MODERATION_MODEL || 'Xenova/toxic-bert';
const IMAGE_MODEL_ID = process.env.NEXT_PUBLIC_IMAGE_MODERATION_MODEL || 'AdamCodd/vit-base-nsfw-detector';

export interface ImageVerdict {
  action: 'allow' | 'block';
  /** Probability (0–1) that the image is sexual/explicit. */
  nsfw: number;
  labels: ModerationLabel[];
}

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
  nsfw: 'explicit image',
};

export const PII_TEXT: Record<string, string> = {
  email: 'an email address',
  phone: 'a phone number',
  secret_key: 'a Stellar secret key',
  seed_phrase: 'a seed phrase',
  address: 'a street address',
};

function readPref(key: string): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v !== null) return v === '1';
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    return !conn?.saveData;
  } catch {
    return false;
  }
}

function writePref(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** Whether the user wants the text ML model (defaults on, off for data-saver). */
export function getMlPreference(): boolean {
  return readPref(SETTINGS_KEY);
}

export function setMlPreference(on: boolean) {
  writePref(SETTINGS_KEY, on);
  getModerator()?.init();
}

/**
 * Whether the image/video-frame model may be used. It is only downloaded the
 * first time an image or video actually needs checking.
 */
export function getImageMlPreference(): boolean {
  return readPref(IMAGE_SETTINGS_KEY);
}

export function setImageMlPreference(on: boolean) {
  writePref(IMAGE_SETTINGS_KEY, on);
  getModerator()?.init();
}

type Listener = (s: ModerationState) => void;

class Moderator {
  private worker: Worker;
  private seq = 0;
  private pending = new Map<number, (v: ModerationVerdict) => void>();
  private pendingImages = new Map<number, (v: ImageVerdict) => void>();
  private listeners = new Set<Listener>();
  private imageListeners = new Set<Listener>();
  state: ModerationState = { status: 'idle', progress: 0 };
  imageState: ModerationState = { status: 'idle', progress: 0 };

  constructor() {
    this.worker = new Worker('/moderation-worker.js', { type: 'module' });
    this.worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m?.type === 'result') {
        this.pending.get(m.id)?.(m.verdict);
        this.pending.delete(m.id);
      } else if (m?.type === 'image-result') {
        this.pendingImages.get(m.id)?.(m.verdict);
        this.pendingImages.delete(m.id);
      } else if (m?.type === 'status') {
        this.state = { status: m.status, progress: m.progress ?? 0, error: m.error };
        this.listeners.forEach((l) => l(this.state));
      } else if (m?.type === 'image-status') {
        this.imageState = { status: m.status, progress: m.progress ?? 0, error: m.error };
        this.imageListeners.forEach((l) => l(this.imageState));
      }
    };
  }

  init() {
    this.worker.postMessage({
      type: 'init',
      useML: getMlPreference(),
      useImageML: getImageMlPreference(),
      modelId: MODEL_ID,
      imageModelId: IMAGE_MODEL_ID,
    });
  }

  /**
   * Classifies an image locally. Accepts an ImageBitmap (e.g. a video frame,
   * transferred zero-copy), a Blob, or a URL the browser is already loading.
   */
  classifyImage(image: ImageBitmap | Blob | string, timeoutMs = 60_000): Promise<ImageVerdict> {
    const id = ++this.seq;
    const allow: ImageVerdict = { action: 'allow', nsfw: 0, labels: [] };
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.pendingImages.delete(id)) resolve(allow);
      }, timeoutMs);
      this.pendingImages.set(id, (v) => {
        clearTimeout(timer);
        resolve(v);
      });
      const transfer = typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap ? [image] : [];
      this.worker.postMessage({ type: 'classify-image', id, image }, transfer);
    });
  }

  subscribeImage(l: Listener) {
    this.imageListeners.add(l);
    l(this.imageState);
    return () => {
      this.imageListeners.delete(l);
    };
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
    instance.init();
  }
  return instance;
}

export function describeLabels(labels: ModerationLabel[]): string {
  return labels.map((l) => LABEL_TEXT[l.label] ?? l.label).join(', ');
}
