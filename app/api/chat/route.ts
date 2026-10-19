import { chatRequestSchema } from "@/features/chat/schemas/message.schema";
import { generateChatStream } from "@/server/ai/aiGateway";
import { chatRateLimit } from "@/server/security/rateLimit";
import { getCurrentUser } from "@/server/auth/getCurrentUser";
import { prisma } from "@/server/db/prisma";
import { auth } from "@/auth";

export async function POST(request: Request) {
  try {
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim();

    if (!ip) {
      return Response.json(
        { erro: "Não foi possível identificar a origem." },
        { status: 403 },
      );
    }
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json(
        { error: "Usuário naõ autenticado." },
        { status: 401 },
      );
    }
    const user = await getCurrentUser();

    if (!user) {
      return Response.json({ error: "Não autorizado." }, { status: 401 });
    }

    const identifier = `user:${user.id}`;

    const result = await chatRateLimit.limit(identifier);

    if (!result.success) {
      return Response.json(
        { error: "Limite de mensagens atingido. Tente novamente mais tarde." },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
            ),
          },
        },
      );
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);

    if (contentLength > 100_000) {
      return Response.json(
        { error: "Requisição muito grande." },
        { status: 413 },
      );
    }
    const body: unknown = await request.json();
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: "Mensagens inválidas." }, { status: 400 });
    }

    const { messages, conversationId } = parsed.data;

    if (messages.at(-1)?.role !== "user") {
      return Response.json(
        { error: "A última mensagem deve ser do usuário." },
        { status: 400 },
      );
    }

    const lastMessage = messages.at(-1)!;

    let conversation;

    if (conversationId) {
      // Reutiliza somente conversas pertencentes ao usuário.
      conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId: user.id,
        },
      });

      if (!conversation) {
        return Response.json(
          { error: "Conversa não encontrada." },
          { status: 404 },
        );
      }
    } else {
      // Cria uma conversa quando ainda não existe ID.
      conversation = await prisma.conversation.create({
        data: {
          userId: user.id,
          title: lastMessage.content.slice(0, 60) || "Nova conversa",
        },
      });
    }

    // Salva a mensagem enviada pelo usuário.
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: lastMessage.content,
      },
    });

    const geminiStream = await generateChatStream(messages, request.signal);

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let assistantContent = "";

        try {
          for await (const chunk of geminiStream) {
            if (request.signal.aborted) break;

            const text = chunk.text;

            if (text) {
              assistantContent += text;
              controller.enqueue(encoder.encode(text));
            }
          }

          if (!request.signal.aborted && assistantContent.trim()) {
            await prisma.message.create({
              data: {
                conversationId: conversation.id,
                role: "assistant",
                content: assistantContent,
              },
            });
          }

          controller.close();
        } catch (error) {
          console.error("Erro no streaming:", error);
          controller.error(error);
        }
      },
      cancel() {
        // O encerramento antecipado não salva uma resposta parcial.
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Content-Type-Options": "nosniff",
        "X-Conversation-Id": conversation.id,
      },
    });
  } catch (error) {
    console.error("Erro na API de chat:", error);

    return Response.json(
      { error: "Não foi possível gerar a resposta." },
      { status: 500 },
    );
  }
}
