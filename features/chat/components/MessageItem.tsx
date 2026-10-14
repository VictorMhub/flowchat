import type { ChatMessage} from "../types/chat.types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}
          </p>
        ) : message.content ? (
          <div className="space-y-3 break-words [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-gray-800 [&_pre]:p-3 [&_pre]:text-white [&_code]:break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        ) : (
          <span className="animate-pulse">
            Gerando resposta...
          </span>
        )}
      </div>
    </div>
  )
}