"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Competition, User } from "@/components/types";

type CompetitionPanelProps = {
  description?: string;
  kicker?: string;
  onChanged?: () => Promise<void> | void;
  title?: string;
  user: User;
};

export function CompetitionPanel({
  description = "Crear una liga nueva no modifica las salas existentes; solo queda disponible para salas futuras.",
  kicker = "Competiciones",
  onChanged,
  title = "Ligas disponibles",
  user,
}: CompetitionPanelProps) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [message, setMessage] = useState("");

  async function loadCompetitions() {
    const response = await fetch("/api/competitions");
    const data = await response.json();
    if (response.ok) setCompetitions(data.competitions ?? []);
  }

  useEffect(() => {
    loadCompetitions();
  }, []);

  async function createCompetition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const response = await fetch("/api/competitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name")),
        country: String(formData.get("country") ?? ""),
        season: String(formData.get("season")),
      }),
    });
    const data = await response.json();
    setMessage(response.ok ? "Liga creada y disponible para nuevas salas." : data.error ?? "No se pudo crear la liga");
    if (response.ok) {
      form.reset();
      await loadCompetitions();
      await onChanged?.();
    }
  }

  return (
    <section className="competition-page">
      <div className="panel competition-header">
        <div>
          <span className="market-kicker">{kicker}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {message ? <div className="notice">{message}</div> : null}
      {user.role === "ADMIN" ? (
        <form className="panel form competition-create" onSubmit={createCompetition}>
          <h3>Agregar liga</h3>
          <div className="inline-form">
            <div className="form-row"><label htmlFor="competition-name">Nombre</label><input id="competition-name" name="name" placeholder="Premier League" required /></div>
            <div className="form-row"><label htmlFor="competition-country">País o región</label><input id="competition-country" name="country" placeholder="Inglaterra" /></div>
            <div className="form-row"><label htmlFor="competition-season">Temporada</label><input id="competition-season" name="season" placeholder="2026-2027" required /></div>
            <button className="button primary" type="submit">Crear liga</button>
          </div>
        </form>
      ) : null}
      <div className="competition-grid">
        {competitions.map((competition) => (
          <article className="panel competition-card" key={competition.id}>
            <span>{competition.country || "Internacional"}</span>
            <h3>{competition.name}</h3>
            <p>Temporada {competition.season}</p>
            <strong className="competition-active">Disponible para salas</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
