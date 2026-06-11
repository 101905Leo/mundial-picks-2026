"use client";

import { FormEvent, useEffect, useState } from "react";
import { RankingTable } from "@/components/ranking-table";
import type { League, RankingEntry } from "@/components/types";

type Props = {
  signedIn: boolean;
};

export function LeaguePanel({ signedIn }: Props) {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [message, setMessage] = useState("");

  async function loadLeagues() {
    if (!signedIn) return;
    const response = await fetch("/api/leagues");
    if (!response.ok) {
      setMessage("No se pudieron cargar tus ligas");
      return;
    }
    const data = await response.json();
    setLeagues(data.leagues);
    setSelectedLeague((current) => current ?? data.leagues[0] ?? null);
  }

  useEffect(() => {
    loadLeagues();
  }, [signedIn]);

  useEffect(() => {
    async function loadRanking() {
      if (!selectedLeague) {
        setRanking([]);
        return;
      }
      const response = await fetch(`/api/leagues/${selectedLeague.id}/ranking`);
      if (!response.ok) return;
      const data = await response.json();
      setRanking(data.ranking);
    }
    loadRanking();
  }, [selectedLeague]);

  async function createLeague(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/leagues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: String(formData.get("name")) }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo crear la liga");
      return;
    }

    setMessage(`Liga creada. Comparte el codigo ${data.league.inviteCode} para invitar usuarios.`);
    setLeagues((current) => [data.league, ...current.filter((league) => league.id !== data.league.id)]);
    setSelectedLeague(data.league);
    event.currentTarget.reset();
  }

  async function joinLeague(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/leagues/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: String(formData.get("inviteCode")) }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo entrar a la liga");
      return;
    }

    setMessage(`Entraste a la liga ${data.league.name}`);
    setLeagues((current) => [data.league, ...current.filter((league) => league.id !== data.league.id)]);
    setSelectedLeague(data.league);
    event.currentTarget.reset();
  }

  async function renameLeague(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLeague) return;

    setMessage("");
    const formData = new FormData(event.currentTarget);
    const response = await fetch(`/api/leagues/${selectedLeague.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: String(formData.get("name")) }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo cambiar el nombre");
      return;
    }

    setMessage("Nombre de liga actualizado");
    setSelectedLeague(data.league);
    await loadLeagues();
  }

  if (!signedIn) {
    return <div className="empty">Inicia sesion para crear ligas privadas o unirte con codigo.</div>;
  }

  return (
    <div className="grid">
      <div className="grid three-columns">
        <form className="panel form" onSubmit={createLeague}>
          <h3>Crear liga</h3>
          <div className="form-row">
            <label htmlFor="league-name">Nombre</label>
            <input id="league-name" name="name" minLength={3} placeholder="Ej: Familia Avella" required />
          </div>
          <button className="button primary" type="submit">
            Crear
          </button>
        </form>
        <form className="panel form" onSubmit={joinLeague}>
          <h3>Unirse</h3>
          <div className="form-row">
            <label htmlFor="invite-code">Codigo</label>
            <input id="invite-code" name="inviteCode" maxLength={16} minLength={4} placeholder="ABC123" required />
          </div>
          <button className="button secondary" type="submit">
            Entrar
          </button>
        </form>
        <div className="panel">
          <h3>Tus ligas</h3>
          <div className="tabs">
            {leagues.map((league) => (
              <button
                className={`tab ${selectedLeague?.id === league.id ? "active" : ""}`}
                key={league.id}
                onClick={() => setSelectedLeague(league)}
              >
                {league.name}
              </button>
            ))}
          </div>
        </div>
      </div>
      {message ? <div className="notice">{message}</div> : null}
      {selectedLeague ? (
        <form className="panel inline-form" onSubmit={renameLeague}>
          <div className="form-row">
            <label htmlFor="rename-league">Cambiar nombre de liga</label>
            <input id="rename-league" name="name" defaultValue={selectedLeague.name} minLength={3} required />
          </div>
          <button className="button primary" type="submit">
            Guardar nombre
          </button>
        </form>
      ) : null}
      <section className="panel">
        <div className="section-title">
          <h2>{selectedLeague ? selectedLeague.name : "Ranking por liga"}</h2>
          {selectedLeague ? <span className="muted">Codigo: {selectedLeague.inviteCode}</span> : null}
        </div>
        <RankingTable ranking={ranking} />
      </section>
    </div>
  );
}
