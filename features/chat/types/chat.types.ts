export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

export type ChatStatus = "idle"  | "error" | "streaming";