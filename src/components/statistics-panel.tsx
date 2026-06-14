"use client";

import { useEffect, useState } from "react";

type Scorer = {
  id: number;
  name: string;
  photo: string;
  team: string;
  teamLogo: string;
  goals: number;
  assists: number;
  appearances: number;
};

type Standing = {
  rank: number;
  team: string;
  teamLogo: string;
  group: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

type TeamStat = {
  team: string;
  played: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

type PredictionSuggestion = {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  startsAt: string;
  suggestedHomeScore: number;
  suggestedAwayScore: number;
  confidence: string;
  reason: string;
};

type Props = {
  roomId: string;
};

export function StatisticsPanel({ roomId }: Props) {
  const [scorers, setScorers] = useState<Scorer[]>([]);
  const [groups, setGroups] = useState<Standing[][]>([]);
  const [teamStats, setTeamStats] = useState<TeamStat[]>([]);
  const [suggestions, setSuggestions] = useState<PredictionSuggestion[]>([]);
  const [message, setMessage] = useState("Cargando estadisticas...");

  async function loadStatistics() {
    setMessage("Cargando estadisticas...");
    const query = roomId ? `?roomId=${encodeURIComponent(roomId)}` : "";
    const response = await fetch(`/api/statistics${query}`, { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudieron cargar las estadisticas");
      return;
    }

    setScorers(data.topScorers ?? []);
    setGroups(data.groups ?? []);
    setTeamStats(data.localTeamStats ?? []);
    setSuggestions(data.predictionSuggestions ?? []);
    setMessage(
      data.localMatchesCount > 0
        ? "Mostrando estadísticas calculadas solo con los partidos de esta sala."
        : "Esta sala aún no tiene suficientes marcadores cargados para calcular estadísticas.",
    );
  }

  useEffect(() => {
    loadStatistics();
  }, [roomId]);

  return (
    <div className="statistics-page">
      <section className="panel statistics-header">
        <div>
          <span className="market-kicker">Sala privada</span>
          <h2>Estadísticas de la sala</h2>
          <p className="muted">Rendimiento, tabla y sugerencias calculadas únicamente con los partidos de esta sala.</p>
        </div>
        <button className="button secondary" onClick={loadStatistics} type="button">
          Actualizar
        </button>
      </section>

      {message ? <div className="notice">{message}</div> : null}

      <section className="panel">
        <div className="section-title">
          <h2>Pronósticos sugeridos</h2>
          <span className="muted">Modelo base con datos de esta sala</span>
        </div>
        <div className="suggestion-grid">
          {suggestions.map((suggestion) => (
            <article className="suggestion-card" key={suggestion.matchId}>
              <div>
                <strong>{suggestion.homeTeam} vs {suggestion.awayTeam}</strong>
                <span>{new Date(suggestion.startsAt).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}</span>
              </div>
              <strong className="suggestion-score">
                {suggestion.suggestedHomeScore} - {suggestion.suggestedAwayScore}
              </strong>
              <small>Confianza {suggestion.confidence}. {suggestion.reason}</small>
            </article>
          ))}
          {!suggestions.length ? <div className="empty">Las sugerencias aparecerán cuando haya próximos partidos publicados.</div> : null}
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>Goleadores</h2>
          {!scorers.length ? <span className="muted">No disponible en estadísticas de sala</span> : null}
        </div>
        <div className="scorer-grid">
          {scorers.map((player, index) => (
            <article className="scorer-card" key={`${player.id}-${player.name}`}>
              <strong className="scorer-rank">{index + 1}</strong>
              {player.photo ? <img alt={player.name} src={player.photo} /> : <span className="scorer-avatar">{player.name[0]}</span>}
              <div>
                <strong>{player.name}</strong>
                <span>{player.team}</span>
                <small>{player.assists} asistencias · {player.appearances} partidos</small>
              </div>
              <strong className="scorer-goals">{player.goals}</strong>
            </article>
          ))}
          {!scorers.length && !message ? <div className="empty">Los goleadores apareceran cuando la API publique datos.</div> : null}
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>Rendimiento por selección</h2>
        </div>
        <div className="team-stat-grid">
          {teamStats.slice(0, 12).map((team) => (
            <article className="team-stat-card" key={team.team}>
              <strong>{team.team}</strong>
              <span>{team.played} PJ · {team.points} pts</span>
              <small>{team.goalsFor} GF · {team.goalsAgainst} GC · DG {team.goalDifference}</small>
            </article>
          ))}
          {!teamStats.length ? <div className="empty">Carga resultados para ver rendimiento por selección.</div> : null}
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <h2>Posiciones por grupo</h2>
        </div>
        <div className="standings-grid">
          {groups.map((rows, groupIndex) => (
            <article className="standing-card" key={rows[0]?.group || groupIndex}>
              <h3>{rows[0]?.group || `Grupo ${groupIndex + 1}`}</h3>
              <div className="standing-head">
                <span>Pos</span><span>Seleccion</span><span>PJ</span><span>DG</span><span>Pts</span>
              </div>
              {rows.map((row) => (
                <div className="standing-row" key={`${row.rank}-${row.team}`}>
                  <strong>{row.rank}</strong>
                  <span>{row.team}</span>
                  <span>{row.played}</span>
                  <span>{row.goalDifference}</span>
                  <strong>{row.points}</strong>
                </div>
              ))}
            </article>
          ))}
          {!groups.length && !message ? <div className="empty">Las tablas aparecerán cuando esta sala tenga resultados cargados.</div> : null}
        </div>
      </section>
    </div>
  );
}
