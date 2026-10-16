import { Suspense } from "react";
import { AuthButton } from "@/features/chat/components/AuthButton";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex justify-end border-b p-4">
        <Suspense fallback={<span>Carregando sessão...</span>}>
          <AuthButton />
        </Suspense>
      </header>

      <main className="min-h-0 flex-1">
        {children}
      </main>
    </div>
  );
}
