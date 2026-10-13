export async function POST(request: Request) {
const { messages } = await request.json();

const lastMessage = messages.at(-1)?.content ?? "";

const response = `Você escreveu: ${lastMessage}. Esta é uma resposta simulada em streaming.`;

const encoder = new TextEncoder();

const stream = new ReadableStream({
  async start(controller) {
    for (const word of response.split("")) {
      if (request.signal.aborted) break;

      controller.enqueue(encoder.encode(word + ""));

      await new Promise((resolve) => setTimeout(resolve,100));
    }
    controller.close();
  },
});
return new Response(stream,{
  headers:{
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
  },
})
}