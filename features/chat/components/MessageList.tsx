"use client";

import { useEffect, useRef, useLayoutEffect } from "react";
import { MessageItem } from "./MessageItem";
import type { ChatMessage } from "../types/chat.types";

type Props = {
  messages: ChatMessage[];
  isStreaming?: boolean;
};

const BOTTOM_THRESHOLD = 120;

export function MessageList({ messages }: Props, isStreaming = false) {
  const containerRef = useRef<HTMLElement>(null);
  const shouldAutoScrollRef = useRef(true);

  function handleScroll() {
    const container = containerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    shouldAutoScrollRef.current = distanceFromBottom < BOTTOM_THRESHOLD;
  }

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !shouldAutoScrollRef.current) return;

    container.scrollTop = container.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (shouldAutoScrollRef.current) {
        container.scrollTop = container.scrollHeight;
      }
    });

    const content = container.firstElementChild;

    if (content) {
      observer.observe(content);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      aria-label="Mensagens do chat"
      className="min-h-0 flex-1 overflow-y-auto"
      ref={containerRef}
      onScroll={handleScroll}
    >
      {messages.length === 0 ? (
        <div className="flex min-h-full flex-col items-center justify-center px-4 py-12 text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold text-white shadow-sm">
            F
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">
            Como posso ajudar?
          </h2>

          <p className="mt-3 max-w-md text-sm leading-6 text-gray-500">
            Bem-vindo ao Flowchat. Faça uma pergunta, explore uma ideia ou peça
            ajuda com seu código.
          </p>
        </div>
      ) : (
        <div className="space-y-4 pb-4">
          {messages.map((message, index) => (
            <MessageItem
              key={message.id}
              message={message}
              isStreaming={
                isStreaming &&
                index === messages.length - 1 &&
                message.role === "assistant"
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
