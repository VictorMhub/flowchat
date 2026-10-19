import { getCurrentUser } from "@/server/auth/getCurrentUser";
import { prisma } from "@/server/db/prisma";

export async function GET() {
  try{
    const user = await getCurrentUser();

    if (!user) {
       return Response.json(
        { error: "Não autorizado." },
        { status: 401 },
       );
    }

    const conversation = await prisma.conversation.findMany({
      where:{
        userId: user.id,
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      }, 
      orderBy: {
        updatedAt: "desc",
      },
      take: 50,
    });

    return Response.json(conversation)
  } catch(error){
    console.error("Erro ao listar conversar: ", error)
    
    return Response.json(
      {error: "Erro ao carregar conversar."},
      { status: 500},
    );
  }
}