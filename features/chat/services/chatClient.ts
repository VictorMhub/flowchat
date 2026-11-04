import type { ChatMessage } from "../types/chat.types";

// A API retorna texto puro em streaming.

export async function streamChat(
  messages: ChatMessage[],
  signal: AbortSignal,
  onChunk: (chunk: string) => void,
  conversationId: string | null,
): Promise<string> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages, conversationId }),
    signal,
  });

  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);

    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "Não foi possível gerar a resposta.";

    throw new Error(message);
  }

  if (!response.body) {
    throw new Error("Resposta sem streaming.");
  }

  type ChatEvent =
    | { type: "chunk"; content: string }
    | { type: "done"; conversationId: string }
    | { type: "error"; error: string };

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let savedConversationId: string | null = null;

  function processLine(line: string) {
    if (!line.trim()) return;

    const event = JSON.parse(line) as ChatEvent;

    if (event.type === "chunk") {
      onChunk(event.content);
    } else if (event.type === "done") {
      savedConversationId = event.conversationId;
    } else if (event.type === "error") {
      throw new Error(event.error);
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        processLine(line);
      }
    }

    buffer += decoder.decode();

    if (buffer.trim()) {
      processLine(buffer);
    }

    if (!savedConversationId) {
      throw new Error(
        "A geração terminou sem confirmação de salvamento.",
      );
    }

    return savedConversationId;
  } finally {
    reader.releaseLock();
  }
}


export type EditMessageResult = {
  conversationId: string;
  messageId: string;
  content: string;
  assistant: {
    id: string;
    role: "assistant";
    content: string;
  };
};

type EditStreamEvent =
  | {
      type: "chunk";
      content: string;
    }
  | ({
      type: "done";
    } & EditMessageResult)
  | {
      type: "error";
      error: string;
    };

export async function editChatMessage(
  conversationId: string,
  messageId: string,
  content: string,
  signal: AbortSignal,
  onChunk: (chunk: string) => void,
): Promise<EditMessageResult> {
  const response = await fetch(
    `/api/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/edit`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
      signal,
    },
  );

  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);

    const error =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "Não foi possível editar a mensagem.";

    throw new Error(error);
  }

  if (!response.body) {
    throw new Error("Resposta sem streaming.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let result: EditMessageResult | null = null;

  function processLine(line: string) {
    if (!line.trim()) return;

    const event = JSON.parse(line) as EditStreamEvent;

    if (event.type === "chunk") {
      onChunk(event.content);
      return;
    }

    if (event.type === "error") {
      throw new Error(event.error);
    }

    if (event.type === "done") {
      result = {
        conversationId: event.conversationId,
        messageId: event.messageId,
        content: event.content,
        assistant: event.assistant,
      };
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, {
        stream: true,
      });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        processLine(line);
      }
    }

    buffer += decoder.decode();

    if (buffer.trim()) {
      processLine(buffer);
    }

    if (!result) {
      throw new Error("A edição terminou sem confirmação de salvamento.");
    }

    return result;
  } finally {
    reader.releaseLock();
  }
}
