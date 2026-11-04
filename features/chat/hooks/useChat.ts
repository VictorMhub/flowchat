"use client";

import { useRef, useState, useEffect } from "react";
import { editChatMessage, streamChat } from "../services/chatClient";
import type { ChatMessage, ChatStatus } from "../types/chat.types";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const conversationIdRef = useRef<string | null>(null);
  const [conversations, setConversations] = useState<
    { id: string; title: string }[]
  >([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const historyVersionRef = useRef(0);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  function updateMessages(nextMessages: ChatMessage[]) {
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
  }

  

async function sendMessage(content: string) {
  const cleanContent = content.trim();

  if (!cleanContent || controllerRef.current) return;

  const controller = new AbortController();
  controllerRef.current = controller;

  const currentConversationId = conversationIdRef.current;

  const userMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: "user",
    content: cleanContent,
  };

  const assistantMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: "",
  };

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
        if (controller.signal.aborted) return;

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
      currentConversationId,
    );

    if (controller.signal.aborted) return;

    const savedConversationId =
      response.headers.get("X-Conversation-Id");

    if (!savedConversationId) {
      throw new Error("A API não retornou o ID da conversa.");
    }

    conversationIdRef.current = savedConversationId;
    setConversationId(savedConversationId);

    const historyResponse = await fetch(
      `/api/conversations/${encodeURIComponent(savedConversationId)}`,
      { cache: "no-store" },
    );

    if (!historyResponse.ok) {
      throw new Error(
        "Não foi possível sincronizar o histórico.",
      );
    }

    const savedConversation = (await historyResponse.json()) as {
      id: string;
      messages: ChatMessage[];
    };

    if (controller.signal.aborted) return;

    updateMessages(savedConversation.messages);
    void loadConversations();
  } catch (err) {
    if (!controller.signal.aborted) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro inesperado.",
      );
      setStatus("error");
    }
  } finally {
    if (controller.signal.aborted) {
      // Remove somente o placeholder vazio desta geração.
      updateMessages(
        messagesRef.current.filter(
          (message) =>
            message.id !== assistantMessage.id ||
            message.content.trim().length > 0,
        ),
      );
    }

    controllerRef.current = null;

    if (controller.signal.aborted) {
      setStatus("idle");
    } else {
      setStatus((current) =>
        current === "streaming" ? "idle" : current,
      );
    }
  }
}


  function stopGeneration() {
    controllerRef.current?.abort();
  }

  async function loadConversations() {
    const version = historyVersionRef.current;

    try {
      setLoadingHistory(true);

      const response = await fetch("/api/conversations", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Erro ao carregar histórico.");
      }

      const data = await response.json();

      if (version === historyVersionRef.current) {
        setConversations(data);
      }
    } catch (error) {
      if (version === historyVersionRef.current) {
        setError(error instanceof Error ? error.message : "Erro inesperado.");
      }
    } finally {
      setLoadingHistory(false);
    }
  }

  async function selectConversation(id: string) {
    if (controllerRef.current) return;

    try {
      setLoadingHistory(true);
      setError(null);

      const response = await fetch(`/api/conversations/${id}`);

      if (!response.ok) {
        throw new Error("Erro ao abrir conversa.");
      }

      const data = await response.json();

      updateMessages(data.messages);
      conversationIdRef.current = data.id;
      setConversationId(data.id);
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoadingHistory(false);
    }
  }

  function newConversation() {
    if (controllerRef.current) return;
    updateMessages([]);
    conversationIdRef.current = null;
    setConversationId(null);
    setError(null);
    setStatus("idle");
  }

  async function deleteConversation(id: string) {
    if (controllerRef.current || deletingId !== null) return;

    setDeletingId(id);
    setError(null);

    try {
      const response = await fetch(
        `/api/conversations/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        },
      );
      if (!response.ok) {
        throw new Error("Não foi possível excluir a conversa.");
      }

      // Remove imediatamente a conversa da sidebar.
      historyVersionRef.current += 1;
      setConversations((previous) =>
        previous.filter((conversation) => conversation.id !== id),
      );

      // Se a conversa excluída estiver aberta, limpa o chat.

      if (conversationIdRef.current === id) {
        updateMessages([]);
        conversationIdRef.current = null;
        setConversationId(null);
        setStatus("idle");
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao ecluir conversa",
      );
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    void loadConversations();
  }, []);

  async function renameConversation(
    id: string,
    title: string,
  ): Promise<boolean> {
    const cleanTitle = title.trim();

    if (
      !cleanTitle ||
      cleanTitle.length > 100 ||
      renamingId !== null ||
      deletingId !== null ||
      controllerRef.current
    ) {
      return false;
    }

    setRenamingId(id);
    setError(null);

    try {
      const response = await fetch(
        `/api/conversations/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: cleanTitle,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Não foi possível renomear a conversa.");
      }

      historyVersionRef.current += 1;

      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id === id
            ? { ...conversation, title: cleanTitle }
            : conversation,
        ),
      );

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");

      return false;
    } finally {
      setRenamingId(null);
    }
  }

  

