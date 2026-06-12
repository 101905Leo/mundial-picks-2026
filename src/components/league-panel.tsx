"use client";

import { FormEvent, useEffect, useState } from "react";
import { RankingTable } from "@/components/ranking-table";
import type { League, LeagueMember, RankingEntry } from "@/components/types";

type Props = {
  signedIn: boolean;
};

type LeagueMessage = {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string; role: "USER" | "ADMIN" };
};

export function LeaguePanel({ signedIn }: Props) {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [chatMessages, setChatMessages] = useState<LeagueMessage[]>([]);
  const [message, setMessage] = useState("");
  const globalMembers = members.filter((member) => member.entryPaidAt).length;
  const roomOnlyMembers = members.length - globalMembers;

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
        setMembers([]);
        return;
      }
      const response = await fetch(`/api/leagues/${selectedLeague.id}/ranking`);
      if (!response.ok) {
        setMessage("No se pudo cargar la sala de esta liga");
        return;
      }
      const data = await response.json();
      setRanking(data.ranking);
      setMembers(data.members ?? []);
    }
    loadRanking();
  }, [selectedLeague]);

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

  async function copyInviteCode() {
    if (!selectedLeague) return;

    await navigator.clipboard.writeText(selectedLeague.inviteCode);
    setMessage(`Codigo ${selectedLeague.inviteCode} copiado. Ya puedes compartirlo.`);
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
        <section className="league-room">
          <div className="panel league-room-hero">
            <div>
              <span className="market-kicker">Sala privada</span>
              <h2>{selectedLeague.name}</h2>
              <p className="muted">Solo los usuarios que entren con este codigo pertenecen a esta sala y compiten aqui.</p>
            </div>
            <div className="league-code-box">
              <span>Codigo de invitacion</span>
              <strong>{selectedLeague.inviteCode}</strong>
              <button className="button secondary" onClick={copyInviteCode} type="button">
                Copiar codigo
              </button>
            </div>
          </div>
          <div className="league-room-grid">
            <form className="panel form" onSubmit={renameLeague}>
              <h3>Administrar sala</h3>
              <div className="form-row">
                <label htmlFor="rename-league">Cambiar nombre de liga</label>
                <input id="rename-league" name="name" defaultValue={selectedLeague.name} minLength={3} required />
              </div>
              <button className="button primary" type="submit">
                Guardar nombre
              </button>
            </form>
            <section className="panel">
              <div className="section-title">
                <div>
                  <span className="market-kicker">Participantes</span>
                  <h3>{members.length} usuarios en la sala</h3>
                </div>
              </div>
              <div className="league-room-stats">
                <span>
                  <strong>{members.length}</strong>
                  En sala
                </span>
                <span>
                  <strong>{roomOnlyMembers}</strong>
                  Sin ranking global
                </span>
              </div>
              <div className="league-member-list">
                {members.map((member) => (
                  <article className="league-member" key={member.id}>
                    <div>
                      <strong>{member.name}</strong>
                      <span>{member.predictions} picks guardados</span>
                    </div>
                    <span className={member.entryPaidAt ? "member-status active" : "member-status pending"}>
                      {member.entryPaidAt ? "Ranking global" : "Solo sala"}
                    </span>
                  </article>
                ))}
                {!members.length ? <div className="empty">Aun no hay usuarios en esta sala.</div> : null}
              </div>
            </section>
          </div>
          <section className="panel league-chat">
            <div className="section-title">
              <div>
                <span className="market-kicker">Chat de la sala</span>
                <h3>Conversacion publica para integrantes</h3>
              </div>
              <span className="muted">{chatMessages.length} mensajes recientes</span>
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
              {!chatMessages.length ? <div className="empty">Todavia no hay mensajes. Inicia la conversacion.</div> : null}
            </div>
            <form className="league-chat-form" onSubmit={sendChatMessage}>
              <input maxLength={500} name="message" placeholder="Escribe un mensaje para la sala..." required />
              <button className="button primary" type="submit">Enviar</button>
            </form>
          </section>
        </section>
      ) : null}
      <section className="panel">
        <div className="section-title">
          <h2>{selectedLeague ? selectedLeague.name : "Ranking por liga"}</h2>
          {selectedLeague ? <span className="muted">Ranking privado de usuarios que entraron a esta sala.</span> : null}
        </div>
        <RankingTable ranking={ranking} />
      </section>
    </div>
  );
}
