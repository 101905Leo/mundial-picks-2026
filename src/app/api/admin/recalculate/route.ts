import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { recalculateFinishedMatchPoints } from "@/lib/recalculate-points";
import { notifyWhatsAppUsers } from "@/lib/whatsapp";

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const body = await request.json().catch(() => ({}));
  const clearManualPoints = body?.clearManualPoints === true;
  const updated = await recalculateFinishedMatchPoints({ clearManualPoints });

  await notifyWhatsAppUsers(
    clearManualPoints
      ? `Puntos recalculados automaticamente en Copa Mundial de la FIFA 2026™. Picks actualizados: ${updated}.`
      : `Puntos recalculados en Copa Mundial de la FIFA 2026™. Picks actualizados: ${updated}.`,
  );

  return Response.json({ updated, clearManualPoints });
}
