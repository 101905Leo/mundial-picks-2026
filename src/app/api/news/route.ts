import { fetchWorldCupNews } from "@/lib/worldcup-news";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const news = await fetchWorldCupNews();
    return Response.json(news);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron cargar noticias";
    return Response.json({ error: message, items: [] }, { status: 500 });
  }
}
