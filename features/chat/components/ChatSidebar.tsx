"use client";

type Conversation = {
  id: string;
  title: string;
};

type ChatSidebarProps = {
  conversations: Conversation[];
  activeId: string | null;
  loading: boolean;
  deletingId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
};

export function ChatSidebar({
  conversations,
  activeId,
  loading,
  deletingId,
  isOpen,
  onClose,
  onSelect,
  onNewChat,
  onDelete,
}: ChatSidebarProps) {
  function confirmDelete(id: string, title: string) {
    const confirmed = window.confirm(
      `Deseja excluir a conversa "${title}"? Essa ação não pode ser desfeita.`,
    );

    if (confirmed) {
      onDelete(id);
    }
  }

  function handleSelect(id: string) {
    onSelect(id);
    onClose();
  }

  function handleNewChat() {
    onNewChat();
    onClose();
  }

  return (
    <>
      {/* Fundo escuro no celular */}
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
        className={`
          fixed inset-y-0 left-0 z-50
          flex w-72 flex-col
          border-r bg-white p-4
          transition-transform duration-200
          md:static md:z-auto md:w-64
          md:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="mb-6 flex items-center justify-between gap-2">
          <span className="font-semibold text-gray-900">Flowchat</span>

          <button
            type="button"
            aria-label="Fechar histórico"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 md:hidden"
          >
            ✕
          </button>
        </div>

        <button
          type="button"
          onClick={handleNewChat}
          className="mb-6 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          + Nova conversa
        </button>

        <h2 className="mb-3 text-sm font-semibold text-gray-900">Histórico</h2>

        <nav
          aria-label="Histórico de conversas"
          className="min-h-0 flex-1 space-y-1 overflow-y-auto"
        >
          {loading && <p className="text-sm text-gray-500">Carregando...</p>}

          {!loading && conversations.length === 0 && (
            <p className="text-sm text-gray-500">Nenhuma conversa ainda.</p>
          )}

          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`flex items-center gap-1 rounded-lg ${
                activeId === conversation.id
                  ? "bg-blue-100 text-blue-800"
                  : "text-gray-800 hover:bg-gray-100"
              }`}
            >
              <button
                type="button"
                onClick={() => handleSelect(conversation.id)}
                className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm"
              >
                {conversation.title}
              </button>

              <button
                type="button"
                aria-label={`Excluir ${conversation.title}`}
                title="Excluir conversa"
                disabled={deletingId !== null}
                onClick={() =>
                  confirmDelete(conversation.id, conversation.title)
                }
                className="shrink-0 rounded p-2 text-red-600 hover:bg-red-100 disabled:opacity-50"
              >
                {deletingId === conversation.id ? "..." : "×"}
              </button>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
