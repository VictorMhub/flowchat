"use client";

import { MessageList } from "./MessageList";
import { ChatComposer } from "./ChatComposer" 
import { useChat} from "../hooks/useChat";

export function ChatContainer() {

  const { messages, status, error, sendMessage, stopGeneration} = useChat();

  return (
   <section className="mx-auto flex h-dvh max-w-3x1 flex-col p-4">
     <MessageList messages={messages}/>
     
     {error && (
      <p role="alert" className="py-2 texst-sm text-red-600">
        {error}
      </p>
    )}

    <ChatComposer 
      onSend={sendMessage}
      onStop={stopGeneration}
      isStreaming={status === "streaming"}
      />
    
   </section>
  )
    
}