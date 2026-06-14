import { NextRequest } from "next/server";
import { updateResultsAndRecalculate } from "@/lib/automatic-results";

export const dynamic = "force-dynamic";

function normalizeSecret(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  return trimmed.replace(/^["']|["']$/g, "");
}

function authorizationStatus(request: NextRequest) {
  const secret = normalizeSecret(process.env.CRON_SECRET);
  const authorizationSecret = normalizeSecret(
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""),
  );
  const querySecret = normalizeSecret(request.nextUrl.searchParams.get("secret"));

  if (secret) {
    return {
      ok: authorizationSecret === secret || querySecret === secret,
      hasConfiguredSecret: true,
      hasQuerySecret: Boolean(querySecret),
      hasAuthorizationHeader: Boolean(authorizationSecret),
    };
  }

  return {
    ok: process.env.NODE_ENV !== "production" || request.headers.get("user-agent") === "vercel-cron/1.0",
    hasConfiguredSecret: false,
    hasQuerySecret: Boolean(querySecret),
    hasAuthorizationHeader: Boolean(authorizationSecret),
  };
}

export async function GET(request: NextRequest) {
  const authorization = authorizationStatus(request);
  if (!authorization.ok) {
    return Response.json(
      {
        error: "No autorizado",
        detail: authorization.hasConfiguredSecret
          ? "El parametro secret no coincide con CRON_SECRET."
          : "CRON_SECRET no esta configurado para este despliegue.",
        hasConfiguredSecret: authorization.hasConfiguredSecret,
        hasQuerySecret: authorization.hasQuerySecret,
        hasAuthorizationHeader: authorization.hasAuthorizationHeader,
      },
      { status: 401 },
    );
  }

  try {
    const forceRun = ["1", "true", "si", "yes"].includes(
      (request.nextUrl.searchParams.get("force") ?? "").toLowerCase(),
    );
    const result = await updateResultsAndRecalculate({ enforceSchedule: !forceRun });
    return Response.json({
      ok: true,
      forced: forceRun,
      ranAt: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo ejecutar la automatizacion";
    console.error("Cron results update failed", error);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
