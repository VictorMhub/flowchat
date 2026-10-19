
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
