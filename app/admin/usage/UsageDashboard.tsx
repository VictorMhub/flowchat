
"use client";

import { useEffect, useState } from "react";

type UsageResponse = {
  date: string;
  usage: {
    input: number;
    output: number;
    total: number;
    requests: number;
  };
};

const metrics = [
  { key: "input", label: "Tokens de entrada" },
  { key: "output", label: "Tokens de saída" },
  { key: "total", label: "Total de tokens" },
  { key: "requests", label: "Gerações registradas" },
] as const;

export function UsageDashboard() {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadUsage() {
      try {
        const response = await fetch("/api/admin/usage", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Não foi possível carregar o consumo.");
        }

        const result: UsageResponse = await response.json();

        setData(result);
      } catch (error) {
        if (controller.signal.aborted) return;

        setError(
          error instanceof Error
            ? error.message
            : "Erro inesperado.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadUsage();

    return () => controller.abort();
  }, []);

  const formatter = new Intl.NumberFormat("pt-BR");

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold">
          Consumo de IA
        </h1>

        <p className="mt-2 text-sm text-zinc-500">
          Monitoramento diário de tokens do Flowchat.
        </p>
      </header>

      {loading && (
        <p className="text-zinc-500">
          Carregando consumo...
        </p>
      )}

      {error && (
        <p role="alert" className="text-red-500">
          {error}
        </p>
      )}

      {data && (
        <>
          <p className="mb-6 text-sm text-zinc-500">
            Data: {data.date} (UTC)
          </p>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((metric) => (
              <article
                key={metric.key}
                className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800"
              >
                <p className="text-sm text-zinc-500">
                  {metric.label}
                </p>

                <p className="mt-3 text-3xl font-semibold tabular-nums">
                  {formatter.format(
                    data.usage[metric.key],
                  )}
                </p>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
