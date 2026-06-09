import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { updateResultsAndRecalculate } from "@/lib/automatic-results";

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  try {
    return Response.json(await updateResultsAndRecalculate());
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron actualizar los resultados";
    console.error("Automatic results update failed", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
