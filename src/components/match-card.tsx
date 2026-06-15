"use client";

import { FormEvent, useEffect, useState } from "react";
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

function trendForMatch(match: Match) {
  const seed = `${match.homeTeam}-${match.awayTeam}`
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0);
  const home = 38 + (seed % 19);
  const draw = 18 + (seed % 9);
  const away = Math.max(12, 100 - home - draw);
  const total = home + draw + away;

  return {
    home: Math.round((home / total) * 100),
    draw: Math.round((draw / total) * 100),
    away: Math.round((away / total) * 100),
  };
}

function matchStatusLabel(status: Match["status"]) {
  if (status === "LIVE") return "En vivo";
  if (status === "FINISHED") return "Finalizado";
  return "Programado";
}

export function MatchCard({ match, signedIn, canPredict, disabledMessage, onSaved, roomId }: Props) {
  const prediction = match.predictions?.[0];
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [aiPreviewOpen, setAiPreviewOpen] = useState(false);
  const [homePick, setHomePick] = useState(prediction?.homeScore ?? 0);
  const [awayPick, setAwayPick] = useState(prediction?.awayScore ?? 0);
  const startsAt = new Date(match.startsAt);
  const isClosed = isPickClosed(startsAt) || match.status === "LIVE" || match.status === "FINISHED";
  const inputDisabled = isClosed || !canPredict;
  const trend = trendForMatch(match);
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
    <article className="market-row">
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
                setAiPreviewOpen(false);
                setModalOpen(true);
              }}
              type="button"
            >
              {prediction ? "Editar pick" : "Hacer pick"}
            </button>
            {prediction ? (
              <div className="saved-pick-pill">
                <span>Tu pick</span>
                <strong>{prediction.homeScore} - {prediction.awayScore}</strong>
              </div>
            ) : null}
            {isClosed ? (
              <p className="pick-closed-message">Predicciones cerradas. No se pueden guardar picks al comenzar el partido.</p>
            ) : null}
            {!canPredict && !isClosed ? (
              <p className="pick-payment-message">{disabledMessage}</p>
            ) : null}
          </div>
        ) : (
          <p className="match-login-message">Inicia sesion para guardar tu marcador.</p>
        )}
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

            <section className="quick-picks">
              <span>Predicciones rápidas</span>
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

            <section className="possible-points" aria-label="Puntos posibles">
              <span>Puntos posibles</span>
              <div>
                <p><strong>🎯 Marcador exacto:</strong> <span>+5 pts</span></p>
                <p><strong>✅ Ganador correcto:</strong> <span>+3 pts</span></p>
                <p><strong>📊 Diferencia correcta:</strong> <span>+2 pts</span></p>
                <p><strong>👀 Participación:</strong> <span>+1 pt</span></p>
              </div>
            </section>

            <p className="prediction-helper prediction-edit-note">Puedes editar tu pronóstico hasta 1 hora antes del partido.</p>

            <section className={`ai-preview ${aiPreviewOpen ? "open" : ""}`}>
              <button
                aria-controls={`ai-preview-${match.id}`}
                aria-expanded={aiPreviewOpen}
                className="ai-preview-toggle"
                onClick={() => setAiPreviewOpen((open) => !open)}
                type="button"
              >
                <span>✨ Previa con IA</span>
                <strong>{aiPreviewOpen ? "−" : "+"}</strong>
              </button>
              {aiPreviewOpen ? (
                <p className="ai-preview-content" id={`ai-preview-${match.id}`}>
                  Análisis disponible antes del partido.
                </p>
              ) : null}
            </section>

            <section className="prediction-trend">
              <span>Probabilidades sugeridas por algoritmo</span>
              <div>
                <article>
                  <small>Victoria local</small>
                  <strong>{trend.home}%</strong>
                </article>
                <article>
                  <small>Empate</small>
                  <strong>{trend.draw}%</strong>
                </article>
                <article>
                  <small>Victoria visitante</small>
                  <strong>{trend.away}%</strong>
                </article>
              </div>
            </section>

            <button className="button primary prediction-submit" type="submit">
              Guardar pronóstico
            </button>
            {message ? <p className="prediction-error">{message}</p> : null}
          </form>
        </div>
      ) : null}
    </article>
  );
}
