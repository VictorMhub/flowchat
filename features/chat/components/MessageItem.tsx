import type { ChatMessage} from "../types/chat.types";

type Props = {
   message: ChatMessage;
}

export function MessageItem({ message}: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-2`}>
      <div className={`max-w-[85%] rounded-x1 p-3 whitespace-pre-wrap ${isUser ? "bg-blue-600 text-white" :
        "bg-gray-100 text-gray-900"
      }`}>
        {message.content || "Gerando respsota..."}
      </div>
    </div>
  )
}