"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { LivePanel } from "@/components/live-panel";
import { MatchCard } from "@/components/match-card";
import { RankingTable } from "@/components/ranking-table";
import { FormidableFacts } from "@/components/formidable-facts";
import { StatisticsPanel } from "@/components/statistics-panel";
import type { Competition, League, LeagueMember, Match, RankingEntry, User } from "@/components/types";

type Props = { user: User };
type RoomView = "picks" | "facts" | "ranking" | "statistics" | "live" | "participants";

type LeagueMessage = {
  id: string;
  body: string;
  audioData: string | null;
  audioMime: string | null;
  audioDuration: number | null;
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
  };
};

export function LeaguePanel({ user }: Props) {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [roomView, setRoomView] = useState<RoomView>("picks");
  const [matches, setMatches] = useState<Match[]>([]);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [chatMessages, setChatMessages] = useState<LeagueMessage[]>([]);
  const [predictions, setPredictions] = useState<RoomPrediction[]>([]);
  const [message, setMessage] = useState("");
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartedAtRef = useRef(0);
  const recordingTimerRef = useRef<number | null>(null);
  const isOwner = selectedLeague?.ownerId === user.id;
  const isRoomAdmin =
    user.role === "ADMIN" ||
    selectedLeague?.memberships?.some((membership) => membership.userId === user.id && membership.role === "ADMIN") === true;
  const canManageRoom = Boolean(isOwner || isRoomAdmin);

  async function loadLeagues() {
    const [roomsResponse, competitionsResponse] = await Promise.all([
      fetch("/api/leagues"),
      fetch("/api/competitions"),
    ]);
    const roomsData = await roomsResponse.json();

    if (!roomsResponse.ok) {
      setMessage(roomsData.error ?? "No se pudieron cargar tus salas");
      return;
    }

    setLeagues(roomsData.leagues ?? []);
    setSelectedLeague((current) => {
      if (!current) return roomsData.leagues?.[0] ?? null;
      return roomsData.leagues?.find((league: League) => league.id === current.id) ?? roomsData.leagues?.[0] ?? null;
    });

    if (competitionsResponse.ok) {
      const competitionsData = await competitionsResponse.json();
      setCompetitions(competitionsData.competitions ?? []);
    }
  }

  async function loadRoom() {
    if (!selectedLeague) return;

    const [rankingResponse, predictionsResponse, matchesResponse] = await Promise.all([
      fetch(`/api/leagues/${selectedLeague.id}/ranking`),
      fetch(`/api/leagues/${selectedLeague.id}/predictions`),
      fetch(`/api/leagues/${selectedLeague.id}/matches`),
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
    if (matchesResponse.ok) {
      const data = await matchesResponse.json();
      setMatches(data.matches ?? []);
    }
  }

  useEffect(() => {
    loadLeagues();
  }, []);

  useEffect(() => {
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
    const form = event.currentTarget;
    const formData = new FormData(form);
    const startsAt = String(formData.get("startsAt") ?? "");
    const homeTeam = String(formData.get("homeTeam") ?? "").trim();
    const awayTeam = String(formData.get("awayTeam") ?? "").trim();
    const firstMatch = startsAt && homeTeam && awayTeam
      ? { homeTeam, awayTeam, startsAt: new Date(startsAt).toISOString() }
      : undefined;
    const response = await fetch("/api/leagues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name")),
        competitionId: String(formData.get("competitionId")),
        maxParticipants: Number(formData.get("maxParticipants")),
        firstMatch,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo crear la sala");
      return;
    }

    setMessage("Sala creada. Abriendo Wompi para confirmar el cupo.");
    if (data.checkout?.checkoutUrl) {
      window.location.href = data.checkout.checkoutUrl;
      return;
    }

    await loadLeagues();
  }

  async function joinLeague(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    await loadLeagues();
    setSelectedLeague(data.league);
    setRoomView("picks");
    form.reset();
  }

  async function copyInvitation() {
    if (!selectedLeague) return;
    const invitation = `Únete a "${selectedLeague.name}" en Mundial Picks: https://www.mundialpicks.online. Código: ${selectedLeague.inviteCode}`;
    await navigator.clipboard.writeText(invitation);
    setMessage("Invitación copiada para compartir.");
  }

  async function payRoom() {
    if (!selectedLeague) return;
    setMessage("Abriendo Wompi...");
    const response = await fetch(`/api/leagues/${selectedLeague.id}/checkout`, { method: "POST" });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo abrir el pago de la sala");
      return;
    }

    window.location.href = data.checkout.checkoutUrl;
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
    await loadLeagues();
  }

  async function removeMember(member: LeagueMember) {
    if (!selectedLeague || !window.confirm(`¿Retirar a ${member.name} de esta sala?`)) return;
    const response = await fetch(`/api/leagues/${selectedLeague.id}/members/${member.id}`, { method: "DELETE" });
    const data = await response.json();
    setMessage(response.ok ? `${data.removed.name} fue retirado` : data.error ?? "No se pudo retirar");
    if (response.ok) await loadRoom();
  }

  async function postMessage(payload: { body?: string; audioData?: string; audioMime?: string; audioDuration?: number }) {
    if (!selectedLeague) return;
    const response = await fetch(`/api/leagues/${selectedLeague.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo enviar el mensaje");
      return;
    }
    setChatMessages((current) => [...current, data.message].slice(-100));
  }

  async function sendChatMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    await postMessage({ body: String(formData.get("message") ?? "") });
    form.reset();
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMessage("Este navegador no permite grabar notas de voz.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const duration = Math.max(1, Math.min(30, Math.round((Date.now() - recordingStartedAtRef.current) / 1000)));
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });

        if (blob.size > 360_000) {
          setMessage("La nota de voz es muy pesada. Graba una más corta.");
          return;
        }

        const audioData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        await postMessage({ audioData, audioMime: blob.type, audioDuration: duration });
      };

      recorder.start();
      setRecording(true);
      recordingTimerRef.current = window.setTimeout(() => stopRecording(), 30_000);
    } catch {
      setMessage("No se obtuvo permiso para usar el micrófono.");
    }
  }

  function stopRecording() {
    if (recordingTimerRef.current) window.clearTimeout(recordingTimerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
  }

  const liveMatches = matches.filter((match) => match.status === "LIVE");
  const totalPicks = members.reduce((sum, member) => sum + member.predictions, 0);
  const finishedMatches = matches.filter((match) => match.status === "FINISHED").length;
  const availableSpots = selectedLeague ? Math.max(0, selectedLeague.maxParticipants - members.length) : 0;
  const savedPicks = matches.flatMap((match) =>
    (match.predictions ?? []).map((prediction) => ({ match, prediction })),
  );

  return (
    <div className="grid">
      {!selectedLeague ? <section className="room-promo panel">
        <div>
          <span className="market-kicker">El centro de la competencia</span>
          <h2>Entra a una sala y juega todo desde allí</h2>
          <p>Cada sala reúne sus picks, ranking, estadísticas, partidos en vivo, chat y participantes.</p>
        </div>
        <a className="button primary" href="https://goallive.online" rel="noreferrer" target="_blank">Ver partidos</a>
      </section> : null}

      {!selectedLeague ? <div className="grid three-columns room-entry-grid">
        <form className="panel form room-create-form" onSubmit={createLeague}>
          <h3>Crear sala</h3>
          <div className="form-row">
            <label htmlFor="league-name">Nombre</label>
            <input id="league-name" name="name" minLength={3} placeholder="Nombre para tu grupo" required />
          </div>
          <div className="form-row">
            <label htmlFor="competitionId">Liga</label>
            <select id="competitionId" name="competitionId" required>
              <option value="">Selecciona una liga</option>
              {competitions.map((competition) => (
                <option key={competition.id} value={competition.id}>{competition.name} · {competition.season}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="maxParticipants">Cupo de participantes</label>
            <select id="maxParticipants" name="maxParticipants" defaultValue="20" required>
              <option value="20">20 participantes · $40.000 COP</option>
              <option value="50">50 participantes · $80.000 COP</option>
              <option value="100">100 participantes · $120.000 COP</option>
            </select>
            <small>El código se identificará como MP20, MP50 o MP100 y se bloqueará al completar el cupo.</small>
          </div>
          <details className="room-first-match">
            <summary>Crear primer partido (opcional)</summary>
            <div className="form-row"><label htmlFor="room-home">Local</label><input id="room-home" name="homeTeam" /></div>
            <div className="form-row"><label htmlFor="room-away">Visitante</label><input id="room-away" name="awayTeam" /></div>
            <div className="form-row"><label htmlFor="room-start">Inicio</label><input id="room-start" name="startsAt" type="datetime-local" /></div>
          </details>
          <button className="button primary" type="submit">Crear sala y pagar</button>
        </form>

        <form className="panel form" onSubmit={joinLeague}>
          <h3>Entrar a una sala</h3>
          <div className="form-row">
            <label htmlFor="invite-code">Código</label>
            <input id="invite-code" name="inviteCode" maxLength={16} minLength={4} placeholder="MP20ABCD" required />
          </div>
          <button className="button secondary" type="submit">Entrar</button>
        </form>

        <div className="panel">
          <h3>Tus salas</h3>
          <div className="tabs room-list">
            {leagues.map((league) => (
              <button
                className="tab"
                key={league.id}
                onClick={() => {
                  setSelectedLeague(league);
                  setRoomView("picks");
                }}
                type="button"
              >
                <strong>{league.name}</strong>
                <span>{league.competition?.name ?? "Competición"}</span>
              </button>
            ))}
            {!leagues.length ? <div className="empty">Crea una sala o entra con un código.</div> : null}
          </div>
        </div>
      </div> : null}

      {message ? <div className="notice">{message}</div> : null}

      {selectedLeague ? (
        <section className="league-room">
          <div className="panel league-room-hero">
            <div>
              <span className="market-kicker">{selectedLeague.competition?.name ?? "Sala privada"}</span>
              <h2>{selectedLeague.name}</h2>
              <p className="muted">
                {members.length}/{selectedLeague.maxParticipants} participantes · {availableSpots} cupos disponibles · {matches.length} partidos
              </p>
            </div>
            {canManageRoom ? (
              <div className="room-owner-actions">
                <span>Administras esta sala</span>
                <button className="button primary" onClick={copyInvitation} type="button">Copiar invitación</button>
                <button className="button secondary" onClick={() => setSelectedLeague(null)} type="button">Mis salas</button>
              </div>
            ) : (
              <div className="room-owner-actions">
                <button className="button secondary" onClick={() => setSelectedLeague(null)} type="button">Mis salas</button>
              </div>
            )}
          </div>

          {!selectedLeague.paidAt ? (
            <section className="panel room-payment-required">
              <div>
                <span className="market-kicker">Sala pendiente de activación</span>
                <h3>Confirma el plan de {selectedLeague.maxParticipants} participantes</h3>
                <p>El código de invitación se habilitará cuando Wompi apruebe el pago.</p>
              </div>
              {isOwner ? (
                <button className="button primary" onClick={payRoom} type="button">Pagar y activar sala</button>
              ) : null}
            </section>
          ) : (
          <>
          <nav className="admin-nav room-nav" aria-label="Secciones de la sala">
            {([
              ["picks", "Picks"],
              ["facts", "Datos"],
              ["ranking", "Ranking"],
              ["statistics", "Estadísticas"],
              ["live", "En vivo"],
              ["participants", "Participantes"],
            ] as Array<[RoomView, string]>).map(([view, label]) => (
              <button className={`tab ${roomView === view ? "active" : ""}`} key={view} onClick={() => setRoomView(view)} type="button">
                {label}
              </button>
            ))}
          </nav>

          <div className="room-main-layout">
            <div className="room-main-content">
          {roomView === "picks" ? (
            <div className="grid">
              <section className="panel market-board room-picks-board">
                <div className="section-title">
                  <div><span className="market-kicker">Tus pronósticos</span><h3>Partidos de la sala</h3></div>
                </div>
                <div className="market-list">
                  {matches.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      signedIn
                      canPredict
                      disabledMessage=""
                      onSaved={loadRoom}
                      roomId={selectedLeague.id}
                    />
                  ))}
                  {!matches.length ? <div className="empty">Esta liga todavía no tiene partidos publicados.</div> : null}
                </div>
              </section>
              <section className="panel room-predictions">
                <div className="section-title">
                  <div><span className="market-kicker">Tu historial</span><h3>Mis picks guardados</h3></div>
                </div>
                <div className="room-prediction-list">
                  {savedPicks.map(({ match, prediction }) => (
                    <article className="room-prediction" key={prediction.id}>
                      <div>
                        <strong>{match.homeTeam} vs {match.awayTeam}</strong>
                        <span>{new Date(match.startsAt).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}</span>
                      </div>
                      <strong>{prediction.homeScore} - {prediction.awayScore}</strong>
                      <span>{prediction.points} pts</span>
                    </article>
                  ))}
                  {!savedPicks.length ? <div className="empty">Todavía no has guardado picks en esta sala.</div> : null}
                </div>
              </section>
              <section className="panel room-predictions">
                <div className="section-title">
                  <div><span className="market-kicker">Transparencia en vivo</span><h3>Picks del partido que se está jugando</h3></div>
                </div>
                <div className="room-prediction-list">
                  {predictions.map((prediction) => (
                    <article className="room-prediction" key={prediction.id}>
                      <div><strong>{prediction.user.name}</strong><span>{prediction.match.homeTeam} vs {prediction.match.awayTeam}</span></div>
                      <strong>{prediction.homeScore} - {prediction.awayScore}</strong>
                      <span>{prediction.points} pts</span>
                    </article>
                  ))}
                  {!predictions.length ? <div className="empty">Solo aparecerán picks mientras haya un partido en juego.</div> : null}
                </div>
              </section>
            </div>
          ) : null}

          {roomView === "facts" ? <FormidableFacts /> : null}

          {roomView === "ranking" ? (
            <section className="panel room-ranking">
              <div className="section-title"><div><span className="market-kicker">Clasificación privada</span><h3>Ranking de la sala</h3></div></div>
              <RankingTable ranking={ranking} />
            </section>
          ) : null}

          {roomView === "statistics" ? (
            <div className="grid">
              <section className="room-stat-grid">
                <article className="panel"><span>Participantes</span><strong>{members.length}</strong></article>
                <article className="panel"><span>Picks guardados</span><strong>{totalPicks}</strong></article>
                <article className="panel"><span>Partidos finalizados</span><strong>{finishedMatches}</strong></article>
                <article className="panel"><span>Partidos en vivo</span><strong>{liveMatches.length}</strong></article>
              </section>
              <StatisticsPanel />
            </div>
          ) : null}

          {roomView === "live" ? <LivePanel matches={matches} /> : null}

          {roomView === "participants" ? (
            <div className="league-room-grid">
              <section className="panel">
                <div className="section-title"><div><span className="market-kicker">Integrantes</span><h3>{members.length} participantes</h3></div></div>
                <div className="league-member-list">
                  {members.map((member) => (
                    <article className="league-member" key={member.id}>
                      <div><strong>{member.name}</strong><span>{member.predictions} picks · {member.points} puntos</span></div>
                      {canManageRoom && member.id !== user.id ? (
                        <button className="button danger compact-button" onClick={() => removeMember(member)} type="button">Retirar</button>
                      ) : null}
                      {member.roomRole === "ADMIN" ? <span className="market-kicker">Admin sala</span> : null}
                    </article>
                  ))}
                </div>
              </section>
              {canManageRoom ? (
                <section className="panel room-management">
                  <form className="form" onSubmit={renameLeague}>
                    <h3>Administrar sala</h3>
                    <div className="form-row"><label htmlFor="rename-league">Nombre</label><input id="rename-league" name="name" defaultValue={selectedLeague.name} minLength={3} required /></div>
                    <button className="button secondary" type="submit">Guardar nombre</button>
                  </form>
                </section>
              ) : null}
            </div>
          ) : null}
            </div>

            <section className="panel league-chat room-main-chat">
              <div className="section-title"><div><span className="market-kicker">Chat público</span><h3>Conversación de la sala</h3></div></div>
              <div className="league-chat-messages" aria-live="polite">
                {chatMessages.map((chatMessage) => (
                  <article className="league-chat-message" key={chatMessage.id}>
                    <div>
                      <strong>{chatMessage.user.name}</strong>
                      <time>{new Date(chatMessage.createdAt).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}</time>
                    </div>
                    {chatMessage.body ? <p>{chatMessage.body}</p> : null}
                    {chatMessage.audioData ? (
                      <audio controls preload="none" src={chatMessage.audioData}>
                        Tu navegador no puede reproducir esta nota de voz.
                      </audio>
                    ) : null}
                  </article>
                ))}
                {!chatMessages.length ? <div className="empty">Todavía no hay mensajes.</div> : null}
              </div>
              <form className="league-chat-form" onSubmit={sendChatMessage}>
                <input maxLength={500} name="message" placeholder="Escribe un mensaje..." required />
                <button className="button primary" type="submit">Enviar</button>
              </form>
              <button className={`button ${recording ? "danger" : "secondary"} voice-button`} onClick={recording ? stopRecording : startRecording} type="button">
                {recording ? "Detener y enviar nota" : "Grabar nota de voz"}
              </button>
            </section>
          </div>
          </>
          )}
        </section>
      ) : null}
    </div>
  );
}
