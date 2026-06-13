"use client";

import { useMemo, useState } from "react";
import type { RankingEntry, User } from "@/components/types";

type Props = {
  ranking: RankingEntry[];
  user: User;
  onOpenPicks: () => void;
};

export function GlobalRankingPanel({ ranking, user, onOpenPicks }: Props) {
  const [query, setQuery] = useState("");
  const topRanking = useMemo(() => ranking.slice(0, 100), [ranking]);
  const userIndex = ranking.findIndex((entry) => entry.id === user.id);
  const userRanking = userIndex >= 0 ? ranking[userIndex] : null;
  const filteredRanking = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return topRanking;

    return ranking
      .filter((entry) => entry.name.toLowerCase().includes(normalizedQuery) || entry.id.toLowerCase().includes(normalizedQuery))
      .slice(0, 100);
  }, [query, ranking, topRanking]);

  return (
    <section className="ranking-page">
      <div className="ranking-hero">
        <div>
          <span className="market-kicker">Mundial Picks 2026</span>
          <h2>Ranking mundial</h2>
          <p>
            El ranking oficial de la quiniela aparecerá cuando empiece el Mundial. Desde aquí puedes buscar jugadores,
            revisar tu posición y ver el Top 100 global.
          </p>
        </div>
        <aside className="ranking-access-card">
          <span>Tu acceso</span>
          <strong>{user.name}</strong>
          <p>Ranking disponible. Para competir y guardar picks debes pertenecer a una sala.</p>
        </aside>
      </div>

      <div className="ranking-stat-grid">
        <article>
          <span>Jugadores inscritos</span>
          <strong>{ranking.length}</strong>
          <small>Participantes registrados</small>
        </article>
        <article>
          <span>Tu posición</span>
          <strong>{userIndex >= 0 ? `#${userIndex + 1}` : "Pendiente"}</strong>
          <small>{userRanking ? "Ya apareces en el ranking" : "Guarda picks para competir"}</small>
        </article>
        <article>
          <span>Tus puntos</span>
          <strong>{userRanking?.points ?? 0}</strong>
          <small>{userRanking?.predictions ?? 0} picks guardados</small>
        </article>
        <article>
          <span>Top visible</span>
          <strong>100</strong>
          <small>Disponible para inscritos</small>
        </article>
      </div>

      <div className="ranking-search-panel">
        <input
          aria-label="Buscar jugador"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar jugador por nombre o ID..."
          value={query}
        />
        <button className="button primary" type="button">
          Buscar
        </button>
        <button className="button secondary" onClick={onOpenPicks} type="button">
          Mis picks
        </button>
      </div>

      <section className="ranking-board">
        <div className="section-title">
          <div>
            <span className="market-kicker">Ranking mundial</span>
            <h2>Top 100 global</h2>
          </div>
          <span className="muted">{filteredRanking.length} visibles</span>
        </div>
        <div className="ranking-table-wrap">
          <table className="ranking big">
            <thead>
              <tr>
                <th>#</th>
                <th>Jugador</th>
                <th>ID</th>
                <th>Picks</th>
                <th>Puntos</th>
              </tr>
            </thead>
            <tbody>
              {filteredRanking.map((entry) => {
                const position = ranking.findIndex((item) => item.id === entry.id) + 1;

                return (
                  <tr className={entry.id === user.id ? "current-user" : ""} key={entry.id}>
                    <td>{position}</td>
                    <td>{entry.name}</td>
                    <td>{entry.id.slice(0, 8)}</td>
                    <td>{entry.predictions}</td>
                    <td>
                      <strong>{entry.points}</strong>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filteredRanking.length ? <div className="empty">No encontramos jugadores con esa búsqueda.</div> : null}
        </div>
      </section>
    </section>
  );
}
