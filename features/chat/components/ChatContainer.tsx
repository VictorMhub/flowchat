"use client";

import { useState } from "react";
import { MessageList } from "./MessageList";
import { ChatComposer } from "./ChatComposer";
import { ChatSidebar } from "./ChatSidebar";
import { useChat } from "../hooks/useChat";

export function ChatContainer() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
  messages,
  status,
  error,
  conversationId,
  conversations,
  loadingHistory,
  deletingId,
  renamingId,
  sendMessage,
  stopGeneration,
  selectConversation,
  newConversation,
  deleteConversation,
  renameConversation,
  editingMessageId,
  editMessage,
} = useChat();

  return (
    <section className="flex h-full min-h-0 overflow-hidden">
      <ChatSidebar
        conversations={conversations}
        activeId={conversationId}
        loading={loadingHistory}
        deletingId={deletingId}
        renamingId={renamingId}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSelect={selectConversation}
        onNewChat={newConversation}
        onDelete={deleteConversation}
        onRename={renameConversation}
      />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Cabeçalho móvel */}
        <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3 md:hidden">
          <button
            type="button"
            aria-label="Abrir histórico"
            aria-controls="chat-sidebar"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            ☰
          </button>

          <h1 className="font-semibold">Flowchat</h1>
        </header>

        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col p-4">
          <MessageList
            messages={messages}
            isStreaming={status === "streaming"}
            editingMessageId={editingMessageId}
            onEditMessage={editMessage}
          />

          {error && (
            <p role="alert" className="py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <ChatComposer
            onSend={sendMessage}
            onStop={stopGeneration}
            isStreaming={status === "streaming"}
          />
        </div>
      </main>
    </section>
  );
}
