import { getCurrentUser } from "@/server/auth/getCurrentUser";
import { prisma } from "@/server/db/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_resquest: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json({ error: "Não autorizado." }, { status: 401 });
    }
    const { id } = await params;
    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: {
        id: true,
        title: true,
        messages: {
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        },
      },
    });

    if (!conversation) {
      return Response.json(
        { error: "Conversa não encontrada." },
        { status: 404 },
      );
    }

    return Response.json(conversation);
  } catch (error) {
    console.error("Erro ao carregar conversa:", error);

    return Response.json(
      { error: "Erro ao carregar mensagens." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { id } = await params;

    const result = await prisma.conversation.deleteMany({
      where: {
        id,
        userId: user.id,
      },
    });

    if (result.count === 0) {
      return Response.json(
        { error: "Conversa não encontrada." },
        { status: 404 },
      );
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Erro ao excluir conversa:", error);

    return Response.json(
      { error: "Erro ao excluir conversa." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return Response.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { id } = await params;
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("title" in body) ||
      typeof body.title !== "string"
    ) {
      return Response.json({ error: "Título inválido." }, { status: 400 });
    }

    const title = body.title.trim();

    if (title.length < 1 || title.length > 100) {
      return Response.json(
        { error: "O título deve ter entre 1 e 100 caracteres." },
        { status: 400 },
      );
    }

    const result = await prisma.conversation.updateMany({
      where: {
        id,
        userId: user.id,
      },
      data: {
        title,
      },
    });

    if (result.count === 0) {
      return Response.json(
        { error: "Conversa não encontrada." },
        { status: 404 },
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Erro ao renomear conversa:", error);

    return Response.json(
      { error: "Erro ao renomear conversa." },
      { status: 500 },
    );
  }
}
