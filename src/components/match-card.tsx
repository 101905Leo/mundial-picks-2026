"use client";

import { FormEvent, useState } from "react";
import type { Match } from "@/components/types";
import { isPickClosed } from "@/lib/pick-lock";
import { flagForTeam } from "@/lib/team-flags";

type Props = {
  match: Match;
  signedIn: boolean;
  canPredict: boolean;
  disabledMessage: string;
  onSaved: () => void;
  roomId?: string;
};

export function MatchCard({ match, signedIn, canPredict, disabledMessage, onSaved, roomId }: Props) {
  const prediction = match.predictions?.[0];
  const [message, setMessage] = useState("");
  const startsAt = new Date(match.startsAt);
  const isClosed = isPickClosed(startsAt) || match.status === "LIVE" || match.status === "FINISHED";
  const inputDisabled = isClosed || !canPredict;

  async function savePrediction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canPredict) {
      setMessage(disabledMessage);
      return;
    }
    setMessage("");

    try {
      const formData = new FormData(event.currentTarget);
      const response = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: match.id,
          roomId,
          homeScore: Number(formData.get("homeScore")),
          awayScore: Number(formData.get("awayScore")),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.error ?? "No se pudo guardar el pick");
        return;
      }

      setMessage("Pick guardado");
      await onSaved();
    } catch {
      setMessage("No hay conexión con el servidor. Verifica la base de datos e intenta nuevamente.");
    }
  }

  return (
    <article className="market-row">
      <div className="match-cell">
        <div className="match-time">
          <span className={`status ${match.status}`}>{match.status}</span>
          <span>{startsAt.toLocaleString("es", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          {isClosed ? <span className="pick-closed-badge">Pick cerrado</span> : null}
        </div>
        {signedIn ? (
          <form className="pick-form team-pick-form" onSubmit={savePrediction}>
            <div className="pick-team-row">
              <label htmlFor={`${match.id}-home`}>
                <strong>{flagForTeam(match.homeTeam)}</strong>
                <span>{match.homeTeam}</span>
              </label>
              <input
                id={`${match.id}-home`}
                name="homeScore"
                type="number"
                min={0}
                defaultValue={prediction?.homeScore ?? 0}
                disabled={inputDisabled}
                required
              />
            </div>
            <div className="pick-team-row">
              <label htmlFor={`${match.id}-away`}>
                <strong>{flagForTeam(match.awayTeam)}</strong>
                <span>{match.awayTeam}</span>
              </label>
              <input
                id={`${match.id}-away`}
                name="awayScore"
                type="number"
                min={0}
                defaultValue={prediction?.awayScore ?? 0}
                disabled={inputDisabled}
                required
              />
            </div>
            <button className="button primary" disabled={inputDisabled} type="submit">
              Guardar
            </button>
            {isClosed ? (
              <p className="pick-closed-message">Predicciones cerradas. No se pueden guardar picks al comenzar el partido.</p>
            ) : null}
            {!canPredict && !isClosed ? (
              <p className="pick-payment-message">{disabledMessage}</p>
            ) : null}
          </form>
        ) : (
          <>
            <div className="teams-stack">
              <span>
                <strong>{flagForTeam(match.homeTeam)}</strong>
                {match.homeTeam}
              </span>
              <span>
                <strong>{flagForTeam(match.awayTeam)}</strong>
                {match.awayTeam}
              </span>
            </div>
            <p className="match-login-message">Inicia sesion para guardar tu marcador.</p>
          </>
        )}
        <div className="match-context">
          {match.group ? <span>{match.group}</span> : null}
          {match.venue ? <span>{match.venue}</span> : null}
        </div>
      </div>

      <div className="official-score">
        <span>{match.homeScore ?? "-"}</span>
        <span>{match.awayScore ?? "-"}</span>
      </div>

      <div className="points-cell">
        <strong>{prediction ? prediction.points : "-"}</strong>
        {prediction ? <span>{prediction.homeScore}-{prediction.awayScore}</span> : <span>Sin pick</span>}
        {message ? <span>{message}</span> : null}
      </div>
    </article>
  );
}
