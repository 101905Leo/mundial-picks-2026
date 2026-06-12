import { getWorldCupStatistics } from "@/lib/worldcup-statistics";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getWorldCupStatistics());
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron cargar las estadisticas";
    return Response.json({ error: message }, { status: 502 });
  }
}
