"use client";

import { FormEvent, useEffect, useState } from "react";
import { LivePanel } from "@/components/live-panel";
import { MatchCard } from "@/components/match-card";
import { RankingTable } from "@/components/ranking-table";
import { FormidableFacts } from "@/components/formidable-facts";
import { StatisticsPanel } from "@/components/statistics-panel";
import type { League, LeagueMember, Match, RankingEntry, User } from "@/components/types";

type Props = { user: User };
type RoomView = "picks" | "facts" | "ranking" | "statistics" | "live" | "participants";

type LeagueMessage = {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string; role: "USER" | "ADMIN" };
};

type GroupInfo = {
  memberCount: number;
  predictionCount: number;
  weeklyLeader: RankingEntry | null;
  bestActiveStreak: RankingEntry | null;
  mostExact: RankingEntry | null;
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

type RoomPredictionMatch = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  startsAt: string;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
  homeScore: number | null;
  awayScore: number | null;
};

export function LeaguePanel({ user }: Props) {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [roomView, setRoomView] = useState<RoomView>("picks");
  const [matches, setMatches] = useState<Match[]>([]);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [chatMessages, setChatMessages] = useState<LeagueMessage[]>([]);
  const [predictions, setPredictions] = useState<RoomPrediction[]>([]);
  const [predictionMatches, setPredictionMatches] = useState<RoomPredictionMatch[]>([]);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [message, setMessage] = useState("");
  const [syncError, setSyncError] = useState("");
  const isOwner = selectedLeague?.ownerId === user.id;
  const isRoomAdmin =
    user.role === "ADMIN" ||
    selectedLeague?.memberships?.some((membership) => membership.userId === user.id && membership.role === "ADMIN") === true;
  const canManageRoom = Boolean(isOwner || isRoomAdmin);

  async function loadLeagues() {
    const roomsResponse = await fetch("/api/leagues");
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
  }

  async function loadRoom() {
    if (!selectedLeague) return;

    try {
      const roomId = selectedLeague.id;
      const readResponse = async (response: Response, fallbackMessage: string) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? fallbackMessage);
        return data;
      };
      const [rankingResult, predictionsResult, matchesResult] = await Promise.allSettled([
        fetch(`/api/leagues/${roomId}/ranking`, { cache: "no-store" }).then((response) =>
          readResponse(response, "No se pudo cargar el ranking de la sala."),
        ),
        fetch(`/api/leagues/${roomId}/predictions`, { cache: "no-store" }).then((response) =>
          readResponse(response, "No se pudieron cargar los picks en vivo."),
        ),
        fetch(`/api/leagues/${roomId}/matches`, { cache: "no-store" }).then((response) =>
          readResponse(response, "No se pudieron cargar los partidos de la sala."),
        ),
      ]);

      const syncErrors: string[] = [];
      if (rankingResult.status === "fulfilled") {
        const data = rankingResult.value;
        setRanking(data.ranking ?? []);
        setMembers(data.members ?? []);
        setGroupInfo(data.groupInfo ?? null);
        setSelectedLeague((current) => (current?.id === data.league.id ? { ...current, ...data.league } : current));
      } else {
        syncErrors.push(rankingResult.reason instanceof Error ? rankingResult.reason.message : "No se pudo cargar el ranking.");
        setRanking([]);
        setMembers([]);
        setGroupInfo(null);
      }

      if (predictionsResult.status === "fulfilled") {
        setPredictions(predictionsResult.value.predictions ?? []);
        setPredictionMatches(predictionsResult.value.matches ?? []);
      } else {
        syncErrors.push(predictionsResult.reason instanceof Error ? predictionsResult.reason.message : "No se pudieron cargar los picks en vivo.");
        setPredictions([]);
        setPredictionMatches([]);
      }

      if (matchesResult.status === "fulfilled") {
        setMatches(matchesResult.value.matches ?? []);
      } else {
        syncErrors.push(matchesResult.reason instanceof Error ? matchesResult.reason.message : "No se pudieron cargar los partidos.");
        setMatches([]);
      }

      setSyncError(syncErrors.join(" "));
    } catch {
      setSyncError("No hay conexión con la base de datos. Los picks y resultados no pueden sincronizarse.");
    }
  }

  useEffect(() => {
    loadLeagues();
  }, []);

  useEffect(() => {
    loadRoom();
  }, [selectedLeague?.id]);

  useEffect(() => {
    if (!selectedLeague) return;

    let refreshing = false;
    async function refreshRoom() {
      if (document.visibilityState !== "visible" || refreshing) return;
      refreshing = true;
      try {
        await loadRoom();
      } finally {
        refreshing = false;
      }
    }

    const interval = window.setInterval(refreshRoom, 10000);
    window.addEventListener("focus", refreshRoom);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshRoom);
    };
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
  }, [selectedLeague?.id]);

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

  function shareInvitation() {
    if (!selectedLeague) return;
    const invitation = `Únete a mi sala privada "${selectedLeague.name}" en Mundial Picks. Código: ${selectedLeague.inviteCode}. Entra en https://www.mundialpicks.online`;
    window.open(`https://wa.me/?text=${encodeURIComponent(invitation)}`, "_blank", "noopener,noreferrer");
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

  async function updateLeague(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLeague) return;
    const formData = new FormData(event.currentTarget);
    const response = await fetch(`/api/leagues/${selectedLeague.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name")),
        description: String(formData.get("description") ?? ""),
        rules: String(formData.get("rules") ?? ""),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo actualizar la sala");
      return;
    }
    setMessage("Información de la sala actualizada");
    await loadLeagues();
  }

  async function closeRoom() {
    if (!selectedLeague || !window.confirm("¿Cerrar esta sala? Los participantes ya no podrán guardar picks.")) return;
    const response = await fetch(`/api/leagues/${selectedLeague.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CLOSED" }),
    });
    const data = await response.json();
    setMessage(response.ok ? "Sala cerrada" : data.error ?? "No se pudo cerrar la sala");
    if (response.ok) await loadLeagues();
  }

  async function deleteRoom() {
    if (!selectedLeague || !window.confirm(`¿Eliminar definitivamente "${selectedLeague.name}"? Esta acción también elimina sus mensajes y membresías.`)) return;
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

  async function removeMember(member: LeagueMember) {
    if (!selectedLeague || !window.confirm(`¿Retirar a ${member.name} de esta sala?`)) return;
    const response = await fetch(`/api/leagues/${selectedLeague.id}/members/${member.id}`, { method: "DELETE" });
    const data = await response.json();
    setMessage(response.ok ? `${data.removed.name} fue retirado` : data.error ?? "No se pudo retirar");
    if (response.ok) await loadRoom();
  }

  async function postMessage(payload: { body: string }) {
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

  const liveMatches = matches.filter((match) => match.status === "LIVE");
  const totalPicks = members.reduce((sum, member) => sum + member.predictions, 0);
  const finishedMatches = matches.filter((match) => match.status === "FINISHED").length;
  const availableSpots = selectedLeague ? Math.max(0, selectedLeague.maxParticipants - members.length) : 0;
  const savedPicks = matches.flatMap((match) =>
    (match.predictions ?? []).map((prediction) => ({ match, prediction })),
  );
  const predictionMatchLabel = predictionMatches.length
    ? predictionMatches
        .map((match) => {
          const score =
            match.homeScore !== null && match.awayScore !== null
              ? ` ${match.homeScore}-${match.awayScore}`
              : "";
          return `${match.homeTeam}${score} ${match.awayTeam}`;
        })
        .join(" · ")
    : "";
  const userRankingIndex = ranking.findIndex((entry) => entry.id === user.id);
  const userRanking = userRankingIndex >= 0 ? ranking[userRankingIndex] : null;
  const leader = ranking[0] ?? null;
  const pointsBehindLeader = userRanking && leader ? Math.max(0, leader.points - userRanking.points) : 0;
  const roomHasExpired = Boolean(selectedLeague?.expiresAt && new Date(selectedLeague.expiresAt) <= new Date());
  const roomIsActivated = Boolean(
    selectedLeague?.paidAt ||
    ["APPROVED", "TRIAL", "MANUAL"].includes(selectedLeague?.paymentStatus ?? "") ||
    user.role === "ADMIN",
  );
  const roomCanPredict =
    (selectedLeague?.status ?? "ACTIVE") === "ACTIVE" &&
    !roomHasExpired &&
    roomIsActivated;
  const roomDisabledMessage = roomHasExpired
    ? "Esta sala está vencida."
    : selectedLeague?.status === "SUSPENDED"
      ? "Esta sala está suspendida."
      : selectedLeague?.status === "CLOSED"
        ? "Esta sala está cerrada."
        : "La sala debe estar activa para guardar picks.";

  function shareRanking() {
    if (!selectedLeague || !userRanking) return;
    const text = `${user.name} está en la posición #${userRankingIndex + 1} de "${selectedLeague.name}" con ${userRanking.points} puntos en Mundial Picks. https://www.mundialpicks.online`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

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

        <div className="panel room-promo">
          <span className="market-kicker">Crear nueva sala</span>
          <h3>Las salas se crean desde planes o desde el super admin</h3>
          <p>Si quieres una sala para amigos, familia o empresa, elige un plan y la activamos con su código.</p>
          <a className="button primary" href="/planes">Ver planes de salas</a>
        </div>
      </div> : null}

      {message ? <div className="notice">{message}</div> : null}
      {syncError ? <div className="notice error">{syncError}</div> : null}

      {selectedLeague ? (
        <section className="league-room">
          <div className="panel league-room-hero">
            <div>
              <span className="market-kicker">{selectedLeague.competition?.name ?? "Sala privada"}</span>
              <h2>{selectedLeague.name}</h2>
              <p className="muted">
                {members.length}/{selectedLeague.maxParticipants} participantes · {availableSpots} cupos disponibles · {matches.length} partidos
              </p>
              <div className="room-status-line">
                <span>{selectedLeague.plan?.name ?? "Sala privada"}</span>
                <span>Estado: {selectedLeague.status === "ACTIVE" ? "Activa" : selectedLeague.status === "CLOSED" ? "Cerrada" : selectedLeague.status ?? "Activa"}</span>
                {selectedLeague.expiresAt ? <span>Vence: {new Date(selectedLeague.expiresAt).toLocaleDateString("es")}</span> : null}
              </div>
            </div>
            {canManageRoom ? (
              <div className="room-owner-actions">
                <span>Administras esta sala</span>
                <button className="button secondary" onClick={() => setRoomView("participants")} type="button">Editar sala</button>
                <button className="button primary" onClick={copyInvitation} type="button">Copiar invitación</button>
                <button className="button secondary" onClick={shareInvitation} type="button">Compartir por WhatsApp</button>
                <button className="button secondary" onClick={() => setSelectedLeague(null)} type="button">Mis salas</button>
              </div>
            ) : (
              <div className="room-owner-actions">
                <button className="button secondary" onClick={() => setSelectedLeague(null)} type="button">Mis salas</button>
              </div>
            )}
          </div>

          <section className="panel room-information">
            <div>
              <span className="market-kicker">Información del grupo</span>
              <h3>{selectedLeague.description || "Sala privada de quiniela"}</h3>
              <p>{selectedLeague.rules || "El administrador de la sala todavía no ha publicado reglas internas."}</p>
            </div>
            <p className="room-legal-notice">
              Mundial Picks solo proporciona la plataforma tecnológica para crear y administrar salas privadas. Los premios,
              pagos, acuerdos o beneficios ofrecidos dentro de cada sala son responsabilidad exclusiva del creador o
              administrador de la sala.
            </p>
          </section>

          {!roomIsActivated ? (
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
                      canPredict={roomCanPredict}
                      disabledMessage={roomDisabledMessage}
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
                  <div>
                    <h3>Picks del partido que se está jugando</h3>
                    {predictionMatchLabel ? <span>{predictionMatchLabel}</span> : null}
                  </div>
                </div>
                <div className="room-prediction-list">
                  {predictions.map((prediction) => (
                    <article className="room-prediction" key={prediction.id}>
                      <div><strong>{prediction.user.name}</strong><span>{prediction.match.homeTeam} vs {prediction.match.awayTeam}</span></div>
                      <strong>{prediction.homeScore} - {prediction.awayScore}</strong>
                      <span>{prediction.points} pts</span>
                    </article>
                  ))}
                  {!predictions.length ? (
                    <div className="empty">
                      {predictionMatchLabel
                        ? "Este partido está publicado, pero todavía no hay picks guardados para mostrar."
                        : "Publica o abre un partido de esta sala para mostrar los picks en vivo."}
                    </div>
                  ) : null}
                </div>
              </section>
            </div>
          ) : null}

          {roomView === "facts" ? <FormidableFacts /> : null}

          {roomView === "ranking" ? (
            <div className="grid">
              <section className="room-ranking-summary">
                <article className="panel"><span>Tu lugar</span><strong>{userRanking ? `#${userRankingIndex + 1}` : "-"}</strong></article>
                <article className="panel"><span>Diferencia con el líder</span><strong>{userRanking ? `${pointsBehindLeader} pts` : "-"}</strong></article>
                <article className="panel"><span>Racha actual</span><strong>{userRanking?.currentStreak ?? 0}</strong></article>
                <article className="panel"><span>Marcadores exactos</span><strong>{userRanking?.exactScores ?? 0}</strong></article>
              </section>
              <section className="panel room-ranking">
                <div className="section-title">
                  <div><span className="market-kicker">Clasificación privada</span><h3>Ranking de la sala</h3></div>
                  {userRanking ? <button className="button secondary" onClick={shareRanking} type="button">Compartir mi ranking</button> : null}
                </div>
                <RankingTable ranking={ranking} />
              </section>
              <section className="panel">
                <div className="section-title"><div><span className="market-kicker">Actividad</span><h3>Información del grupo</h3></div></div>
                <div className="room-group-insights">
                  <article><span>Miembros</span><strong>{groupInfo?.memberCount ?? members.length}</strong></article>
                  <article><span>Predicciones</span><strong>{groupInfo?.predictionCount ?? totalPicks}</strong></article>
                  <article><span>Líder semanal</span><strong>{groupInfo?.weeklyLeader?.name ?? "Sin datos"}</strong><small>{groupInfo?.weeklyLeader?.weeklyPoints ?? 0} pts</small></article>
                  <article><span>Mejor racha activa</span><strong>{groupInfo?.bestActiveStreak?.name ?? "Sin datos"}</strong><small>{groupInfo?.bestActiveStreak?.currentStreak ?? 0} aciertos</small></article>
                  <article><span>Más exactos</span><strong>{groupInfo?.mostExact?.name ?? "Sin datos"}</strong><small>{groupInfo?.mostExact?.exactScores ?? 0} exactos</small></article>
                </div>
              </section>
            </div>
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
                  <form className="form" onSubmit={updateLeague}>
                    <h3>Administrar sala</h3>
                    <div className="form-row"><label htmlFor="rename-league">Nombre</label><input id="rename-league" name="name" defaultValue={selectedLeague.name} minLength={3} required /></div>
                    <div className="form-row"><label htmlFor="room-description">Descripción</label><textarea id="room-description" name="description" defaultValue={selectedLeague.description ?? ""} maxLength={500} rows={3} /></div>
                    <div className="form-row"><label htmlFor="room-rules">Reglas internas</label><textarea id="room-rules" name="rules" defaultValue={selectedLeague.rules ?? ""} maxLength={3000} rows={7} /></div>
                    <button className="button primary" type="submit">Guardar cambios</button>
                    <button className="button secondary" onClick={closeRoom} type="button">Cerrar sala</button>
                    {isOwner || user.role === "ADMIN" ? <button className="button danger" onClick={deleteRoom} type="button">Eliminar sala</button> : null}
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
                  </article>
                ))}
                {!chatMessages.length ? <div className="empty">Todavía no hay mensajes.</div> : null}
              </div>
              <form className="league-chat-form" onSubmit={sendChatMessage}>
                <input maxLength={500} name="message" placeholder="Escribe un mensaje..." required />
                <button className="button primary" type="submit">Enviar</button>
              </form>
            </section>
          </div>
          </>
          )}
        </section>
      ) : null}
    </div>
  );
}
