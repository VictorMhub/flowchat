
import "server-only";

import { auth } from "@/auth";

export async function isAdmin(): Promise<boolean> {
  const session = await auth();

  const email = session?.user?.email?.trim().toLowerCase();
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (!email || !adminEmail) {
    return false;
  }

  return email === adminEmail;
}
