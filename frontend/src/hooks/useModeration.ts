'use client';

import { useEffect, useState } from 'react';
import { getModerator, type ImageVerdict, type ModerationState, type ModerationVerdict } from '@/lib/moderation';

/** Live status of the on-device moderation model (loading progress, ready, …). */
export function useModerationState(): ModerationState {
  const [state, setState] = useState<ModerationState>({ status: 'idle', progress: 0 });
  useEffect(() => getModerator()?.subscribe(setState), []);
  return state;
}

/** Live status of the on-device image/video safety model. */
export function useImageModerationState(): ModerationState {
  const [state, setState] = useState<ModerationState>({ status: 'idle', progress: 0 });
  useEffect(() => getModerator()?.subscribeImage(setState), []);
  return state;
}

/** Classifies an image URL locally; null while pending. */
export function useImageVerdict(url: string | undefined, enabled = true): ImageVerdict | null {
  const [result, setResult] = useState<{ url: string; verdict: ImageVerdict } | null>(null);
  useEffect(() => {
    if (!enabled || !url) return;
    let cancelled = false;
    getModerator()
      ?.classifyImage(url)
      .then((verdict) => {
        if (!cancelled) setResult({ url, verdict });
      });
    return () => {
      cancelled = true;
    };
  }, [url, enabled]);
  return result && result.url === url ? result.verdict : null;
}

/**
 * Classifies `text` locally and returns the verdict (or null while pending).
 * The text never leaves the device.
 */
export function useVerdict(text: string | undefined, enabled = true): ModerationVerdict | null {
  const [result, setResult] = useState<{ text: string; verdict: ModerationVerdict } | null>(null);
  useEffect(() => {
    if (!enabled || !text) return;
    let cancelled = false;
    getModerator()
      ?.classify(text)
      .then((verdict) => {
        if (!cancelled) setResult({ text, verdict });
      });
    return () => {
      cancelled = true;
    };
  }, [text, enabled]);
  return result && result.text === text ? result.verdict : null;
}
