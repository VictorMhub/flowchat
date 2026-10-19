
"use client";

import { MessageList } from "./MessageList";
import { ChatComposer } from "./ChatComposer";
import { ChatSidebar } from "./ChatSidebar";
import { useChat } from "../hooks/useChat";

export function ChatContainer() {
  const {
    messages,
    status,
    error,
    conversationId,
    conversations,
    loadingHistory,
    sendMessage,
    stopGeneration,
    selectConversation,
    newConversation,
  } = useChat();

  return (
    <section className="flex h-dvh min-h-0">
      <ChatSidebar
        conversations={conversations}
        activeId={conversationId}
        loading={loadingHistory}
        onSelect={selectConversation}
        onNewChat={newConversation}
      />

      <div className="mx-auto flex min-h-0 min-w-0 max-w-3xl flex-1 flex-col p-4">
        <MessageList messages={messages} />

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
    </section>
  );
}
