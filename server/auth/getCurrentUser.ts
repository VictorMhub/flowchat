import "server-only";

import { auth } from "@/auth";
import { prisma } from "@/server/db/prisma";

export async function getCurrentUser() {
  const session = await auth();
  const user = session?.user;

  if (!user?.email) return null;

  return prisma.user.upsert({
    where: { email: user.email },
    update: {
      name: user.name,
      image: user.image,
    },
    create: {
      email: user.email,
      name: user.name,
      image: user.image,
    },
  });
}