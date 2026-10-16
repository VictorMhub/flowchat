import { chatRequestSchema } from "@/features/chat/schemas/message.schema";
import { generateChatStream } from "@/server/ai/aiGateway";
import { chatRateLimit } from "@/server/security/rateLimit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const forwardedFor = request.headers
    .get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim();

    if (!ip) {
      return Response.json(
        { erro: "Não foi possível identificar a origem."},
        { status: 403 }
      )
    }

    const result = await chatRateLimit.limit(ip);

    if (!result.success){
       return Response.json(
        { error: "Limite de mensagens atingido. Tente novamente mais tarde."},
        { status: 429,
          headers: {
            "Retry-After": String(
              Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)
            )
          ),
          }
        }
       )
    }

    const contentLength = Number(
      request.headers.get("content-length") ?? 0
    );

    if (contentLength > 100_000) {
       return Response.json(
        { error: "Requisição muito grande."},
        { status: 413}
       );
    }
    const body: unknown = await request.json();

    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Mensagens inválidas." },
        { status: 400 }
      );
    }

    const { messages } = parsed.data;

    if (messages.at(-1)?.role !== "user") {
      return Response.json(
        { error: "A última mensagem deve ser do usuário." },
        { status: 400 }
      );
    }

    const geminiStream = await generateChatStream(
      messages,
      request.signal
    );

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of geminiStream) {
            if (request.signal.aborted) break;

            const text = chunk.text;

            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }

          controller.close();
        } catch (error) {
          console.error("Erro no streaming:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Erro na API de chat:", error);

    return Response.json(
      { error: "Não foi possível gerar a resposta." },
      { status: 500 }
    );
  }
}
