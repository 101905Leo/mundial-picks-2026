import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Estadísticas | Mundial Picks Arena",
  description: "Estadísticas reales del torneo: goleadas, equipos más goleadores, mejores defensas e invictos.",
};

type TeamStats = {
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(date);
}

function ensureTeam(map: Map<string, TeamStats>, team: string) {
  if (!map.has(team)) {
    map.set(team, {
      team,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  }

  return map.get(team)!;
}

export default async function EstadisticasPage() {
  const matches = await prisma.match.findMany({
    where: {
      roomId: null,
      status: "FINISHED",
      homeScore: { not: null },
      awayScore: { not: null },
    },
    select: {
      id: true,
      homeTeam: true,
      awayTeam: true,
      group: true,
      startsAt: true,
      homeScore: true,
      awayScore: true,
    },
    orderBy: { startsAt: "asc" },
  });

  const teamMap = new Map<string, TeamStats>();

  for (const match of matches) {
    const home = ensureTeam(teamMap, match.homeTeam);
    const away = ensureTeam(teamMap, match.awayTeam);
    const homeScore = match.homeScore ?? 0;
    const awayScore = match.awayScore ?? 0;

    home.played += 1;
    away.played += 1;

    home.goalsFor += homeScore;
    home.goalsAgainst += awayScore;
    away.goalsFor += awayScore;
    away.goalsAgainst += homeScore;

    if (homeScore > awayScore) {
      home.wins += 1;
      away.losses += 1;
      home.points += 3;
    } else if (homeScore < awayScore) {
      away.wins += 1;
      home.losses += 1;
      away.points += 3;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }

    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;
  }

  const teams = Array.from(teamMap.values());

  const topScorers = [...teams].sort((a, b) => b.goalsFor - a.goalsFor || b.goalDifference - a.goalDifference).slice(0, 8);
  const bestDefenses = [...teams].sort((a, b) => a.goalsAgainst - b.goalsAgainst || b.points - a.points).slice(0, 8);
  const bestDifference = [...teams].sort((a, b) => b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor).slice(0, 8);
  const invictos = [...teams].filter((team) => team.played > 0 && team.losses === 0).sort((a, b) => b.points - a.points);
  const sinGanar = [...teams].filter((team) => team.played > 0 && team.wins === 0).sort((a, b) => b.played - a.played);

  const goleadas = [...matches]
    .map((match) => ({
      ...match,
      totalGoals: (match.homeScore ?? 0) + (match.awayScore ?? 0),
      difference: Math.abs((match.homeScore ?? 0) - (match.awayScore ?? 0)),
    }))
    .sort((a, b) => b.difference - a.difference || b.totalGoals - a.totalGoals)
    .slice(0, 8);

  const partidosConMasGoles = [...matches]
    .map((match) => ({
      ...match,
      totalGoals: (match.homeScore ?? 0) + (match.awayScore ?? 0),
    }))
    .sort((a, b) => b.totalGoals - a.totalGoals)
    .slice(0, 8);

  const totalGoals = matches.reduce((sum, match) => sum + (match.homeScore ?? 0) + (match.awayScore ?? 0), 0);
  const averageGoals = matches.length > 0 ? (totalGoals / matches.length).toFixed(2) : "0.00";

  return (
    <main className="tournament-public-page">
      <section className="tournament-public-hero">
        <div>
          <p className="tournament-public-eyebrow">Estadísticas</p>
          <h1>Datos reales del torneo</h1>
          <p>
            Goleadas, equipos más goleadores, mejores defensas, invictos y partidos con más goles dentro de Mundial Picks Arena.
          </p>
        </div>

        <Link href="/mi-sala" className="tournament-public-cta">
          Entrar a mi sala
        </Link>
      </section>

      <nav className="tournament-public-nav" aria-label="Secciones del torneo">
        <Link href="/calendario">Calendario</Link>
        <Link href="/resultados">Resultados</Link>
        <Link href="/grupos">Grupos</Link>
        <Link href="/mejores-terceros">Mejores terceros</Link>
        <Link href="/llaves">Llaves</Link>
        <Link href="/estadisticas">Estadísticas</Link>
      </nav>

      <section className="stats-summary-grid">
        <article>
          <span>Partidos finalizados</span>
          <strong>{matches.length}</strong>
        </article>
        <article>
          <span>Goles totales</span>
          <strong>{totalGoals}</strong>
        </article>
        <article>
          <span>Promedio de goles</span>
          <strong>{averageGoals}</strong>
        </article>
        <article>
          <span>Equipos registrados</span>
          <strong>{teams.length}</strong>
        </article>
      </section>

      {matches.length === 0 ? (
        <section className="tournament-empty-state">
          <h2>Todavía no hay estadísticas disponibles</h2>
          <p>Cuando existan partidos finalizados con marcador, esta sección mostrará goleadas, goles y rankings de equipos.</p>
          <Link href="/calendario">Ver calendario</Link>
        </section>
      ) : (
        <>
          <section className="stats-section-grid">
            <StatsCard title="⚽ Equipos más goleadores" rows={topScorers.map((team) => ({
              label: team.team,
              value: `${team.goalsFor} goles`,
              meta: `DG ${team.goalDifference}`,
            }))} />

            <StatsCard title="🛡️ Mejores defensas" rows={bestDefenses.map((team) => ({
              label: team.team,
              value: `${team.goalsAgainst} recibidos`,
              meta: `${team.points} pts`,
            }))} />

            <StatsCard title="🔥 Mejor diferencia de gol" rows={bestDifference.map((team) => ({
              label: team.team,
              value: `DG ${team.goalDifference}`,
              meta: `${team.goalsFor} GF`,
            }))} />

            <StatsCard title="✅ Invictos" rows={invictos.map((team) => ({
              label: team.team,
              value: `${team.played} PJ`,
              meta: `${team.points} pts`,
            }))} empty="No hay invictos por ahora." />
          </section>

          <section className="stats-wide-grid">
            <article className="stats-card stats-card-wide">
              <h2>💥 Mayores goleadas</h2>
              <div className="stats-match-list">
                {goleadas.map((match) => (
                  <div key={match.id} className="stats-match-row">
                    <strong>{match.homeTeam}</strong>
                    <span>{match.homeScore} - {match.awayScore}</span>
                    <strong>{match.awayTeam}</strong>
                    <small>{match.group ? `Grupo ${match.group}` : "Torneo"} · {formatDate(match.startsAt)}</small>
                  </div>
                ))}
              </div>
            </article>

            <article className="stats-card stats-card-wide">
              <h2>🎯 Partidos con más goles</h2>
              <div className="stats-match-list">
                {partidosConMasGoles.map((match) => (
                  <div key={match.id} className="stats-match-row">
                    <strong>{match.homeTeam}</strong>
                    <span>{match.homeScore} - {match.awayScore}</span>
                    <strong>{match.awayTeam}</strong>
                    <small>{match.totalGoals} goles · {formatDate(match.startsAt)}</small>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="stats-section-grid">
            <StatsCard title="❌ Equipos sin ganar" rows={sinGanar.map((team) => ({
              label: team.team,
              value: `${team.played} PJ`,
              meta: `${team.draws}E / ${team.losses}P`,
            }))} empty="Todos los equipos registrados ya ganaron al menos una vez." />
          </section>
        </>
      )}
    </main>
  );
}

function StatsCard({
  title,
  rows,
  empty = "Sin datos disponibles.",
}: {
  title: string;
  rows: { label: string; value: string; meta: string }[];
  empty?: string;
}) {
  return (
    <article className="stats-card">
      <h2>{title}</h2>

      {rows.length === 0 ? (
        <p className="stats-empty">{empty}</p>
      ) : (
        <div className="stats-list">
          {rows.map((row, index) => (
            <div key={`${row.label}-${index}`} className="stats-row">
              <span>{index + 1}</span>
              <strong>{row.label}</strong>
              <em>{row.value}</em>
              <small>{row.meta}</small>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
