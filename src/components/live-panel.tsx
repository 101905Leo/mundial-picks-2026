"use client";

import type { CSSProperties } from "react";
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

function fanStyle(index: number, total: number): CSSProperties {
  const offset = index - (total - 1) / 2;

  return {
    "--fan-x": `${offset * 185}px`,
    "--fan-rotate": `${offset * 6}deg`,
    "--fan-z": `${20 + index}`,
  } as CSSProperties;
}

export function LivePanel({ matches }: Props) {
  const externalLiveUrl = "https://goallive.online";
  const liveMatches = matches.filter((match) => match.status === "LIVE");
  const nextMatches = matches.filter((match) => match.status === "SCHEDULED").slice(0, 6);
  const finishedMatches = matches.filter((match) => match.status === "FINISHED").slice(-6).reverse();
  const visibleMatches = liveMatches.length ? liveMatches : [...nextMatches, ...finishedMatches].slice(0, 8);

  return (
    <section className="live-board">
      <div className="section-title">
        <div>
          <span className="market-kicker">Centro en vivo</span>
          <h2>Partidos, marcadores y opciones para verlos</h2>
        </div>
        <span className="live-count">{liveMatches.length} en vivo</span>
      </div>

      <div className="live-notice live-external-notice">
        <span>La app no transmite video directamente. GoalLive es un sitio externo e independiente.</span>
        <a className="button primary" href={externalLiveUrl} rel="noreferrer" target="_blank">
          Abrir GoalLive
        </a>
      </div>

      {liveMatches.length > 1 ? (
        <div className="live-fan-board" aria-label={`${liveMatches.length} partidos en vivo`}>
          {liveMatches.map((match, index) => (
            <article className="live-fan-card" key={match.id} style={fanStyle(index, liveMatches.length)}>
              <div className="live-fan-header">
                <span className={`status ${match.status}`}>{statusLabel(match.status)}</span>
                <small>{match.group ?? "Torneo"}</small>
              </div>

              <div className="live-fan-teams">
                <div>
                  <strong>{flagForTeam(match.homeTeam)}</strong>
                  <span>{match.homeTeam}</span>
                </div>

                <strong className="live-fan-score">
                  {match.homeScore ?? "-"} - {match.awayScore ?? "-"}
                </strong>

                <div>
                  <strong>{flagForTeam(match.awayTeam)}</strong>
                  <span>{match.awayTeam}</span>
                </div>
              </div>

              <div className="live-fan-footer">
                {match.venue ? <span>{match.venue}</span> : <span>Marcador en vivo</span>}
                {match.broadcastUrl ? (
                  <a href={match.broadcastUrl} rel="noreferrer" target="_blank">
                    Ver
                  </a>
                ) : (
                  <a href={externalLiveUrl} rel="noreferrer" target="_blank">
                    GoalLive
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
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
                  <a className="button secondary" href={externalLiveUrl} rel="noreferrer" target="_blank">
                    Ver en GoalLive (sitio externo)
                  </a>
                )}
              </article>
            ))
          ) : (
            <div className="empty">Cuando haya partidos publicados, aparecerán aquí.</div>
          )}
        </div>
      )}
    </section>
  );
}
