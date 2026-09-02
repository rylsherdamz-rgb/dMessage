import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

/* ─────────────────────────────────────────────────────────────────────────────
   /api/contact  — server-side contact form handler (Resend)
   
   Required environment variable:
     RESEND_API_KEY  — your Resend API key
   
   Optional:
     CONTACT_TO_EMAIL  — recipient address (defaults to maintainer email below)
───────────────────────────────────────────────────────────────────────────── */

const CONTACT_EMAIL = process.env.CONTACT_TO_EMAIL ?? 'richiechristiandeguzman11@gmail.com';

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

  // ── Send via Resend ─────────────────────────────────────────────────────
  if (!process.env.RESEND_API_KEY) {
    console.error('[contact-form] RESEND_API_KEY is not set');
    return NextResponse.json(
      { error: 'Email service is not configured. Please try again later.' },
      { status: 503 },
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: 'dMessage Contact <onboarding@resend.dev>',
    to: CONTACT_EMAIL,
    replyTo: payload.email,
    subject: `[dMessage] ${payload.topic} — from ${payload.name}`,
    html: `
      <div style="font-family:monospace;max-width:600px;margin:0 auto;padding:24px;background:#0d0d0d;color:#e5e5e5;border:2px solid #333;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
          <div style="width:16px;height:16px;background:#00ff88;flex-shrink:0;"></div>
          <strong style="font-size:18px;letter-spacing:-0.02em;">dMessage — Contact Form</strong>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tr>
            <td style="padding:8px 12px;background:#1a1a1a;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;border:1px solid #333;width:120px;">Name</td>
            <td style="padding:8px 12px;background:#111;font-size:13px;border:1px solid #333;">${payload.name}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#1a1a1a;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;border:1px solid #333;">Email</td>
            <td style="padding:8px 12px;background:#111;font-size:13px;border:1px solid #333;"><a href="mailto:${payload.email}" style="color:#00ff88;">${payload.email}</a></td>
          </tr>
          <tr>
            <td style="padding:8px 12px;background:#1a1a1a;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;border:1px solid #333;">Topic</td>
            <td style="padding:8px 12px;background:#111;font-size:13px;border:1px solid #333;">${payload.topic}</td>
          </tr>
        </table>

        <div style="background:#111;border:1px solid #333;padding:16px;">
          <p style="margin:0 0 8px;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.2em;">Message</p>
          <p style="margin:0;font-size:13px;line-height:1.7;white-space:pre-wrap;">${payload.message}</p>
        </div>

        <p style="margin-top:24px;font-size:10px;color:#555;text-transform:uppercase;letter-spacing:0.2em;">
          Sent via dmessage.vercel.app · Reply-To is set to the sender's email
        </p>
      </div>
    `,
    text: `dMessage Contact Form\n\nName: ${payload.name}\nEmail: ${payload.email}\nTopic: ${payload.topic}\n\n${payload.message}\n\n---\nSent via dmessage.vercel.app`,
  });

  if (error) {
    console.error('[contact-form] Resend error:', error);
    return NextResponse.json(
      { error: 'Failed to send message. Please try again later.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
