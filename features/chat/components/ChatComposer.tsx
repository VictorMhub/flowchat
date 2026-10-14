"use client";

import { useState, type FormEvent } from "react";

type Props = {
  onSend: (content: string) => void;
  onStop: () => void;
  isStreaming: boolean;
}

export function ChatComposer({ onSend, onStop, isStreaming }: Props) {
  const [input, setInput] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!input.trim() || isStreaming) return;

    onSend(input.trim());
    setInput("");

  }
  return (
    <form onSubmit={handleSubmit} className="flex gap-2 pt-4">
      <input 
      value={input}
      onChange={(event) => setInput(event.target.value)}
      placeholder="Digite sua mensagem..." 
      arial-label="Messagem"
      className="min-w-0 flex-1  rounded-lg border p-3"
      />
      {isStreaming ?  (
        <button
        type="button"
        onClick={onStop}
        className="rounded-lg bg-red-600 px-4 text-white"
        >
          Parar
        </button>
      ) : (
        <button
        type="submit"
        disabled={!input.trim()}
        className="rounded-lg bg-blue-600 px-4 text-white disabled:opacity-50"
        >
          Enviar
        </button>
      )}
    </form>
  )
}