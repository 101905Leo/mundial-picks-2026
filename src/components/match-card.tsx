"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Match } from "@/components/types";
import { isPickClosed } from "@/lib/pick-lock";
import { explainPredictionPoints } from "@/lib/scoring";
import { matchStatusLabel } from "@/lib/status-labels";
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
  const [modalOpen, setModalOpen] = useState(false);
  const [homePick, setHomePick] = useState(prediction?.homeScore ?? 0);
  const [awayPick, setAwayPick] = useState(prediction?.awayScore ?? 0);
  const startsAt = new Date(match.startsAt);
  const isClosed = isPickClosed(startsAt) || match.status === "LIVE" || match.status === "FINISHED";
  const inputDisabled = isClosed || !canPredict;
  const pointExplanation =
    prediction && match.homeScore !== null && match.awayScore !== null
      ? explainPredictionPoints(
          { homeScore: prediction.homeScore, awayScore: prediction.awayScore },
          { homeScore: match.homeScore, awayScore: match.awayScore },
        )
      : null;
  const quickPicks = [
    { label: "Victoria local", homeScore: 1, awayScore: 0 },
    { label: "Empate", homeScore: 1, awayScore: 1 },
    { label: "Victoria visitante", homeScore: 0, awayScore: 1 },
  ];

  useEffect(() => {
    setHomePick(prediction?.homeScore ?? 0);
    setAwayPick(prediction?.awayScore ?? 0);
  }, [match.id, prediction?.homeScore, prediction?.awayScore]);

  useEffect(() => {
    if (!modalOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setModalOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [modalOpen]);

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
          leagueId: roomId,
          roomKey: roomId ?? "GLOBAL",
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
      setModalOpen(false);
      await onSaved();
    } catch {
      setMessage("No hay conexión con el servidor. Verifica la base de datos e intenta nuevamente.");
    }
  }

  return (
    <article className={`market-row match-status-${match.status.toLowerCase()}`}>
      <div className="match-cell">
        <div className="match-time">
          <span className={`status ${match.status}`}>{matchStatusLabel(match.status)}</span>
          <span>{startsAt.toLocaleString("es", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          {isClosed ? <span className="pick-closed-badge">Pick cerrado</span> : null}
        </div>
        <div className="teams-stack">
          <span>
            <strong>{flagForTeam(match.homeTeam)}</strong>
            <span>
              <b>{match.homeTeam}</b>
              <small>Local</small>
            </span>
          </span>
          <em>vs</em>
          <span>
            <strong>{flagForTeam(match.awayTeam)}</strong>
            <span>
              <b>{match.awayTeam}</b>
              <small>Visitante</small>
            </span>
          </span>
        </div>
        <div className="match-context">
          {match.group ? <span>{match.group}</span> : null}
          {match.venue ? <span>{match.venue}</span> : null}
        </div>
      </div>

      <div className="match-pick-action">
        {signedIn ? (
          <div className="pick-launcher">
            <button
              className="button primary pick-open-button"
              disabled={inputDisabled}
              onClick={() => {
                setMessage("");
                setModalOpen(true);
              }}
              type="button"
            >
              {prediction ? "Editar pronóstico" : "Hacer pronóstico"}
            </button>
            {prediction ? (
              <div className="saved-pick-pill">
                <span>Mi pronóstico</span>
                <strong>{prediction.homeScore} - {prediction.awayScore}</strong>
              </div>
            ) : null}
            {isClosed ? (
              <p className="pick-closed-message">Pronósticos cerrados. No se pueden guardar al comenzar el partido.</p>
            ) : null}
            {!canPredict && !isClosed ? (
              <p className="pick-payment-message">{disabledMessage}</p>
            ) : null}
          </div>
        ) : (
          <p className="match-login-message">Inicia sesión para guardar tu marcador.</p>
        )}
      </div>

      <div className="official-score">
        <span>{match.homeScore ?? "-"}</span>
        <span>{match.awayScore ?? "-"}</span>
      </div>

      <div className="points-cell">
        <strong>{prediction ? prediction.points : "-"}</strong>
        {prediction ? <span>{prediction.homeScore}-{prediction.awayScore}</span> : <span>Sin pick</span>}
        {prediction && pointExplanation ? (
          <details className="points-breakdown">
            <summary>Detalle</summary>
            <span>Resultado: {match.homeScore} - {match.awayScore}</span>
            <span>Mi pronóstico: {prediction.homeScore} - {prediction.awayScore}</span>
            <span>Puntos: {pointExplanation.points}</span>
            <span>Motivo: {pointExplanation.reason}</span>
          </details>
        ) : null}
        {message ? <span>{message}</span> : null}
      </div>

      {modalOpen ? (
        <div className="prediction-modal-backdrop" role="presentation">
          <form className="prediction-modal" onSubmit={savePrediction} role="dialog" aria-modal="true" aria-label="Hacer predicción">
            <input name="homeScore" type="hidden" value={homePick} />
            <input name="awayScore" type="hidden" value={awayPick} />
            <span className="prediction-drag-handle" aria-hidden="true" />
            <header className="prediction-modal-header">
              <div>
                <span className="market-kicker">Tu pronóstico</span>
                <h3>Tu pronóstico</h3>
                <p className="prediction-match-info">
                  {match.group ? <span>{match.group}</span> : null}
                  <span>{startsAt.toLocaleDateString("es", { weekday: "short", day: "2-digit", month: "short" })}</span>
                  <strong>{startsAt.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}</strong>
                  {match.venue ? <span>{match.venue}</span> : null}
                </p>
              </div>
              <button className="prediction-close" onClick={() => setModalOpen(false)} type="button" aria-label="Cerrar">
                ×
              </button>
            </header>

            <div className="prediction-teams">
              <div className="prediction-team">
                <span className="prediction-flag">{flagForTeam(match.homeTeam)}</span>
                <strong>{match.homeTeam}</strong>
                <small>Local</small>
                <div className="prediction-stepper">
                  <button aria-label={`Restar gol a ${match.homeTeam}`} onClick={() => setHomePick((score) => Math.max(0, score - 1))} type="button">−</button>
                  <strong>{homePick}</strong>
                  <button aria-label={`Sumar gol a ${match.homeTeam}`} onClick={() => setHomePick((score) => score + 1)} type="button">+</button>
                </div>
              </div>
              <span className="prediction-divider">-</span>
              <div className="prediction-team">
                <span className="prediction-flag">{flagForTeam(match.awayTeam)}</span>
                <strong>{match.awayTeam}</strong>
                <small>Visitante</small>
                <div className="prediction-stepper">
                  <button aria-label={`Restar gol a ${match.awayTeam}`} onClick={() => setAwayPick((score) => Math.max(0, score - 1))} type="button">−</button>
                  <strong>{awayPick}</strong>
                  <button aria-label={`Sumar gol a ${match.awayTeam}`} onClick={() => setAwayPick((score) => score + 1)} type="button">+</button>
                </div>
              </div>
            </div>

            <p className="prediction-helper prediction-edit-note">Puedes editar tu pronóstico hasta 1 hora antes del partido.</p>

            <section className="quick-picks compact-quick-picks">
              <span>Atajos rápidos</span>
              <div>
                {quickPicks.map((quickPick) => (
                  <button
                    aria-pressed={homePick === quickPick.homeScore && awayPick === quickPick.awayScore}
                    className={homePick === quickPick.homeScore && awayPick === quickPick.awayScore ? "quick-pick-button selected" : "quick-pick-button"}
                    key={quickPick.label}
                    onClick={() => {
                      setHomePick(quickPick.homeScore);
                      setAwayPick(quickPick.awayScore);
                    }}
                    type="button"
                  >
                    <strong>{quickPick.homeScore} - {quickPick.awayScore}</strong>
                    <small>{quickPick.label}</small>
                  </button>
                ))}
              </div>
            </section>

            <button className="button primary prediction-submit" type="submit">
              Guardar pronóstico
            </button>
            {message ? <p className="prediction-error">{message}</p> : null}

            <details className="prediction-scoring-details">
              <summary>¿Cómo se puntúa?</summary>
              <div>
                <span><strong>+5</strong> Marcador exacto</span>
                <span><strong>+3</strong> Ganador correcto</span>
                <span><strong>+2</strong> Diferencia correcta</span>
                <span><strong>+1</strong> Participación</span>
              </div>
            </details>
          </form>
        </div>
      ) : null}
    </article>
  );
}
