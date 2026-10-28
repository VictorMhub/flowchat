import type { ChatMessage } from "../types/chat.types";

// A API retorna texto puro em streaming.
export async function streamChat(
  messages: ChatMessage[],
  signal: AbortSignal,
  onChunk: (chunk: string) => void,
  conversationId: string | null,
): Promise<Response> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      conversationId,
    }),
    signal,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Erro da API:", response.status, error);
    throw new Error(`API ${response.status}: ${error}`);
  }

  if (!response.body) {
    throw new Error("Resposta sem streaming.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      onChunk(decoder.decode(value, { stream: true }));
    }

    const remaining = decoder.decode();

    if (remaining) {
      onChunk(remaining);
    }

    return response;
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
