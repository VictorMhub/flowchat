
import { connection } from "next/server";
import { auth, signIn, signOut } from "@/auth";

export async function AuthButton() {
  await connection();

  const session = await auth();

  if (!session?.user) {
    return (
      <form
        action={async () => {
          "use server";
          await signIn("github", { redirectTo: "/chat" });
        }}
      >
        <button type="submit"   className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
>Entrar com GitHub</button>
      </form>
    );
  }

  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button type="submit"   className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
>Sair</button>
    </form>
  );
}
