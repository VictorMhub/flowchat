import { Suspense } from "react";
import { AuthButton } from "@/features/chat/components/AuthButton";
import { ProtectedChat } from "@/features/auth/components/ProtectedChat";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<p>Verificando sessão...</p>}>
      <ProtectedChat>
        <div className="flex min-h-dvh flex-col">
          <header className="flex justify-end border-b p-4">
            <AuthButton />
          </header>
          <main className="min-h-0 flex-1">{children}</main>
        </div>
      </ProtectedChat>
    </Suspense>
  );
}
