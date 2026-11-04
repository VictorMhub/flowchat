import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, Pencil, X } from "lucide-react";

import { CodeBlock } from "./CodeBlock";
import type { ChatMessage } from "../types/chat.types";

interface MessageItemProps {
  message: ChatMessage;
  isStreaming?: boolean;
  editingMessageId?: string | null;
  onEdit?: (messageId: string, content: string) => Promise<boolean>;
  disabled?: boolean;
}

export function MessageItem({
  message,
  isStreaming = false,
  editingMessageId = null,
  onEdit,
  disabled = false,
}: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  const isUser = message.role === "user";
  const isSaving = editingMessageId === message.id;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Erro ao copiar mensagem:", error);
    }
  }

  function cancelEdit() {
    if (isSaving) return;
    setDraft(message.content);
    setIsEditing(false);
  }

  async function saveEdit() {
    const content = draft.trim();
    if (!onEdit || !content || content.length > 10000 || isSaving) {
      return;
    }

    const success = await onEdit(message.id, content);
    if (success) setIsEditing(false);
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className="min-w-0 max-w-[95%] sm:max-w-[85%]">
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-7 shadow-sm ${
            isUser
              ? "rounded-br-md bg-blue-600 text-white"
              : "rounded-bl-md bg-gray-100 text-gray-900"
          }`}
        >
          {isUser ? (
            isEditing ? (
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveEdit();
                }}
              >
                <textarea
                  autoFocus
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={10000}
                  rows={4}
                  disabled={isSaving}
                  aria-label="Editar mensagem"
                  onKeyDown={(event) => {
                    if (event.key === "Escape") cancelEdit();
                    if (
                      event.key === "Enter" &&
                      (event.ctrlKey || event.metaKey)
                    ) {
                      event.preventDefault();
                      void saveEdit();
                    }
                  }}
                  className="w-full min-w-0 resize-y rounded-lg bg-white p-3 text-sm text-gray-900 outline-none"
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={isSaving}
                    className="flex items-center gap-1 rounded-lg border border-white/50 px-3 py-1.5 disabled:opacity-50"
                  >
                    <X size={14} />
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={!draft.trim() || isSaving}
                    className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-blue-700 disabled:opacity-50"
                  >
                    <Check size={14} />
                    {isSaving ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </form>
            ) : (
              <p className="whitespace-pre-wrap break-words">
                {message.content}
              </p>
            )
          ) : message.content ? (
            <div className="min-w-0 space-y-3 break-words [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_table]:block [&_table]:overflow-x-auto">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  pre({ children }) {
                    return <>{children}</>;
                  },
                  code({ className, children, ...props }) {
                    const match = /language-([\\w+#-]+)/.exec(className || "");
                    const content = String(children);
                    const isBlock = Boolean(match) || content.includes("\\n");

                    if (isBlock) {
                      return (
                        <CodeBlock language={match?.[1] ?? "text"}>
                          {content}
                        </CodeBlock>
                      );
                    }

                    return (
                      <code
                        className="rounded bg-gray-200 px-1 py-0.5 text-xs"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          ) : (
            <span
              role="status"
              className="flex items-center gap-2 text-gray-500"
            >
              <span className="flex gap-1" aria-hidden="true">
                {[0, 1, 2].map((index) => (
                  <span
                    key={index}
                    className="h-2 w-2 animate-bounce rounded-full bg-blue-500"
                    style={{ animationDelay: `${index * 150}ms` }}
                  />
                ))}
              </span>
              Pensando...
            </span>
          )}
        </div>

        {isUser && !isEditing && onEdit && (
          <div className="mt-2 flex justify-end px-1">
            <button
              type="button"
              onClick={() => {
                setDraft(message.content);
                setIsEditing(true);
              }}
              disabled={disabled || editingMessageId !== null}
              aria-label="Editar mensagem"
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 disabled:opacity-50"
            >
              <Pencil size={14} />
              Editar
            </button>
          </div>
        )}

        {!isUser && (
          <div className="mt-2 flex items-center gap-3 px-1">
            {message.content && (
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Copiar resposta"
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copiado" : "Copiar resposta"}
              </button>
            )}

            {isStreaming && message.content && (
              <span
                role="status"
                className="flex items-center gap-2 text-xs text-gray-500"
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                Gerando...
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
