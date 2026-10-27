"use client";

import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";

type Conversation = {
  id: string;
  title: string;
};

type Props = {
  conversations: Conversation[];
  activeId: string | null;
  loading: boolean;
  deletingId: string | null;
  renamingId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => Promise<boolean>;
};

export function ChatSidebar({
  conversations,
  activeId,
  loading,
  deletingId,
  renamingId,
  isOpen,
  onClose,
  onSelect,
  onNewChat,
  onDelete,
  onRename,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");

  function cancel() {
    setEditingId(null);
    setDraft("");
  }

  async function save(id: string) {
    const title = (draft ?? "").trim();

    if (!title || renamingId !== null) return;

    const success = await onRename(id, title);

    if (success) {
      cancel();
    }
  }

  const filteredConversations = conversations.filter((conversations) =>
    conversations.title
      .toLocaleLowerCase("pt-BR")
      .includes(search.trim().toLocaleLowerCase("pt-BR")),
  );

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      )}

      <aside
        id="chat-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r bg-white p-4 transition-transform duration-200 md:static md:z-auto md:w-64 md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center justify-between">
          <strong className="text-gray-900">Flowchat</strong>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar histórico"
            className="rounded p-2 text-gray-700 md:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onNewChat();
            onClose();
          }}
          className="mb-6 rounded-lg bg-blue-600 px-4 py-2 text-white"
        >
          + Nova conversa
        </button>

        <h2 className="mb-3 text-sm font-semibold text-gray-900">Histórico</h2>

        <div className="mb-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar conversas..."
            aria-label="Buscar conversas pelo título"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <nav
          aria-label="Histórico de conversas"
          className="min-h-0 flex-1 space-y-1 overflow-y-auto"
        >
          {loading && <p className="text-sm text-gray-500">Carregando...</p>}

          {!loading && conversations.length === 0 && (
            <p className="text-sm text-gray-500">Nenhuma conversa ainda.</p>
          )}

          {!loading &&
            conversations.length > 0 &&
            filteredConversations.length === 0 && (
              <p className="text-sm text-gray-500">
                Nenhuma conversa encontrada.
              </p>
            )}

          {filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`flex items-center gap-1 rounded-lg ${
                activeId === conversation.id
                  ? "bg-blue-100 text-blue-800"
                  : "text-gray-800 hover:bg-gray-100"
              }`}
            >
              {editingId === conversation.id ? (
                <form
                  className="flex min-w-0 flex-1 items-center gap-1 p-1"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void save(conversation.id);
                  }}
                >
                  <input
                    autoFocus
                    aria-label="Novo título da conversa"
                    maxLength={100}
                    value={draft ?? ""}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") cancel();
                    }}
                    disabled={renamingId === conversation.id}
                    className="min-w-0 flex-1 rounded border bg-white px-2 py-1 text-sm text-gray-900"
                  />

                  <button
                    type="submit"
                    aria-label="Salvar título"
                    disabled={!(draft ?? "").trim() || renamingId !== null}
                    className="rounded p-1 disabled:opacity-50"
                  >
                    <Check size={16} />
                  </button>

                  <button
                    type="button"
                    aria-label="Cancelar edição"
                    onClick={cancel}
                    disabled={renamingId === conversation.id}
                    className="rounded p-1 disabled:opacity-50"
                  >
                    <X size={16} />
                  </button>
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    title={conversation.title}
                    onClick={() => {
                      onSelect(conversation.id);
                      onClose();
                    }}
                    className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm"
                  >
                    {conversation.title}
                  </button>

                  <button
                    type="button"
                    title="Renomear conversa"
                    aria-label={`Renomear ${conversation.title}`}
                    disabled={
                      deletingId !== null ||
                      renamingId !== null ||
                      editingId !== null
                    }
                    onClick={() => {
                      setEditingId(conversation.id);
                      setDraft(conversation.title ?? "");
                    }}
                    className="shrink-0 rounded p-2 hover:bg-blue-200 disabled:opacity-50"
                  >
                    <Pencil size={15} />
                  </button>

                  <button
                    type="button"
                    title="Excluir conversa"
                    aria-label={`Excluir ${conversation.title}`}
                    disabled={
                      deletingId !== null ||
                      renamingId !== null ||
                      editingId !== null
                    }
                    onClick={() => {
                      const confirmed = window.confirm(
                        `Excluir "${conversation.title}"? Essa ação não pode ser desfeita.`,
                      );

                      if (confirmed) {
                        onDelete(conversation.id);
                      }
                    }}
                    className="shrink-0 rounded p-2 text-red-600 hover:bg-red-100 disabled:opacity-50"
                  >
                    {deletingId === conversation.id ? "..." : <X size={16} />}
                  </button>
                </>
              )}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
