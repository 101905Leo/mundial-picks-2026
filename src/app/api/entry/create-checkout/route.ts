import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { createWompiEntryCheckout } from "@/lib/wompi";

export async function POST(request: NextRequest) {
  const { user, response } = await requireUser(request);
  if (response) return response;

  if (user?.role === "ADMIN" || user?.entryPaidAt) {
    return Response.json({ error: "La inscripcion ya esta activa" }, { status: 409 });
  }

  try {
    const checkout = await createWompiEntryCheckout(user!);
    return Response.json(checkout);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear la inscripcion";
    return Response.json({ error: message }, { status: 500 });
  }
}
