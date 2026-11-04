
import { Suspense } from "react";
import { isAdmin } from "@/server/auth/requireAdmin";
import { redirect } from "next/navigation";
import { UsageDashboard } from "./UsageDashboard";

async function ProtectedUsageDashboard() {
  const authorized = await isAdmin();

  if (!authorized) {
    redirect("/");
  }

  return <UsageDashboard />;
}

export default function AdminUsagePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-6 py-12">
          <p className="text-zinc-500">
            Verificando acesso...
          </p>
        </main>
      }
    >
      <ProtectedUsageDashboard />
    </Suspense>
  );
}
