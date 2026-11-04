import { auth } from "@/auth";
import { editMessageSchema } from "@/features/chat/schemas/message.schema";
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
import { recordTokenUsage, type TokenUsage } from "@/server/ai/tokenUsage";
type RouteContext = {
  params: Promise<{
    id: string;
    messageId: string;
  }>;
};

type StreamEvent =
  | { type: "chunk"; content: string }
  | {
      type: "done";
      conversationId: string;
      messageId: string;
      content: string;
      assistant: {
        id: string;
        role: "assistant";
        content: string;
      };
    }
  | { type: "error"; error: string };

const LOCK_RENEW_INTERVAL_MS = 30_000;

export async function POST(request: Request, { params }: RouteContext) {
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
    const session = await auth();

    if (!session?.user?.email) {
      return Response.json({ error: "Não autenticado." }, { status: 401 });
    }

    const user = await getCurrentUser();

    if (!user) {
      return Response.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { id, messageId } = await params;

    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
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

    const parsed = editMessageSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json({ error: "Conteúdo inválido." }, { status: 400 });
    }

    // Impede outra operação simultânea na conversa.
    lockToken = await acquireConversationLock(id);

    if (!lockToken) {
      return Response.json(
        {
          error: "Esta conversa já possui uma operação em andamento. Aguarde.",
        },
        { status: 409 },
      );
    }

    lockedConversationId = id;
    const currentLockToken = lockToken;

    const savedMessages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        role: true,
        content: true,
        position: true,
      },
    });

    const target = savedMessages.find(
      (message) => message.id === messageId && message.role === "user",
    );

    if (!target || target.position === null) {
      return Response.json(
        { error: "Mensagem não encontrada." },
        { status: 404 },
      );
    }

    const previousMessages = savedMessages.filter(
      (message) =>
        message.position !== null && message.position < target.position!,
    );

    const messages = [
      ...previousMessages
        .filter(
          (message) => message.role === "user" || message.role === "assistant",
        )
        .map((message) => ({
          id: message.id,
          role: message.role as "user" | "assistant",
          content: message.content,
        })),
      {
        id: target.id,
        role: "user" as const,
        content: parsed.data.content,
      },
    ];

    if (messages.length > 30) {
      return Response.json(
        { error: "Histórico muito longo para regenerar." },
        { status: 400 },
      );
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

    const expectedSignature = JSON.stringify(savedMessages);

    const editedContent = parsed.data.content;
    const targetPosition = target.position;

    // Assume uma nova versão da conversa.
    // O incremento acontece sob bloqueio de linha.
    const generationVersion = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
          SELECT id
          FROM "Conversation"
          WHERE id = ${id}
          FOR UPDATE
        `;

      const currentMessages = await tx.message.findMany({
        where: { conversationId: id },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          role: true,
          content: true,
          position: true,
        },
      });

      if (JSON.stringify(currentMessages) !== expectedSignature) {
        throw new Error("HISTORY_CHANGED");
      }

      const updated = await tx.conversation.update({
        where: { id },
        data: {
          generationVersion: {
            increment: 1,
          },
        },
        select: {
          generationVersion: true,
        },
      });

      return updated.generationVersion;
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
        let finished = false;
        let lockLost = false;
        let renewing = false;
        let latestUsage: TokenUsage | null = null;

        const renewalInterval = setInterval(() => {
          if (finished || renewing) return;

          renewing = true;

          void renewConversationLock(id, currentLockToken)
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

        function sendEvent(event: StreamEvent) {
          if (generationController.signal.aborted || lockLost) {
            return;
          }

          try {
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          } catch {
            abortGeneration();
          }
        }

        try {
          for await (const chunk of geminiStream) {
            if (generationController.signal.aborted || lockLost) {
              break;
            }

            if (chunk.usageMetadata) {
              latestUsage = {
                inputTokens: chunk.usageMetadata.promptTokenCount ?? 0,
                outputTokens: chunk.usageMetadata.candidatesTokenCount ?? 0,
                totalTokens: chunk.usageMetadata.totalTokenCount ?? 0,
              };
            }

            const text = chunk.text ?? "";

            if (!text) continue;

            assistantContent += text;

            sendEvent({
              type: "chunk",
              content: text,
            });
          }

          if (lockLost) {
            throw new Error("LOCK_LOST");
          }

          if (generationController.signal.aborted) {
            return;
          }

          if (!assistantContent.trim()) {
            throw new Error("A IA retornou uma resposta vazia.");
          }

          const lockStillValid = await renewConversationLock(
            id,
            currentLockToken,
          );

          if (!lockStillValid) {
            throw new Error("LOCK_LOST");
          }

          if (generationController.signal.aborted) {
            return;
          }

          const assistant = await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`
                SELECT id
                FROM "Conversation"
                WHERE id = ${id}
                FOR UPDATE
              `;

            const currentConversation = await tx.conversation.findUnique({
              where: { id },
              select: {
                generationVersion: true,
              },
            });

            if (
              !currentConversation ||
              currentConversation.generationVersion !== generationVersion
            ) {
              throw new Error("GENERATION_SUPERSEDED");
            }

            const currentMessages = await tx.message.findMany({
              where: { conversationId: id },
              orderBy: [
                { position: "asc" },
                { createdAt: "asc" },
                { id: "asc" },
              ],
              select: {
                id: true,
                role: true,
                content: true,
                position: true,
              },
            });

            if (JSON.stringify(currentMessages) !== expectedSignature) {
              throw new Error("HISTORY_CHANGED");
            }

            await tx.message.deleteMany({
              where: {
                conversationId: id,
                position: {
                  gt: targetPosition,
                },
              },
            });

            await tx.message.update({
              where: { id: target.id },
              data: {
                content: editedContent,
              },
            });

            const created = await tx.message.create({
              data: {
                conversationId: id,
                role: "assistant",
                content: assistantContent,
                position: targetPosition + 1,
              },
            });

            await tx.conversation.update({
              where: { id },
              data: { updatedAt: new Date() },
            });

            return created;
          });

          sendEvent({
            type: "done",
            conversationId: id,
            messageId: target.id,
            content: editedContent,
            assistant: {
              id: assistant.id,
              role: "assistant",
              content: assistant.content,
            },
          });
        } catch (error) {
          if (!generationController.signal.aborted) {
            console.error("Erro ao editar mensagem:", error);

            const message =
              error instanceof Error && error.message === "HISTORY_CHANGED"
                ? "O histórico mudou durante a geração. Recarregue a conversa."
                : error instanceof Error &&
                    error.message === "GENERATION_SUPERSEDED"
                  ? "Outra operação assumiu esta conversa. Recarregue o histórico."
                  : error instanceof Error && error.message === "LOCK_LOST"
                    ? "O bloqueio da conversa expirou. Tente novamente."
                    : error instanceof Error &&
                        error.message === "A IA retornou uma resposta vazia."
                      ? error.message
                      : getAIErrorMessage(error);

            sendEvent({
              type: "error",
              error: message,
            });
          }
        } finally {
          finished = true;
          clearInterval(renewalInterval);

          request.signal.removeEventListener("abort", abortGeneration);

          if (latestUsage) {
            try {
              await recordTokenUsage(user.id, latestUsage);
            } catch (error) {
              console.error("Erro ao registrar tokens:", error);
            }
          }

          await releaseLock();

          try {
            controller.close();
          } catch {
            // A leitura pode já ter sido cancelada.
          }
        }
      },

      cancel() {
        // Apenas solicita o encerramento.
        // O finally libera o bloqueio.
        abortGeneration();
      },
    });

    lockTransferredToStream = true;

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Erro ao iniciar edição:", error);

    return Response.json(
      { error: getAIErrorMessage(error) },
      { status: isGeminiQuotaError(error) ? 429 : 500 },
    );
  } finally {
    if (!lockTransferredToStream) {
      await releaseLock();
    }
  }
}
