"use client";

import { useState, type FormEvent } from "react"; 

import { useChat} from "../hooks/useChat";

export function ChatContainer() {
  const [input, setInput] = useState("");

  const { messages, status, error, sendMessage, stopGeneration} = useChat();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if(!input.trim() || status === "streaming") return;

    void sendMessage(input);
    setInput("");
  }

  return (
    <div className="mx-auto flex h-dvh max-w-3x1 flex-col p-4">
      <main arial-live="polite"
      className="flex-1 space-y-4 overflow-y-auto">
        {messages.map((message) => (
          <div
          key={message.id}
          className={message.role === "user" ? "ml-auto max-w-[85%] rounded-xl bg-blue-600 p-3 text-white" : "mr-auto max-w-[85%] rounded-xl bg-gray-100 p-3 text-gray-900"}>
            <p className="whitespace-pre-wrap">{message.content || "Gerando resposta..."}</p>
          </div>
        ))}
      </main>
      {error && (
        <p role="alert" className="py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 pt-4">
        <input 
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="Digite sua mensagem..."
        arial-label="Mensagem"
        className="min-w-0 flex-1 rounded-lg border p-3"/>

        {status === "streaming" ? (
          <button
          type="button"
          onClick={stopGeneration}
          className="rounded-lg bg-red-600 px-4 text-white">
            Parar
          </button>
        ) : (
          <button
          type="submit"
          disabled={!input.trim()}
          className="rounded-lg bg-blue-600 px-4 text-white disabled:opacity-50">
            Enviar
          </button>
        )}
      </form>
    </div>
  )
}