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
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
};

export function ChatSidebar({
  conversations,
  activeId,
  loading,
  deletingId,
  onSelect,
  onNewChat,
  onDelete,
}: ChatSidebarProps) {
  function confirmDelete(id: string, title: string){
    const confirmed = window.confirm(
      `Deseja excluir a conversa "${title}" ? Essa ação não pode ser desfeita.`
    )

    if (confirmed) {
      onDelete(id);
    }
  }
  
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r p-4">
      <button
        onClick={onNewChat}
        className="mb-6 rounded-lg bg-blue-600 px-4 py-2 text-white"
      >
        + Nova conversa
      </button>

      <h2 className="mb-3 text-sm font-semibold">Histórico</h2>

      <nav className="flex flex-col gap-1">
        {loading && <p className="text-sm text-gray-500">Carregando...</p>}

        {!loading && conversations.length === 0 && (
          <p className="text-sm text-gray-500">Nenhuma conversa ainda.</p>
        )}

        {conversations.map((conversation) => (
          <div
          key={conversation.id}
          className={`flex items-center gap-1 rounded-lg ${activeId === conversation.id ? "bg-blue-100 text-blue800" : "hover:bg-greay-100"}`}
          >
          <button
            key={conversation.id}
            onClick={() => onSelect(conversation.id)}
            className={`truncate rounded-lg px-3 py-2 text-left text-sm ${activeId === conversation.id ? "bg-blue-100 text-blue-800" : "hover:bg-gray-100"}`}
          >
            {conversation.title}
          </button>

          <button 
          type="button"
          arial-label={`Ecluir ${conversation.title}`}
          title="Ecluir conversa"
          disabled={deletingId !== null}
          onClick={() => 
            confirmDelete(conversation.id, conversation.title)
          }
          className="shrink-0 rounded p-2 text-red-600 hover:bg-red-100 disabled:pacity"
          >
              {deletingId === conversation.id ? "..." : "×"}
          </button>
          </div>
        ))}
      </nav>
    </aside>
  );
}
