import { NextRequest, NextResponse } from 'next/server';

/* ─────────────────────────────────────────────────────────────────────────────
   /api/contact  — server-side contact form handler
   
   Currently stores submissions in memory / logs them (no external mailer
   configured). To wire up a real email service (e.g. Resend, SendGrid,
   Nodemailer), replace the TODO section below with your preferred SDK call.
   
   Environment variables you can add to .env.local:
     CONTACT_TO_EMAIL  — recipient address (defaults to maintainer placeholder)
     RESEND_API_KEY    — if using Resend
───────────────────────────────────────────────────────────────────────────── */

interface ContactPayload {
  name: string;
  email: string;
  topic: string;
  message: string;
}

/** Basic server-side sanitisation */
function sanitise(str: unknown, maxLen: number): string {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen);
}

function isValidEmail(email: string): boolean {
  // RFC-5321 practical check — no external library required
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** Rate-limit: cap at 5 requests per IP per minute (in-memory, resets on cold start) */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  // ── Rate limit ──────────────────────────────────────────────────────────
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a minute and try again.' },
      { status: 429 },
    );
  }

  // ── Parse & validate ────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;

  const payload: ContactPayload = {
    name: sanitise(raw.name, 100),
    email: sanitise(raw.email, 254),
    topic: sanitise(raw.topic, 80),
    message: sanitise(raw.message, 3000),
  };

  if (!payload.name || payload.name.length < 2) {
    return NextResponse.json({ error: 'Name must be at least 2 characters.' }, { status: 422 });
  }
  if (!isValidEmail(payload.email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 422 });
  }
  if (!payload.topic) {
    return NextResponse.json({ error: 'Please select a topic.' }, { status: 422 });
  }
  if (!payload.message || payload.message.length < 20) {
    return NextResponse.json(
      { error: 'Message must be at least 20 characters.' },
      { status: 422 },
    );
  }

  // ── TODO: send email ─────────────────────────────────────────────────────
  // Replace this block with your preferred mailer. Example using Resend:
  //
  //   import { Resend } from 'resend';
  //   const resend = new Resend(process.env.RESEND_API_KEY);
  //   await resend.emails.send({
  //     from:    'dMessage Contact <noreply@yourdomain.com>',
  //     to:      process.env.CONTACT_TO_EMAIL ?? 'richiechristiandeguzman11@gmail.com',
  //     subject: `[dMessage] ${payload.topic} from ${payload.name}`,
  //     replyTo: payload.email,
  //     text:    `Name: ${payload.name}\nEmail: ${payload.email}\nTopic: ${payload.topic}\n\n${payload.message}`,
  //   });
  //
  // Until then, log to stdout so submissions are visible in Vercel logs:
  console.log('[contact-form]', {
    name: payload.name,
    email: payload.email,
    topic: payload.topic,
    messageLength: payload.message.length,
    ip,
    ts: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
