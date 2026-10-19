import { getCurrentUser } from "@/server/auth/getCurrentUser"
import { prisma } from "@/server/db/prisma"

type RouteContext = {
  params: Promise<{id: string}>;
};

export async function GET(_resquest:Request, {params}: RouteContext) {
    try{
      const user = await getCurrentUser();

      if (!user) {
        return Response.json(
          { error: "Não autorizado."},
          { status: 401},
        );
      }
      const { id } = await params;
      const conversation =  await prisma.conversation.findFirst({
        where: {
          id, userId: user.id,
        },
        select: {
          id: true,
          title: true,
          messages: {
            select:{
              id: true,
              role: true, 
              content: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

      if (!conversation) {
         return Response.json(
          { error: "Conversa não encontrada."},
          { status: 404 },
         )
      }

      return Response.json(conversation);
    } catch (error) {
      console.error("Erro ao carregar conversa:", error);

      return Response.json(
        { error: "Erro ao carregar mensagens."},
        { status: 500},
      );
    }

    


}