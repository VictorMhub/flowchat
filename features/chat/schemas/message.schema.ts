import { z } from "zod";

export const messageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(10000),
});

export const chatRequestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(30),
   conversationId: z.string().cuid().nullish(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;