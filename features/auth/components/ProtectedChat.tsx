import { connection } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth"

export async function ProtectedChat({
   children,
}: {
  children: React.ReactNode;
}) {
  await connection();

  const session = await auth();

  if (!session?.user) {
     redirect("/login");
  }
  return <>{children} </>
}