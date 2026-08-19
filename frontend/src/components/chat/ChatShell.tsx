'use client';

import { type ReactNode, useState, useEffect } from 'react';
import { Menu, ArrowLeft } from 'lucide-react';
import { Nav } from '@/components/layout/Nav';
import { ConversationSidebar } from './ConversationSidebar';

export function ChatShell({
  activeId,
  children,
}: {
  activeId?: string;
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (when activeId changes)
  useEffect(() => {
    setSidebarOpen(false);
  }, [activeId]);

  // Close sidebar on escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sidebarOpen]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  return (
    <div className="flex h-screen flex-col">
      <Nav />
      <div className="relative flex flex-1 overflow-hidden">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-40 w-[85vw] max-w-[320px] border-r-2 border-[var(--border-strong)] bg-[var(--bg-surface)] transition-transform duration-200 ease-out
            md:relative md:z-auto md:w-80 md:max-w-none md:translate-x-0
            lg:w-96
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <div className="flex h-full flex-col overflow-hidden pt-14 md:pt-0">
            <ConversationSidebar activeId={activeId} />
          </div>
        </aside>

        {/* Main content */}
        <main id="main-content" className="flex min-w-0 flex-1 flex-col">
          {/* Mobile header bar */}
          <div className="flex items-center gap-2 border-b-2 border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2.5 md:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open conversations"
              className="flex h-10 w-10 items-center justify-center rounded-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--accent)] active:scale-95"
            >
              {activeId ? (
                <ArrowLeft className="h-5 w-5" strokeWidth={2} />
              ) : (
                <Menu className="h-5 w-5" strokeWidth={2} />
              )}
            </button>
            <h1 className="font-mono text-sm font-black tracking-tight text-[var(--text)]">
              dMessage
            </h1>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
