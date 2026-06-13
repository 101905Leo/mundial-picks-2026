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

export function StatisticsPanel() {
  const [scorers, setScorers] = useState<Scorer[]>([]);
  const [groups, setGroups] = useState<Standing[][]>([]);
  const [message, setMessage] = useState("Cargando estadisticas...");

  async function loadStatistics() {
    setMessage("Cargando estadisticas...");
    const response = await fetch("/api/statistics");
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudieron cargar las estadisticas");
      return;
    }

    setScorers(data.topScorers ?? []);
    setGroups(data.groups ?? []);
    setMessage(data.configured ? "" : "Configura API_FOOTBALL_KEY para mostrar datos oficiales.");
  }

  useEffect(() => {
    loadStatistics();
  }, []);

  return (
    <div className="statistics-page">
      <section className="panel statistics-header">
        <div>
          <span className="market-kicker">Copa Mundial 2026</span>
          <h2>Estadísticas de la competición</h2>
          <p className="muted">Goleadores, asistencias y posiciones de los grupos.</p>
        </div>
        <button className="button secondary" onClick={loadStatistics} type="button">
          Actualizar
        </button>
      </section>

      {message ? <div className="notice">{message}</div> : null}

      <section className="panel">
        <div className="section-title">
          <h2>Goleadores</h2>
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
          {!groups.length && !message ? <div className="empty">Las tablas apareceran cuando se publiquen resultados oficiales.</div> : null}
        </div>
      </section>
    </div>
  );
}
