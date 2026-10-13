import type { ChatMessage} from "../types/chat.types";

//O cliente pressupõe que /api/chat retorna texto puro em streaming, não eventos SSE ou JSON.
export async function streamChat(messages: ChatMessage[], signal: AbortSignal, onChunk: (chunk:string) => void) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
    signal,
  });

  if(!response.ok || !response.body){
    throw new Error("Falha ao conectar com a IA.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while(true) {
      const {done, value} = await reader.read();

      if (done) break;

      onChunk(decoder.decode(value, {stream:true}));
    }
    const remaining = decoder.decode();

    if (remaining) onChunk(remaining);
  }finally{
    reader.releaseLock();
  }
}