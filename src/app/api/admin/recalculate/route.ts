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

  const whatsapp = await notifyWhatsAppUsers(
    clearManualPoints
      ? `Mundial Picks Arena: puntos recalculados automaticamente. Picks actualizados: ${updated}.`
      : `Mundial Picks Arena: puntos recalculados. Picks actualizados: ${updated}.`,
  );

  return Response.json({ updated, clearManualPoints, whatsapp });
}
