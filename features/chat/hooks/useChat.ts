
"use client";

import { useRef, useState } from "react";
import { streamChat } from "../services/chatClient";
import type { ChatMessage, ChatStatus } from "../types/chat.types";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const conversationIdRef = useRef<string | null>(null);

  function updateMessages(nextMessages: ChatMessage[]) {
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
  }

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

    // Não envia mensagens vazias ao backend.
    const previousMessages = messagesRef.current.filter(
      (message) => message.content.trim().length > 0,
    );

    const history = [...previousMessages, userMessage];

    updateMessages([...history, assistantMessage]);
    setStatus("streaming");
    setError(null);

    try {
      const response = await streamChat(
        history,
        controller.signal,
        (chunk) => {
          updateMessages(
            messagesRef.current.map((message) =>
              message.id === assistantMessage.id
                ? {
                    ...message,
                    content: message.content + chunk,
                  }
                : message,
            ),
          );
        },
        conversationIdRef.current,
      );

      const id = response.headers.get("X-Conversation-Id");

      if (id) {
        conversationIdRef.current = id;
        setConversationId(id);
      }

      setStatus("idle");
    } catch (err) {
      // Remove a resposta vazia ou incompleta após falha.
      updateMessages(
        messagesRef.current.filter(
          (message) => message.id !== assistantMessage.id,
        ),
      );

      if (controller.signal.aborted) {
        setStatus("idle");
      } else {
        setError(
          err instanceof Error ? err.message : "Erro inesperado.",
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
    conversationId,
    sendMessage,
    stopGeneration,
  };
}
