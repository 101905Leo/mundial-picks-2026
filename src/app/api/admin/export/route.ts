import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

function csvCell(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const users = await prisma.user.findMany({
    where: { role: "USER" },
    orderBy: { name: "asc" },
    select: {
      name: true,
      phone: true,
      isActive: true,
      leagues: { select: { league: { select: { name: true } } } },
      predictions: {
        orderBy: { match: { startsAt: "asc" } },
        select: {
          homeScore: true,
          awayScore: true,
          points: true,
          match: {
            select: {
              homeTeam: true,
              awayTeam: true,
              startsAt: true,
              status: true,
              isPublished: true,
            },
          },
        },
      },
    },
  });

  const header = [
    "Usuario",
    "WhatsApp",
    "Estado",
    "Salas",
    "Partido",
    "Fecha",
    "Publicado",
    "Estado partido",
    "Pick",
    "Puntos",
  ];
  const rows = users.flatMap((user) => {
    const base = [
      user.name,
      user.phone,
      user.isActive ? "Activo" : "Desactivado",
      user.leagues.map((membership) => membership.league.name).join(" | "),
    ];

    if (!user.predictions.length) {
      return [[...base, "", "", "", "", "", ""]];
    }

    return user.predictions.map((prediction) => [
      ...base,
      `${prediction.match.homeTeam} vs ${prediction.match.awayTeam}`,
      prediction.match.startsAt.toISOString(),
      prediction.match.isPublished ? "Si" : "No",
      prediction.match.status,
      `${prediction.homeScore}-${prediction.awayScore}`,
      prediction.points,
    ]);
  });

  const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(";")).join("\n")}`;
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mundial-picks-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
