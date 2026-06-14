import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const publishDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  publish: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const body = await request.json();
  const parsed = publishDaySchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "Fecha invalida" }, { status: 400 });
  }

  const start = new Date(`${parsed.data.date}T00:00:00.000-05:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const result = await prisma.match.updateMany({
    where: {
      startsAt: {
        gte: start,
        lt: end,
      },
    },
    data: {
      isPublished: parsed.data.publish,
    },
  });

  return Response.json({ updated: result.count, date: parsed.data.date, publish: parsed.data.publish });
}
