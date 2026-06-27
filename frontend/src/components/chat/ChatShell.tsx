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
          className={`w-full flex-col border-r-2 border-[var(--border-strong)] md:flex md:w-80 lg:w-96 ${
            activeId ? 'hidden md:flex' : 'flex'
          }`}
        >
          <ConversationSidebar activeId={activeId} />
        </aside>
        <main className={`flex-1 flex-col ${activeId ? 'flex' : 'hidden md:flex'}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
