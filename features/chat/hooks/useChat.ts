
"use client";

import { useRef, useState } from "react";
import { streamChat } from "../services/chatClient";
import type {
  ChatMessage,
  ChatStatus,
} from "../types/chat.types";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  async function sendMessage(content: string) {
    if (!content.trim() || controllerRef.current) return;

    const controller = new AbortController();
    controllerRef.current = controller;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
    };

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
    };

    const history = [...messagesRef.current, userMessage];

    messagesRef.current = [...history, assistantMessage];
    setMessages(messagesRef.current);
    setStatus("streaming");
    setError(null);

    try {
      await streamChat(
        history,
        controller.signal,
        (chunk) => {
          messagesRef.current = messagesRef.current.map((message) =>
            message.id === assistantMessage.id
              ? { ...message, content: message.content + chunk }
              : message
          );

          setMessages(messagesRef.current);
        }
      );

      setStatus("idle");
    } catch (err) {
      if (controller.signal.aborted) {
        setStatus("idle");
      } else {
        setError(
          err instanceof Error ? err.message : "Erro inesperado."
        );
        setStatus("error");
      }
    } finally {
      controllerRef.current = null;
    }
  }

  function stopGeneration() {
    controllerRef.current?.abort();
  }

  return {
    messages,
    status,
    error,
    sendMessage,
    stopGeneration,
  };
}
