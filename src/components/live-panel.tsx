"use client";

import type { Match } from "@/components/types";
import { flagForTeam } from "@/lib/team-flags";

type Props = {
  matches: Match[];
};

function statusLabel(status: Match["status"]) {
  if (status === "LIVE") return "En vivo";
  if (status === "FINISHED") return "Finalizado";
  return "Por jugar";
}

export function LivePanel({ matches }: Props) {
  const liveMatches = matches.filter((match) => match.status === "LIVE");
  const nextMatches = matches.filter((match) => match.status === "SCHEDULED").slice(0, 6);
  const finishedMatches = matches.filter((match) => match.status === "FINISHED").slice(-6).reverse();
  const visibleMatches = liveMatches.length ? liveMatches : [...nextMatches, ...finishedMatches].slice(0, 8);

  return (
    <section className="live-board">
      <div className="section-title">
        <div>
          <span className="market-kicker">Centro en vivo</span>
          <h2>Partidos, marcador y transmisión oficial</h2>
        </div>
        <span className="live-count">{liveMatches.length} en vivo</span>
      </div>

      <div className="live-notice">
        La app no transmite video directamente. Usa el botón de transmisión oficial cuando el administrador agregue el enlace autorizado.
      </div>

      <div className="live-list">
        {visibleMatches.length ? (
          visibleMatches.map((match) => (
            <article className={`live-card ${match.status.toLowerCase()}`} key={match.id}>
              <div className="live-card-header">
                <span className={`status ${match.status}`}>{statusLabel(match.status)}</span>
                <time>{new Date(match.startsAt).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}</time>
              </div>
              <div className="live-scoreline">
                <div>
                  <strong>{flagForTeam(match.homeTeam)}</strong>
                  <span>{match.homeTeam}</span>
                </div>
                <strong className="live-score">
                  {match.homeScore ?? "-"} - {match.awayScore ?? "-"}
                </strong>
                <div>
                  <strong>{flagForTeam(match.awayTeam)}</strong>
                  <span>{match.awayTeam}</span>
                </div>
              </div>
              <div className="live-meta">
                {match.group ? <span>{match.group}</span> : null}
                {match.venue ? <span>{match.venue}</span> : null}
              </div>
              {match.broadcastUrl ? (
                <a className="button primary" href={match.broadcastUrl} rel="noreferrer" target="_blank">
                  Ver transmisión oficial
                </a>
              ) : (
                <span className="live-missing-link">Enlace oficial pendiente</span>
              )}
            </article>
          ))
        ) : (
          <div className="empty">Cuando haya partidos publicados, aparecerán aquí.</div>
        )}
      </div>
    </section>
  );
}
