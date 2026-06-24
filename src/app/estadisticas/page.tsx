import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Estadísticas | Mundial Picks Arena",
  description: "Goleadas, equipos más goleadores, mejores defensas, invictos y partidos con más goles.",
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

type StatRow = {
  label: string;
  value: string;
  meta: string;
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

  const topScorers = [...teams]
    .sort((a, b) => b.goalsFor - a.goalsFor || b.goalDifference - a.goalDifference)
    .slice(0, 8);

  const bestDefenses = [...teams]
    .sort((a, b) => a.goalsAgainst - b.goalsAgainst || b.points - a.points)
    .slice(0, 8);

  const bestDifference = [...teams]
    .sort((a, b) => b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor)
    .slice(0, 8);

  const invictos = [...teams]
    .filter((team) => team.played > 0 && team.losses === 0)
    .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference);

  const sinGanar = [...teams]
    .filter((team) => team.played > 0 && team.wins === 0)
    .sort((a, b) => b.played - a.played || a.points - b.points);

  const enrichedMatches = matches.map((match) => ({
    ...match,
    homeScore: match.homeScore ?? 0,
    awayScore: match.awayScore ?? 0,
    totalGoals: (match.homeScore ?? 0) + (match.awayScore ?? 0),
    difference: Math.abs((match.homeScore ?? 0) - (match.awayScore ?? 0)),
  }));

  const biggestWin = [...enrichedMatches].sort(
    (a, b) => b.difference - a.difference || b.totalGoals - a.totalGoals,
  )[0];

  const highestScoring = [...enrichedMatches].sort((a, b) => b.totalGoals - a.totalGoals)[0];
  const bestAttack = topScorers[0];
  const bestDefense = bestDefenses[0];

  const totalGoals = enrichedMatches.reduce((sum, match) => sum + match.totalGoals, 0);
  const averageGoals = matches.length > 0 ? (totalGoals / matches.length).toFixed(2) : "0.00";

  return (
    <main className="stats-premium-page">
      <section className="stats-premium-hero">
        <div className="stats-premium-hero__content">
          <p className="stats-premium-kicker">Mundial Picks Arena</p>
          <h1>Centro de estadísticas del torneo</h1>
          <p>
            Goleadas, equipos más goleadores, mejores defensas, invictos y partidos con más goles.
            Una sección pensada para que el fanático entre a revisar cómo se mueve el Mundial.
          </p>

          <div className="stats-premium-actions">
            <Link href="/mi-sala">Entrar a mi sala</Link>
            <Link href="/" className="secondary">
              Volver al inicio
            </Link>
          </div>
        </div>

        <div className="stats-premium-hero__panel">
          <span>Partidos analizados</span>
          <strong>{matches.length}</strong>
          <p>{totalGoals} goles registrados</p>
        </div>
      </section>

      <section className="stats-premium-metrics">
        <MetricCard label="Partidos finalizados" value={matches.length.toString()} icon="🏟️" />
        <MetricCard label="Goles totales" value={totalGoals.toString()} icon="⚽" />
        <MetricCard label="Promedio de goles" value={averageGoals} icon="📊" />
        <MetricCard label="Equipos con datos" value={teams.length.toString()} icon="🌍" />
      </section>

      {matches.length === 0 ? (
        <section className="stats-premium-empty">
          <h2>Todavía no hay estadísticas disponibles</h2>
          <p>Cuando existan partidos finalizados, aquí aparecerán goleadas, goles, defensas e invictos.</p>
          <Link href="/mi-sala">Entrar a mi sala</Link>
        </section>
      ) : (
        <>
          <section className="stats-premium-highlights">
            <HighlightCard
              label="Equipo más goleador"
              title={bestAttack?.team || "Sin datos"}
              value={bestAttack ? `${bestAttack.goalsFor} goles` : "0 goles"}
              detail={bestAttack ? `Diferencia de gol: ${bestAttack.goalDifference}` : "Esperando resultados"}
              icon="⚽"
            />

            <HighlightCard
              label="Mejor defensa"
              title={bestDefense?.team || "Sin datos"}
              value={bestDefense ? `${bestDefense.goalsAgainst} recibidos` : "0 recibidos"}
              detail={bestDefense ? `${bestDefense.points} puntos acumulados` : "Esperando resultados"}
              icon="🛡️"
            />

            <HighlightCard
              label="Mayor goleada"
              title={biggestWin ? `${biggestWin.homeTeam} ${biggestWin.homeScore} - ${biggestWin.awayScore} ${biggestWin.awayTeam}` : "Sin datos"}
              value={biggestWin ? `Diferencia: ${biggestWin.difference}` : "Sin marcador"}
              detail={biggestWin ? formatDate(biggestWin.startsAt) : "Esperando resultados"}
              icon="💥"
            />

            <HighlightCard
              label="Partido con más goles"
              title={highestScoring ? `${highestScoring.homeTeam} vs ${highestScoring.awayTeam}` : "Sin datos"}
              value={highestScoring ? `${highestScoring.totalGoals} goles` : "0 goles"}
              detail={highestScoring ? `${highestScoring.homeScore} - ${highestScoring.awayScore}` : "Esperando resultados"}
              icon="🔥"
            />
          </section>

          <section className="stats-premium-grid">
            <RankingCard
              title="⚽ Equipos más goleadores"
              rows={topScorers.map((team) => ({
                label: team.team,
                value: `${team.goalsFor} goles`,
                meta: `DG ${team.goalDifference}`,
              }))}
            />

            <RankingCard
              title="🛡️ Mejores defensas"
              rows={bestDefenses.map((team) => ({
                label: team.team,
                value: `${team.goalsAgainst} recibidos`,
                meta: `${team.points} pts`,
              }))}
            />

            <RankingCard
              title="📈 Mejor diferencia de gol"
              rows={bestDifference.map((team) => ({
                label: team.team,
                value: `DG ${team.goalDifference}`,
                meta: `${team.goalsFor} GF`,
              }))}
            />

            <RankingCard
              title="✅ Equipos invictos"
              rows={invictos.map((team) => ({
                label: team.team,
                value: `${team.played} PJ`,
                meta: `${team.points} pts`,
              }))}
              empty="No hay invictos por ahora."
            />
          </section>

          <section className="stats-premium-match-grid">
            <MatchList
              title="💥 Mayores goleadas"
              matches={[...enrichedMatches]
                .sort((a, b) => b.difference - a.difference || b.totalGoals - a.totalGoals)
                .slice(0, 8)}
              mode="difference"
            />

            <MatchList
              title="🎯 Partidos con más goles"
              matches={[...enrichedMatches].sort((a, b) => b.totalGoals - a.totalGoals).slice(0, 8)}
              mode="total"
            />
          </section>

          <section className="stats-premium-grid one">
            <RankingCard
              title="❌ Equipos sin ganar"
              rows={sinGanar.map((team) => ({
                label: team.team,
                value: `${team.played} PJ`,
                meta: `${team.draws}E / ${team.losses}P`,
              }))}
              empty="Todos los equipos con partidos registrados ya ganaron al menos una vez."
            />
          </section>
        </>
      )}
    </main>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <article className="stats-premium-metric">
      <span>{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function HighlightCard({
  label,
  title,
  value,
  detail,
  icon,
}: {
  label: string;
  title: string;
  value: string;
  detail: string;
  icon: string;
}) {
  return (
    <article className="stats-premium-highlight">
      <div className="stats-premium-highlight__icon">{icon}</div>
      <p>{label}</p>
      <h2>{title}</h2>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

function RankingCard({
  title,
  rows,
  empty = "Sin datos disponibles.",
}: {
  title: string;
  rows: StatRow[];
  empty?: string;
}) {
  return (
    <article className="stats-premium-card">
      <h2>{title}</h2>

      {rows.length === 0 ? (
        <p className="stats-premium-empty-text">{empty}</p>
      ) : (
        <div className="stats-premium-ranking">
          {rows.map((row, index) => (
            <div key={`${row.label}-${index}`} className="stats-premium-ranking-row">
              <span>{index + 1}</span>
              <div>
                <strong>{row.label}</strong>
                <small>{row.meta}</small>
              </div>
              <em>{row.value}</em>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function MatchList({
  title,
  matches,
  mode,
}: {
  title: string;
  matches: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    group: string | null;
    startsAt: Date;
    totalGoals: number;
    difference: number;
  }[];
  mode: "difference" | "total";
}) {
  return (
    <article className="stats-premium-card">
      <h2>{title}</h2>

      <div className="stats-premium-matches">
        {matches.map((match) => (
          <div key={match.id} className="stats-premium-match-row">
            <div>
              <strong>{match.homeTeam}</strong>
              <strong>{match.awayTeam}</strong>
            </div>

            <span>
              {match.homeScore} - {match.awayScore}
            </span>

            <small>
              {mode === "difference" ? `Diferencia ${match.difference}` : `${match.totalGoals} goles`} ·{" "}
              {match.group ? `Grupo ${match.group}` : "Torneo"} · {formatDate(match.startsAt)}
            </small>
          </div>
        ))}
      </div>
    </article>
  );
}
