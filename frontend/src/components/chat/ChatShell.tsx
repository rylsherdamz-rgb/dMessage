'use client';

import { type ReactNode, useState } from 'react';
import { Menu } from 'lucide-react';
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

  return (
    <div className="flex h-screen flex-col">
      <Nav />
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-80 -translate-x-full border-r-2 border-[var(--border-strong)] bg-[var(--bg-surface)] transition-transform duration-200 md:relative md:z-auto md:flex md:w-80 md:translate-x-0 lg:w-96 ${
            sidebarOpen ? 'translate-x-0' : ''
          }`}
        >
          <div className="flex h-full flex-col overflow-hidden pt-14 md:pt-0">
            <ConversationSidebar activeId={activeId} />
          </div>
        </aside>
        <main id="main-content" className="flex min-w-0 flex-1 flex-col">
          {/* Mobile hamburger + back */}
          <div className="flex items-center border-b-2 border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 md:hidden">
            {activeId ? (
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Open conversations"
                className="flex h-9 w-9 items-center justify-center text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
              >
                <Menu className="h-5 w-5" strokeWidth={2} />
              </button>
            ) : (
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Open conversations"
                className="flex h-9 w-9 items-center justify-center text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
              >
                <Menu className="h-5 w-5" strokeWidth={2} />
              </button>
            )}
            <h1 className="ml-2 font-mono text-sm font-black tracking-tight text-[var(--text)]">
              dMessage
            </h1>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
