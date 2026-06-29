'use client';

import type { ReactNode } from 'react';
import { Nav } from '@/components/layout/Nav';
import { ConversationSidebar } from './ConversationSidebar';

/**
 * Messenger/Discord-style two-pane layout: a conversation sidebar (chat heads)
 * + the active conversation. On mobile, shows the sidebar when no chat is
 * selected, and the chat when one is open.
 */
export function ChatShell({
  activeId,
  children,
}: {
  activeId?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col">
      <Nav />
      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`w-full flex-none flex-col border-r-2 border-[var(--border-strong)] transition-all duration-200 md:flex md:w-80 lg:w-96 ${
            activeId ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="flex h-full flex-col overflow-hidden">
            <ConversationSidebar activeId={activeId} />
          </div>
        </aside>
        <main
          className={`min-w-0 flex-1 flex-col transition-all duration-200 ${
            activeId ? 'flex' : 'hidden md:flex'
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
