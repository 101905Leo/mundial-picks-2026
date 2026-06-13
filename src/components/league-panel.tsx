"use client";

import { FormEvent, useEffect, useState } from "react";
import { RankingTable } from "@/components/ranking-table";
import type { League, LeagueMember, RankingEntry, User } from "@/components/types";

type Props = {
  user: User;
};

type LeagueMessage = {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string; role: "USER" | "ADMIN" };
};

type RoomPrediction = {
  id: string;
  homeScore: number;
  awayScore: number;
  points: number;
  user: { id: string; name: string };
  match: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    startsAt: string;
    status: "SCHEDULED" | "LIVE" | "FINISHED";
    homeScore: number | null;
    awayScore: number | null;
  };
};

export function LeaguePanel({ user }: Props) {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [chatMessages, setChatMessages] = useState<LeagueMessage[]>([]);
  const [predictions, setPredictions] = useState<RoomPrediction[]>([]);
  const [message, setMessage] = useState("");
  const globalMembers = members.filter((member) => member.entryPaidAt).length;
  const roomOnlyMembers = members.length - globalMembers;
  const isOwner = selectedLeague?.ownerId === user.id;

  async function loadLeagues() {
    const response = await fetch("/api/leagues");
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudieron cargar tus salas");
      return;
    }

    setLeagues(data.leagues ?? []);
    setSelectedLeague((current) => {
      if (!current) return data.leagues?.[0] ?? null;
      return data.leagues?.find((league: League) => league.id === current.id) ?? data.leagues?.[0] ?? null;
    });
  }

  useEffect(() => {
    loadLeagues();
  }, []);

  useEffect(() => {
    async function loadRoom() {
      if (!selectedLeague) {
        setRanking([]);
        setMembers([]);
        setPredictions([]);
        return;
      }

      const [rankingResponse, predictionsResponse] = await Promise.all([
        fetch(`/api/leagues/${selectedLeague.id}/ranking`),
        fetch(`/api/leagues/${selectedLeague.id}/predictions`),
      ]);

      if (rankingResponse.ok) {
        const data = await rankingResponse.json();
        setRanking(data.ranking ?? []);
        setMembers(data.members ?? []);
        setSelectedLeague((current) => (current?.id === data.league.id ? { ...current, ...data.league } : current));
      }

      if (predictionsResponse.ok) {
        const data = await predictionsResponse.json();
        setPredictions(data.predictions ?? []);
      }
    }

    loadRoom();
  }, [selectedLeague?.id]);

  useEffect(() => {
    if (!selectedLeague) {
      setChatMessages([]);
      return;
    }

    let cancelled = false;
    async function loadMessages() {
      const response = await fetch(`/api/leagues/${selectedLeague!.id}/messages`);
      if (!response.ok || cancelled) return;
      const data = await response.json();
      if (!cancelled) setChatMessages(data.messages ?? []);
    }

    loadMessages();
    const interval = window.setInterval(loadMessages, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedLeague]);

  async function createLeague(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const response = await fetch("/api/leagues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: String(formData.get("name")) }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo crear la sala");
      return;
    }

    setMessage("Sala creada. Usa el botón Copiar invitación para compartirla.");
    setLeagues((current) => [data.league, ...current.filter((league) => league.id !== data.league.id)]);
    setSelectedLeague(data.league);
    form.reset();
  }

  async function copyInvitation() {
    if (!selectedLeague) return;

    const invitation = `Únete a mi sala "${selectedLeague.name}" en Mundial Picks: https://www.mundialpicks.online. Código de acceso: ${selectedLeague.inviteCode}`;
    await navigator.clipboard.writeText(invitation);
    setMessage("Invitación copiada. Ya puedes enviarla por WhatsApp.");
  }

  async function joinLeague(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const response = await fetch("/api/leagues/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: String(formData.get("inviteCode")) }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo entrar a la sala");
      return;
    }

    setMessage(`Entraste a la sala ${data.league.name}`);
    setLeagues((current) => [data.league, ...current.filter((league) => league.id !== data.league.id)]);
    setSelectedLeague(data.league);
    form.reset();
  }

  async function renameLeague(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLeague) return;

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

    setMessage("Nombre de la sala actualizado");
    setSelectedLeague(data.league);
    await loadLeagues();
  }

  async function removeMember(member: LeagueMember) {
    if (!selectedLeague || !window.confirm(`¿Retirar a ${member.name} de esta sala?`)) return;

    const response = await fetch(`/api/leagues/${selectedLeague.id}/members/${member.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo retirar al participante");
      return;
    }

    setMessage(`${data.removed.name} fue retirado de la sala`);
    setMembers((current) => current.filter((item) => item.id !== member.id));
    setRanking((current) => current.filter((item) => item.id !== member.id));
  }

  async function deleteRoom() {
    if (!selectedLeague || !window.confirm(`¿Eliminar definitivamente la sala "${selectedLeague.name}"?`)) return;

    const response = await fetch(`/api/leagues/${selectedLeague.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo eliminar la sala");
      return;
    }

    setMessage(`Sala eliminada: ${data.deleted.name}`);
    setSelectedLeague(null);
    await loadLeagues();
  }

  async function sendChatMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLeague) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const response = await fetch(`/api/leagues/${selectedLeague.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: String(formData.get("message") ?? "") }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo enviar el mensaje");
      return;
    }

    setChatMessages((current) => [...current, data.message].slice(-100));
    form.reset();
  }

  return (
    <div className="grid">
      <section className="room-promo panel">
        <div>
          <span className="market-kicker">Tu grupo, tus reglas, la misma emoción</span>
          <h2>Crea una sala con amigos o compañeros de trabajo</h2>
          <p>Compitan en un ranking privado, conversen y revisen los picks cerrados de todos con transparencia.</p>
        </div>
        <a className="button primary" href="https://goallive.online" rel="noreferrer" target="_blank">
          Ver partidos en GoalLive
        </a>
      </section>

      <div className="grid three-columns room-entry-grid">
        <form className="panel form" onSubmit={createLeague}>
          <h3>Crear sala</h3>
          <div className="form-row">
            <label htmlFor="league-name">Nombre de la sala</label>
            <input id="league-name" name="name" minLength={3} placeholder="Nombre para tu grupo" required />
          </div>
          <button className="button primary" type="submit">Crear sala</button>
        </form>
        <form className="panel form" onSubmit={joinLeague}>
          <h3>Entrar a una sala</h3>
          <div className="form-row">
            <label htmlFor="invite-code">Código de invitación</label>
            <input id="invite-code" name="inviteCode" maxLength={16} minLength={4} placeholder="ABC123" required />
          </div>
          <button className="button secondary" type="submit">Entrar</button>
        </form>
        <div className="panel">
          <h3>Tus salas</h3>
          <div className="tabs">
            {leagues.map((league) => (
              <button
                className={`tab ${selectedLeague?.id === league.id ? "active" : ""}`}
                key={league.id}
                onClick={() => setSelectedLeague(league)}
                type="button"
              >
                {league.name}
              </button>
            ))}
            {!leagues.length ? <div className="empty">Todavía no perteneces a una sala.</div> : null}
          </div>
        </div>
      </div>

      {message ? <div className="notice">{message}</div> : null}

      {selectedLeague ? (
        <section className="league-room">
          <div className="panel league-room-hero">
            <div>
              <span className="market-kicker">Sala privada</span>
              <h2>{selectedLeague.name}</h2>
              <p className="muted">Ranking, chat y pronósticos cerrados exclusivamente para sus integrantes.</p>
            </div>
            {isOwner ? (
              <div className="room-owner-actions">
                <span>Administras esta sala</span>
                <button className="button primary" onClick={copyInvitation} type="button">Copiar invitación</button>
              </div>
            ) : null}
          </div>

          {isOwner ? (
            <section className="panel room-management">
              <form className="inline-form" onSubmit={renameLeague}>
                <div className="form-row">
                  <label htmlFor="rename-league">Nombre de la sala</label>
                  <input id="rename-league" name="name" defaultValue={selectedLeague.name} minLength={3} required />
                </div>
                <button className="button secondary" type="submit">Guardar nombre</button>
                <button className="button danger" onClick={deleteRoom} type="button">Eliminar sala</button>
              </form>
            </section>
          ) : null}

          <div className="league-room-grid">
            <section className="panel">
              <div className="section-title">
                <div>
                  <span className="market-kicker">Participantes</span>
                  <h3>{members.length} usuarios</h3>
                </div>
              </div>
              <div className="league-room-stats">
                <span><strong>{members.length}</strong>En sala</span>
                <span><strong>{roomOnlyMembers}</strong>Solo sala</span>
              </div>
              <div className="league-member-list">
                {members.map((member) => (
                  <article className="league-member" key={member.id}>
                    <div>
                      <strong>{member.name}</strong>
                      <span>{member.predictions} picks guardados</span>
                    </div>
                    <div className="room-member-actions">
                      <span className={member.entryPaidAt ? "member-status active" : "member-status pending"}>
                        {member.entryPaidAt ? "Global" : "Solo sala"}
                      </span>
                      {isOwner && member.id !== user.id ? (
                        <button className="button danger compact-button" onClick={() => removeMember(member)} type="button">
                          Retirar
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel room-predictions">
              <div className="section-title">
                <div>
                  <span className="market-kicker">Transparencia</span>
                  <h3>Picks de los participantes</h3>
                </div>
              </div>
              <p className="muted">Los pronósticos aparecen aquí únicamente cuando el partido ya cerró.</p>
              <div className="room-prediction-list">
                {predictions.map((prediction) => (
                  <article className="room-prediction" key={prediction.id}>
                    <div>
                      <strong>{prediction.user.name}</strong>
                      <span>{prediction.match.homeTeam} vs {prediction.match.awayTeam}</span>
                    </div>
                    <strong>{prediction.homeScore} - {prediction.awayScore}</strong>
                    <span>{prediction.points} pts</span>
                  </article>
                ))}
                {!predictions.length ? <div className="empty">Los picks se mostrarán cuando cierre el primer partido.</div> : null}
              </div>
            </section>
          </div>

          <div className="league-play-grid">
            <section className="panel room-ranking">
              <div className="section-title">
                <div>
                  <span className="market-kicker">Ranking privado</span>
                  <h3>Clasificación de la sala</h3>
                </div>
              </div>
              <div className="room-ranking-scroll">
                <RankingTable ranking={ranking} />
              </div>
            </section>

            <section className="panel league-chat">
              <div className="section-title">
                <div>
                  <span className="market-kicker">Chat público</span>
                  <h3>Conversación de la sala</h3>
                </div>
                <span className="muted">{chatMessages.length} mensajes</span>
              </div>
              <div className="league-chat-messages" aria-live="polite">
                {chatMessages.map((chatMessage) => (
                  <article className="league-chat-message" key={chatMessage.id}>
                    <div>
                      <strong>{chatMessage.user.name}</strong>
                      {chatMessage.user.role === "ADMIN" ? <span>Admin</span> : null}
                      <time>{new Date(chatMessage.createdAt).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}</time>
                    </div>
                    <p>{chatMessage.body}</p>
                  </article>
                ))}
                {!chatMessages.length ? <div className="empty">Todavía no hay mensajes. Inicia la conversación.</div> : null}
              </div>
              <form className="league-chat-form" onSubmit={sendChatMessage}>
                <input maxLength={500} name="message" placeholder="Escribe un mensaje para la sala..." required />
                <button className="button primary" type="submit">Enviar</button>
              </form>
            </section>
          </div>
        </section>
      ) : null}
    </div>
  );
}
