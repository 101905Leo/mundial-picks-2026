import { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request);
  return Response.json({ user });
}
