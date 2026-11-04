
import { Redis } from "@upstash/redis";
import { isAdmin } from "@/server/auth/requireAdmin";

const redis = Redis.fromEnv();

type Usage = {
  input: number;
  output: number;
  total: number;
  requests: number;
};

export async function GET() {
  if (!(await isAdmin())) {
    return Response.json(
      { error: "Acesso negado." },
      { status: 403 },
    );
  }

  const day = new Date().toISOString().slice(0, 10);
  const key = `tokens:global:${day}`;

  const data = await redis.hgetall<Record<string, number>>(key);

  const usage: Usage = {
    input: Number(data?.input ?? 0),
    output: Number(data?.output ?? 0),
    total: Number(data?.total ?? 0),
    requests: Number(data?.requests ?? 0),
  };

  return Response.json(
    { date: day, usage },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
