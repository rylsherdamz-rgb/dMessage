/**
 * dMessage — on-device AI moderation worker.
 *
 * PRIVACY CONTRACT
 * ----------------
 * This worker is the ONLY place message text is ever classified. It:
 *   - receives plaintext from the page via postMessage (same device, same origin),
 *   - classifies it locally (rules + an ONNX model running in WebAssembly/WebGPU),
 *   - returns only a verdict (labels + scores).
 *
 * It never sends message text anywhere. The only network requests it makes are
 * one-time downloads of the public model weights and runtime (cached by the
 * browser afterwards). No API keys, no moderation server, no telemetry.
 * Anyone can audit that by reading this file: there is no fetch() of user data.
 */

const TRANSFORMERS_URL =
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js';

// ── Layer 1: instant rules (0 MB, always on) ──────────────────────────────────

const PII_PATTERNS = [
  { label: 'email', re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i },
  // 7+ digit runs with optional separators — phone numbers.
  { label: 'phone', re: /(?:\+?\d[\s().-]?){7,}\d/ },
  // Stellar / generic crypto secret keys — never share these with anyone.
  { label: 'secret_key', re: /\bS[A-Z2-7]{55}\b/ },
  { label: 'seed_phrase', re: /\b(?:seed|recovery|mnemonic)\s+(?:phrase|words?)\b/i },
  { label: 'address', re: /\b\d{1,5}\s+\w+(?:\s\w+)?\s+(?:street|st|avenue|ave|road|rd|blvd|lane|ln|drive|dr)\b/i },
];

const SCAM_PATTERNS = [
  { label: 'scam', re: /\b(?:send|give)\s+(?:me\s+)?(?:your\s+)?(?:seed|private\s+key|secret\s+key|password|otp|2fa)\b/i },
  { label: 'scam', re: /\b(?:double|triple)\s+your\s+(?:crypto|xlm|btc|eth|money)\b/i },
  { label: 'link', re: /\bhttps?:\/\/(?:bit\.ly|tinyurl\.com|t\.co|cutt\.ly|grabify\.link|iplogger\.\w+)\//i },
];

// Requests aimed at the other person's age or a meetup combined with sexual
// language are the single biggest risk in anonymous chat. These patterns are
// deliberately conservative; the ML layer covers general toxicity.
const MINOR_SAFETY_PATTERNS = [
  /\b(?:how\s+old\s+are\s+you|asl|age\??)\b[\s\S]{0,80}\b(?:sexy|nudes?|naked|pics?|snap|meet)\b/i,
  /\b(?:nudes?|naked|pics?)\b[\s\S]{0,80}\b(?:1[0-7]|under\s*18|minor|young)\b/i,
  /\b(?:1[0-7])\s*(?:yo|y\/o|years?\s*old)\b[\s\S]{0,80}\b(?:sexy|nudes?|naked|horny)\b/i,
];

const THREAT_PATTERNS = [
  /\b(?:i(?:'ll|\s+will)|gonna|going\s+to)\s+(?:kill|hurt|find|dox|swat)\s+you\b/i,
  /\bkys\b|\bkill\s+yourself\b/i,
];

function runRules(text) {
  const labels = [];
  const pii = [];
  for (const p of PII_PATTERNS) if (p.re.test(text)) pii.push(p.label);
  for (const p of SCAM_PATTERNS) if (p.re.test(text)) labels.push({ label: p.label, score: 0.9 });
  if (MINOR_SAFETY_PATTERNS.some((re) => re.test(text)))
    labels.push({ label: 'minor_safety', score: 1 });
  if (THREAT_PATTERNS.some((re) => re.test(text)))
    labels.push({ label: 'threat', score: 0.95 });
  return { labels, pii };
}

// ── Layer 2: on-device ML (opt-in download, cached) ───────────────────────────

let classifierPromise = null;
let modelId = 'Xenova/toxic-bert';

function loadClassifier() {
  if (classifierPromise) return classifierPromise;
  classifierPromise = (async () => {
    const { pipeline, env } = await import(TRANSFORMERS_URL);
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    const progress = (p) => {
      if (p && p.status === 'progress' && typeof p.progress === 'number') {
        self.postMessage({ type: 'status', status: 'loading', progress: p.progress / 100 });
      }
    };
    let clf;
    try {
      clf = await pipeline('text-classification', modelId, {
        device: 'webgpu',
        dtype: 'q8',
        progress_callback: progress,
      });
    } catch {
      clf = await pipeline('text-classification', modelId, {
        dtype: 'q8',
        progress_callback: progress,
      });
    }
    self.postMessage({ type: 'status', status: 'ready', progress: 1 });
    return clf;
  })().catch((err) => {
    classifierPromise = null;
    self.postMessage({ type: 'status', status: 'error', error: String(err && err.message || err) });
    return null;
  });
  return classifierPromise;
}

async function runModel(text) {
  if (!classifierPromise) return [];
  const clf = await classifierPromise;
  if (!clf) return [];
  // toxic-bert is multi-label; top_k:null returns a sigmoid score for every label.
  const out = await clf(text.slice(0, 1000), { top_k: null });
  const list = Array.isArray(out[0]) ? out[0] : out;
  return list.map((r) => ({ label: r.label, score: r.score }));
}

// ── Policy ────────────────────────────────────────────────────────────────────

const SEVERE = new Set(['severe_toxic', 'threat', 'identity_hate', 'minor_safety']);
const ML_THRESHOLD = 0.8;

function decide(ruleLabels, mlLabels, pii) {
  const flagged = [
    ...ruleLabels,
    ...mlLabels.filter((l) => l.score >= (SEVERE.has(l.label) ? 0.5 : ML_THRESHOLD)),
  ];
  // "toxic" is the umbrella label; only surface it if nothing more specific fired.
  const specific = flagged.filter((l) => l.label !== 'toxic');
  const labels = specific.length ? specific : flagged;
  const severe = labels.some((l) => SEVERE.has(l.label));
  let action = 'allow';
  if (labels.length) action = severe ? 'block' : 'warn';
  return { action, severe, labels, pii };
}

self.onmessage = async (e) => {
  const msg = e.data || {};
  if (msg.type === 'init') {
    if (msg.modelId) modelId = msg.modelId;
    if (msg.useML) loadClassifier();
    else self.postMessage({ type: 'status', status: 'rules-only', progress: 0 });
    return;
  }
  if (msg.type === 'classify') {
    const text = String(msg.text || '');
    try {
      const { labels: ruleLabels, pii } = runRules(text);
      const mlLabels = await runModel(text).catch(() => []);
      self.postMessage({ type: 'result', id: msg.id, verdict: decide(ruleLabels, mlLabels, pii) });
    } catch (err) {
      self.postMessage({
        type: 'result',
        id: msg.id,
        verdict: { action: 'allow', severe: false, labels: [], pii: [], error: String(err) },
      });
    }
  }
};
