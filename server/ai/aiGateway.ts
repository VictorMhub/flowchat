import "server-only";

import { GoogleGenAI } from "@google/genai";
import type { ChatMessage } from "@/features/chat/types/chat.types";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY não configurada.");
}

const ai = new GoogleGenAI({ apiKey });

export async function generateChatStream(
  messages: ChatMessage[],
  signal?: AbortSignal,
) {
  const contents = messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  const response = await ai.models.generateContentStream({
    model: "gemini-3.5-flash-lite",
    contents,
    config: {
      systemInstruction:
        "Você é um assistente de IA útil, claro e objetivo. Responda em português brasileiro.",
      temperature: 0.7,
      maxOutputTokens: 2048,
      abortSignal: signal,
    },
  });

  return response;
}