"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";

type Props = {
  onSend: (content: string) => void;
  onStop: () => void;
  isStreaming: boolean;
};

const MAX_HEIGHT = 180;

export function ChatComposer({ onSend, onStop, isStreaming }: Props) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_HEIGHT)}px`;
  }, [input]);

  function submitMessage() {
    const content = input.trim();
    if (!content || isStreaming) return;

    onSend(content);
    setInput("");
    textareaRef.current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitMessage();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submitMessage();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="shrink-0 pt-4">
      <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua mensagem..."
          aria-label="Mensagem"
          disabled={isStreaming}
          className="max-h-[180px] min-h-11 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-3 py-2.5 text-sm leading-6 text-gray-900 outline-none placeholder:text-gray-400 disabled:opacity-60"
        />

        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Interromper geração"
            title="Interromper geração"
            className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            <Square size={16} fill="currentColor" />
            <span className="hidden sm:inline">Parar</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            aria-label="Enviar mensagem"
            title="Enviar mensagem"
            className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={16} />
            <span className="hidden sm:inline">Enviar</span>
          </button>
        )}
      </div>
      <p className="mt-2 text-center text-xs text-gray-500">
        Enter para enviar · Shift+Enter para quebrar linha
      </p>
    </form>
  );
}