async function editMessage(
  messageId: string,
  content: string,
): Promise<boolean> {
  const cleanContent = content.trim();
  const currentConversationId = conversationIdRef.current;

  if (
    !currentConversationId ||
    !cleanContent ||
    cleanContent.length > 10000 ||
    controllerRef.current ||
    editingMessageId !== null
  ) {
    return false;
  }

  const currentMessages = messagesRef.current;
  const messageIndex = currentMessages.findIndex(
    (message) => message.id === messageId,
  );

  if (
    messageIndex === -1 ||
    currentMessages[messageIndex].role !== "user"
  ) {
    return false;
  }

  const previousMessages = currentMessages.slice();
  const controller = new AbortController();

  const assistantId = crypto.randomUUID();

  const editedMessage: ChatMessage = {
    ...currentMessages[messageIndex],
    content: cleanContent,
  };

  const assistantMessage: ChatMessage = {
    id: assistantId,
    role: "assistant",
    content: "",
  };

  controllerRef.current = controller;
  setEditingMessageId(messageId);
  setStatus("streaming");
  setError(null);

  // Atualização otimista: a edição aparece imediatamente.
  updateMessages([
    ...currentMessages.slice(0, messageIndex),
    editedMessage,
    assistantMessage,
  ]);

  try {
    const result = await editChatMessage(
      currentConversationId,
      messageId,
      cleanContent,
      controller.signal,
      (chunk) => {
        if (
          controller.signal.aborted ||
          conversationIdRef.current !== currentConversationId
        ) {
          return;
        }

        updateMessages(
          messagesRef.current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: message.content + chunk,
                }
              : message,
          ),
        );
      },
    );

    if (conversationIdRef.current !== currentConversationId) {
      return false;
    }

    // Substitui o ID temporário pelo ID salvo no banco.
    updateMessages(
      messagesRef.current.map((message) =>
        message.id === assistantId
          ? {
              id: result.assistant.id,
              role: "assistant",
              content: result.assistant.content,
            }
          : message,
      ),
    );

    setStatus("idle");
    void loadConversations();

    return true;
  } catch (err) {
    // Se a geração ou o salvamento falhar,
    // restaura o histórico anterior.
    if (conversationIdRef.current === currentConversationId) {
      updateMessages(previousMessages);
    }

    if (controller.signal.aborted) {
      setStatus("idle");
    } else {
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível editar a mensagem.",
      );
    }

    return false;
  } finally {
    controllerRef.current = null;
    setEditingMessageId(null);
  }
}



  return {
    messages,
    status,
    error,
    conversationId,
    conversations,
    loadingHistory,
    deletingId,
    sendMessage,
    stopGeneration,
    selectConversation,
    newConversation,
    deleteConversation,
    renamingId,
    renameConversation,
    editingMessageId,
    editMessage,
  };
}
