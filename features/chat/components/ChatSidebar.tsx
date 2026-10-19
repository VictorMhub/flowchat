"use client";

type Conversation = {
  id: string;
  title: string;
};

type ChatSidebarProps = {
  conversations: Conversation[];
  activeId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onNewChat: () => void;
};

export function ChatSidebar({
  conversations,
  activeId,
  loading,
  onSelect,
  onNewChat,
}: ChatSidebarProps) {
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
          <button
            key={conversation.id}
            onClick={() => onSelect(conversation.id)}
            className={`truncate rounded-lg px-3 py-2 text-left text-sm ${activeId === conversation.id ? "bg-blue-100 text-blue-800" : "hover:bg-gray-100"}`}
          >
            {conversation.title}
          </button>
        ))}
      </nav>
    </aside>
  );
}
