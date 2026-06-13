import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth";

const competitionSchema = z.object({
  name: z.string().trim().min(3).max(100),
  country: z.string().trim().max(60).optional(),
  season: z.string().trim().min(4).max(20),
});

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(request: NextRequest) {
  const { response } = await requireUser(request);
  if (response) return response;

  const competitions = await prisma.competition.findMany({
    where: { isActive: true },
    orderBy: [{ name: "asc" }, { season: "desc" }],
  });
  return Response.json({ competitions });
}

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const parsed = competitionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Competicion invalida" }, { status: 400 });
  }

  const baseSlug = slugify(parsed.data.name);
  const slug = `${baseSlug}-${parsed.data.season}`.replace(/-+/g, "-");
  const competition = await prisma.competition.upsert({
    where: { slug },
    update: {
      name: parsed.data.name,
      country: parsed.data.country || null,
      season: parsed.data.season,
      isActive: true,
    },
    create: {
      slug,
      name: parsed.data.name,
      country: parsed.data.country || null,
      season: parsed.data.season,
    },
  });

  return Response.json({ competition }, { status: 201 });
}
