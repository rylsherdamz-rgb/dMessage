'use client';

import { useState, useRef } from 'react';
import { Reveal } from './Reveal';
import { Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

type Status = 'idle' | 'loading' | 'success' | 'error';

const TOPICS = [
  'General enquiry',
  'Bug report',
  'Feature request',
  'Privacy / data concern',
  'Press / media',
  'Partnership',
  'Other',
];

export function ContactForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    const data = new FormData(e.currentTarget);
    const payload = {
      name: (data.get('name') as string).trim(),
      email: (data.get('email') as string).trim(),
      topic: data.get('topic') as string,
      message: (data.get('message') as string).trim(),
    };

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? 'Something went wrong. Please try again.');
      }

      setStatus('success');
      formRef.current?.reset();
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Unexpected error.');
    }
  }

  return (
    <section className="relative w-full border-b-2 border-[var(--border-strong)] bg-[var(--bg-inset)]">
      <div className="mx-auto w-full max-w-6xl px-6 py-24 md:py-32">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
          {/* ── Left: intro copy ── */}
          <div>
            <Reveal>
              <div className="flex items-center gap-3">
                <span className="status-dot bg-[var(--accent)] text-[var(--accent)]" />
                <span className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
                  Contact us
                </span>
              </div>
              <h1 className="mt-5 font-mono text-[var(--text-2xl)] font-black leading-[0.95] tracking-tight text-[var(--text)]">
                Get in touch.
                <br />
                <span className="text-stroke-accent">We read every message.</span>
              </h1>
              <p className="mt-8 font-mono text-sm leading-relaxed text-[var(--text-muted)]">
                Have a question, found a bug, or want to collaborate? Use the form and we&apos;ll
                reply as soon as possible — usually within 48 hours on business days.
              </p>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="mt-10 flex flex-col gap-px overflow-hidden border-2 border-[var(--border-strong)] bg-[var(--border-strong)]">
                {[
                  {
                    label: 'Email',
                    value: 'richiechristiandeguzman11@gmail.com',
                    href: 'mailto:richiechristiandeguzman11@gmail.com',
                    accent: 'var(--accent)',
                  },
                  {
                    label: 'Twitter / X',
                    value: '@ChichiCode0',
                    href: 'https://x.com/ChichiCode0',
                    accent: 'var(--cyan)',
                  },
                  {
                    label: 'Bug reports',
                    value: 'GitHub Issues',
                    href: 'https://github.com/rylsherdamz-rgb/dMessage/issues',
                    accent: 'var(--violet)',
                  },
                  {
                    label: 'Security vulnerabilities',
                    value: 'Email maintainers (see security policy)',
                    href: 'https://github.com/rylsherdamz-rgb/dMessage/security',
                    accent: 'var(--amber)',
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex flex-col gap-1 bg-[var(--bg-surface)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-faint)]">
                      {row.label}
                    </span>
                    <a
                      href={row.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs transition-colors hover:underline"
                      style={{ color: row.accent }}
                    >
                      {row.value}
                    </a>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          {/* ── Right: form ── */}
          <Reveal delay={0.12}>
            {status === 'success' ? (
              <div className="brutal flex h-full min-h-[440px] flex-col items-center justify-center gap-6 bg-[var(--bg-surface)] p-10 text-center">
                <CheckCircle2
                  className="h-12 w-12 text-[var(--accent)]"
                  strokeWidth={1.5}
                  aria-hidden
                />
                <div>
                  <h2 className="font-mono text-lg font-black tracking-tight text-[var(--text)]">
                    Message sent!
                  </h2>
                  <p className="mt-3 font-mono text-xs leading-relaxed text-[var(--text-muted)]">
                    Thanks for reaching out. We&apos;ll get back to you within 48 hours on business
                    days.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStatus('idle')}
                  className="brutal mt-2 border-2 border-[var(--accent)] bg-transparent px-6 py-2.5 font-mono text-xs font-black uppercase tracking-[0.2em] text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-black"
                >
                  Send another
                </button>
              </div>
            ) : (
              <form
                ref={formRef}
                onSubmit={handleSubmit}
                noValidate
                className="brutal flex flex-col gap-5 bg-[var(--bg-surface)] p-8"
                aria-label="Contact form"
              >
                {/* Name */}
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="contact-name"
                    className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-faint)]"
                  >
                    Name <span aria-hidden>*</span>
                  </label>
                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    autoComplete="name"
                    placeholder="Satoshi Nakamoto"
                    className="border-2 border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 py-3 font-mono text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none transition-colors focus:border-[var(--accent)]"
                  />
                </div>

                {/* Email */}
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="contact-email"
                    className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-faint)]"
                  >
                    Email <span aria-hidden>*</span>
                  </label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="border-2 border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 py-3 font-mono text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none transition-colors focus:border-[var(--accent)]"
                  />
                </div>

                {/* Topic */}
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="contact-topic"
                    className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-faint)]"
                  >
                    Topic <span aria-hidden>*</span>
                  </label>
                  <select
                    id="contact-topic"
                    name="topic"
                    required
                    defaultValue=""
                    className="border-2 border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 py-3 font-mono text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
                  >
                    <option value="" disabled>
                      Select a topic…
                    </option>
                    {TOPICS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Message */}
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="contact-message"
                    className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-faint)]"
                  >
                    Message <span aria-hidden>*</span>
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    required
                    minLength={20}
                    maxLength={3000}
                    rows={6}
                    placeholder="Tell us what's on your mind…"
                    className="resize-y border-2 border-[var(--border-strong)] bg-[var(--bg-elevated)] px-4 py-3 font-mono text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none transition-colors focus:border-[var(--accent)]"
                  />
                </div>

                {/* Error banner */}
                {status === 'error' && (
                  <div
                    role="alert"
                    className="flex items-center gap-3 border-2 border-[var(--danger)] bg-[var(--bg-elevated)] px-4 py-3"
                  >
                    <AlertCircle
                      className="h-4 w-4 shrink-0 text-[var(--danger)]"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <p className="font-mono text-xs text-[var(--danger)]">{errorMsg}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="brutal mt-1 flex items-center justify-center gap-2 border-2 border-[var(--accent)] bg-[var(--accent)] px-6 py-3 font-mono text-sm font-black uppercase tracking-[0.2em] text-black transition-all hover:bg-transparent hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" aria-hidden />
                      Send message
                    </>
                  )}
                </button>

                <p className="font-mono text-[10px] leading-relaxed text-[var(--text-faint)]">
                  By submitting this form you agree that your details may be used to respond to your
                  enquiry. We do not sell or share your personal data with third parties.
                </p>
              </form>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
