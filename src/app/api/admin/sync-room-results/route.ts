import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { recalculateFinishedMatchPoints } from "@/lib/recalculate-points";
import { syncRoomResultsFromGlobal } from "@/lib/sync-room-results";

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const roomId = request.nextUrl.searchParams.get("roomId")?.trim() || undefined;

  try {
    const result = await syncRoomResultsFromGlobal({ roomId });
    const predictionsUpdated = await recalculateFinishedMatchPoints();
    return Response.json({ ok: true, result, predictionsUpdated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron sincronizar resultados de salas";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
