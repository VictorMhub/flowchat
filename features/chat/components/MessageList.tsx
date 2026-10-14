"use client";

import { useEffect, useRef } from "react";
import { MessageItem } from "./MessageItem";
import type { ChatMessage } from "../types/chat.types";

type Props = {
  messages: ChatMessage[];
}

export function MessageList({ messages}:Props) {
  const bottomRef = useRef<HTMLDivElement>
  (null);
  
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    })
  }, [messages]);

  return (
  <main 
  arial-label="Messagens do chat" className="flex-1 space-y-4- overflow-y-auto">
    {messages.map((message, index) => (
      <MessageItem key={index} message={message} />
    ))}
    <div ref={bottomRef} />
  </main>
)
}

