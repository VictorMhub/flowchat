import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <form
        action={async () => {
          "use server";
          await signIn("github", { redirectTo: "/chat" });
        }}
      >
        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-6 py=3 text-white hover:gb-gray-700"
        >
          Entrar com GitHub
        </button>
      </form>
    </main>
  );
}
