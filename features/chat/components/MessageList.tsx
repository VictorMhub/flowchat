"use client";

import { useEffect, useRef, useLayoutEffect } from "react";
import { MessageItem } from "./MessageItem";
import type { ChatMessage } from "../types/chat.types";

type Props = {
  messages: ChatMessage[];
};

const BOTTOM_THRESHOLD = 120;

export function MessageList({ messages }: Props) {
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
    if (content) observer.observe(content);

    return () => observer.disconnect();
  }, []);

  return (
    <main
      arial-label="Messagens do chat"
      className="min-h-0 flex-1 overflow-y-auto"
      ref={containerRef}
      onScroll={handleScroll}
    >
      <div className="space-y-4 pb-4">
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}
      </div>
    </main>
  );
}