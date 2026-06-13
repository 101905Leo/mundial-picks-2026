import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { response } = await requireUser(request);
  if (response) return response;

  return Response.json(
    { error: "La inscripción individual fue eliminada. Los pagos se realizan únicamente al crear una sala." },
    { status: 410 },
  );
}
