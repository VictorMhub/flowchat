import { auth } from "@/auth";
import { chatRequestSchema } from "@/features/chat/schemas/message.schema";
import { generateChatStream } from "@/server/ai/aiGateway";
import { getCurrentUser } from "@/server/auth/getCurrentUser";
import { prisma } from "@/server/db/prisma";
import {
  acquireConversationLock,
  releaseConversationLock,
  renewConversationLock,
} from "@/server/security/conversationLock";
import { chatRateLimit } from "@/server/security/rateLimit";
import { checkDailyQuota } from "@/server/security/dailyQuota";
import { getAIErrorMessage, isGeminiQuotaError } from "@/server/ai/aiErrors";
const LOCK_RENEW_INTERVAL_MS = 30_000;

export async function POST(request: Request) {
  let lockedConversationId: string | null = null;
  let lockToken: string | null = null;
  let lockTransferredToStream = false;

  async function releaseLock() {
    if (!lockedConversationId || !lockToken) return;

    try {
      await releaseConversationLock(lockedConversationId, lockToken);
    } catch (error) {
      console.error("Erro ao liberar bloqueio:", error);
    }
  }

  try {
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim();

    if (!ip) {
      return Response.json(
        { error: "Não foi possível identificar a origem." },
        { status: 403 },
      );
    }

    const session = await auth();

    if (!session?.user?.email) {
      return Response.json(
        { error: "Usuário não autenticado." },
        { status: 401 },
      );
    }

    const user = await getCurrentUser();

    if (!user) {
      return Response.json({ error: "Não autorizado." }, { status: 401 });
    }

    const limit = await chatRateLimit.limit(`user:${user.id}`);

    if (!limit.success) {
      return Response.json(
        { error: "Limite de mensagens atingido." },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.max(1, Math.ceil((limit.reset - Date.now()) / 1000)),
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

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "JSON inválido." }, { status: 400 });
    }

    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: "Mensagens inválidas." }, { status: 400 });
    }

    const { messages, conversationId } = parsed.data;
    const lastMessage = messages.at(-1);

    if (!lastMessage || lastMessage.role !== "user") {
      return Response.json(
        { error: "A última mensagem deve ser do usuário." },
        { status: 400 },
      );
    }

    let conversation;

    if (conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          userId: user.id,
        },
        select: { id: true },
      });

      if (!conversation) {
        return Response.json(
          { error: "Conversa não encontrada." },
          { status: 404 },
        );
      }
    } else {
      conversation = await prisma.conversation.create({
        data: {
          userId: user.id,
          title: lastMessage.content.slice(0, 60) || "Nova conversa",
        },
        select: { id: true },
      });
    }

    const currentConversationId = conversation.id;

    lockedConversationId = currentConversationId;

    lockToken = await acquireConversationLock(currentConversationId);

    if (!lockToken) {
      return Response.json(
        {
          error: "Esta conversa já possui uma operação em andamento. Aguarde.",
        },
        { status: 409 },
      );
    }

    const currentLockToken = lockToken;
    const quota = await checkDailyQuota(user.id);

    if (!quota.allowed) {
      return Response.json(
        {
          error:
            quota.reason === "user"
              ? "Você atingiu seu limite diário de mensagens. Tente novamente mais tarde."
              : "O limite diário de uso do Flowchat foi atingido. Tente novamente mais tarde.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(quota.retryAfter),
          },
        },
      );
    }

    // Incrementa a versão e salva a mensagem do usuário
    // na mesma transação.
    const generationVersion = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
          SELECT id
          FROM "Conversation"
          WHERE id = ${currentConversationId}
          FOR UPDATE
        `;

      const updatedConversation = await tx.conversation.update({
        where: {
          id: currentConversationId,
        },
        data: {
          generationVersion: {
            increment: 1,
          },
        },
        select: {
          generationVersion: true,
        },
      });

      const lastSavedMessage = await tx.message.findFirst({
        where: {
          conversationId: currentConversationId,
          position: { not: null },
        },
        orderBy: [{ position: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        select: {
          position: true,
        },
      });

      const nextPosition = (lastSavedMessage?.position ?? -1) + 1;

      await tx.message.create({
        data: {
          conversationId: currentConversationId,
          role: "user",
          content: lastMessage.content,
          position: nextPosition,
        },
      });

      return updatedConversation.generationVersion;
    });

    const generationController = new AbortController();

    const abortGeneration = () => {
      generationController.abort();
    };

    if (request.signal.aborted) {
      abortGeneration();
    } else {
      request.signal.addEventListener("abort", abortGeneration, { once: true });
    }

    let geminiStream;

    try {
      geminiStream = await generateChatStream(
        messages,
        generationController.signal,
      );
    } catch (error) {
      request.signal.removeEventListener("abort", abortGeneration);

      throw error;
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let assistantContent = "";
        let lockLost = false;
        let finished = false;
        let renewing = false;

        const renewalInterval = setInterval(() => {
          if (finished || renewing) return;

          renewing = true;

          void renewConversationLock(currentConversationId, currentLockToken)
            .then((renewed) => {
              if (!renewed) {
                lockLost = true;
                abortGeneration();
              }
            })
            .catch((error) => {
              lockLost = true;
              abortGeneration();

              console.error("Erro ao renovar bloqueio:", error);
            })
            .finally(() => {
              renewing = false;
            });
        }, LOCK_RENEW_INTERVAL_MS);

        try {
          for await (const chunk of geminiStream) {
            if (generationController.signal.aborted || lockLost) {
              break;
            }

            const text = chunk.text;

            if (text) {
              assistantContent += text;
              controller.enqueue(encoder.encode(text));
            }
          }

          if (lockLost) {
            throw new Error("LOCK_LOST");
          }

          if (!generationController.signal.aborted && assistantContent.trim()) {
            const lockStillValid = await renewConversationLock(
              currentConversationId,
              currentLockToken,
            );

            if (!lockStillValid) {
              throw new Error("LOCK_LOST");
            }

            await prisma.$transaction(async (tx) => {
              // Serializa gravações da mesma conversa.
              await tx.$queryRaw`
                SELECT id
                FROM "Conversation"
                WHERE id = ${currentConversationId}
                FOR UPDATE
              `;

              const currentConversation = await tx.conversation.findUnique({
                where: {
                  id: currentConversationId,
                },
                select: {
                  generationVersion: true,
                },
              });

              // Uma geração mais recente assumiu a conversa.
              if (
                !currentConversation ||
                currentConversation.generationVersion !== generationVersion
              ) {
                throw new Error("GENERATION_SUPERSEDED");
              }

              const lastSavedMessage = await tx.message.findFirst({
                where: {
                  conversationId: currentConversationId,
                  position: { not: null },
                },
                orderBy: [
                  { position: "desc" },
                  { createdAt: "desc" },
                  { id: "desc" },
                ],
                select: {
                  position: true,
                },
              });

              const assistantPosition = (lastSavedMessage?.position ?? -1) + 1;

              await tx.message.create({
                data: {
                  conversationId: currentConversationId,
                  role: "assistant",
                  content: assistantContent,
                  position: assistantPosition,
                },
              });

              await tx.conversation.update({
                where: {
                  id: currentConversationId,
                },
                data: {
                  updatedAt: new Date(),
                },
              });
            });
          }

          if (!generationController.signal.aborted) {
            controller.close();
          }
        } catch (error) {
          if (!generationController.signal.aborted) {
            console.error("Erro no streaming:", error);

            try {
              controller.error(error);
            } catch {
              // A leitura pode já ter sido cancelada.
            }
          }
        } finally {
          finished = true;
          clearInterval(renewalInterval);

          request.signal.removeEventListener("abort", abortGeneration);

          await releaseLock();
        }
      },

      cancel() {
        // Solicita o cancelamento.
        // A liberação acontece no finally.
        abortGeneration();
      },
    });

    lockTransferredToStream = true;

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Content-Type-Options": "nosniff",
        "X-Conversation-Id": currentConversationId,
      },
    });
  } catch (error) {
    console.error("Erro na API de chat:", error);

    return Response.json(
      {
        error: getAIErrorMessage(error),
      },
      { status: isGeminiQuotaError(error) ? 429 : 500 },
    );
  } finally {
    if (!lockTransferredToStream) {
      await releaseLock();
    }
  }
}
