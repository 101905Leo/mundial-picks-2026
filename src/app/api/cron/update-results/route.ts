import { NextRequest } from "next/server";
import { updateResultsAndRecalculate } from "@/lib/automatic-results";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const querySecret = request.nextUrl.searchParams.get("secret");

  if (secret) {
    return authorization === `Bearer ${secret}` || querySecret === secret;
  }

  return process.env.NODE_ENV !== "production" || request.headers.get("user-agent") === "vercel-cron/1.0";
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const result = await updateResultsAndRecalculate({ enforceSchedule: true });
    return Response.json({
      ok: true,
      ranAt: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo ejecutar la automatizacion";
    console.error("Cron results update failed", error);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
