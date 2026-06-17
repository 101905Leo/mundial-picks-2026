"use client";

import { FormEvent, useEffect, useState } from "react";
import { MatchCard } from "@/components/match-card";
import { RankingTable } from "@/components/ranking-table";
import { FormidableFacts } from "@/components/formidable-facts";
import { StatisticsPanel } from "@/components/statistics-panel";
import type { Competition, League, LeagueMember, Match, RankingEntry, User } from "@/components/types";
import { matchStatusLabel, roomStatusLabel } from "@/lib/status-labels";
import { flagForTeam } from "@/lib/team-flags";

type Props = {
  user: User;
  initialLeagueId?: string | null;
  embedded?: boolean;
};
type RoomView = "home" | "picks" | "matches" | "facts" | "ranking" | "statistics" | "participants" | "chat" | "more";

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

function isActiveLeague(league: League) {
  const expired = Boolean(league.expiresAt && new Date(league.expiresAt) <= new Date());
  return (league.status ?? "ACTIVE") === "ACTIVE" && !expired;
}

export function LeaguePanel({ user, initialLeagueId = null, embedded = false }: Props) {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [roomView, setRoomView] = useState<RoomView>("home");
  const [matches, setMatches] = useState<Match[]>([]);
  const [managedMatches, setManagedMatches] = useState<Match[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [chatMessages, setChatMessages] = useState<LeagueMessage[]>([]);
  const [predictions, setPredictions] = useState<RoomPrediction[]>([]);
  const [predictionMatches, setPredictionMatches] = useState<RoomPredictionMatch[]>([]);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [message, setMessage] = useState("");
  const [syncError, setSyncError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const isSuperAdmin = user.role === "ADMIN";
  const isOwner = selectedLeague?.ownerId === user.id;
  const roomMembership = selectedLeague?.memberships?.find((membership) => membership.userId === user.id);
  const isRoomAdmin = roomMembership?.role === "ADMIN";
  const canEditRoomInfo = Boolean(isSuperAdmin || isOwner || isRoomAdmin);
  const canModerateRoom = Boolean(isSuperAdmin || isOwner || isRoomAdmin);
  const canCloseRoom = Boolean(isSuperAdmin || isOwner);
  const canDeleteRoom = isSuperAdmin;

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

    const loadedLeagues = (roomsData.leagues ?? []) as League[];
    const loadedActiveLeagues = loadedLeagues.filter(isActiveLeague);
    setLeagues(loadedLeagues);
    setSelectedLeague((current) => {
      const requestedLeague = initialLeagueId ? loadedLeagues.find((league) => league.id === initialLeagueId) ?? null : null;
      if (requestedLeague) return requestedLeague;
      if (embedded) return null;
      if (!current) return isSuperAdmin ? null : loadedActiveLeagues[0] ?? loadedLeagues[0] ?? null;
      return loadedLeagues.find((league) => league.id === current.id) ?? (isSuperAdmin ? null : loadedActiveLeagues[0] ?? loadedLeagues[0] ?? null);
    });

    if (competitionsResponse.ok) {
      const competitionsData = await competitionsResponse.json();
      setCompetitions(competitionsData.competitions ?? []);
    }
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

      if (canEditRoomInfo) {
        const managedMatchesResponse = await fetch(`/api/leagues/${roomId}/matches?includeHidden=true`, { cache: "no-store" });
        const managedMatchesData = await readResponse(managedMatchesResponse, "No se pudo cargar el control de partidos.");
        setManagedMatches(managedMatchesData.matches ?? []);
      } else {
        setManagedMatches([]);
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
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!embedded) return;
    if (!initialLeagueId) {
      setSelectedLeague(null);
      return;
    }

    const nextLeague = leagues.find((league) => league.id === initialLeagueId) ?? null;
    setSelectedLeague((current) => (current?.id === nextLeague?.id ? current : nextLeague));
    setRoomView("home");
  }, [embedded, initialLeagueId, leagues]);

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
    setRoomView("home");
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

  async function importCompetitionMatches(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLeague) return;

    const formData = new FormData(event.currentTarget);
    const response = await fetch(`/api/leagues/${selectedLeague.id}/matches/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitionId: String(formData.get("competitionId")) }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data.error ?? "No se pudieron cargar los partidos en esta sala");
      return;
    }

    setMessage(data.message ?? "Partidos cargados en la sala");
    await loadLeagues();
    await loadRoom();
    setRoomView("matches");
  }

  async function createPrivateMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLeague) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const response = await fetch(`/api/leagues/${selectedLeague.id}/matches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        homeTeam: String(formData.get("homeTeam") ?? ""),
        awayTeam: String(formData.get("awayTeam") ?? ""),
        startsAt: String(formData.get("startsAt") ?? ""),
        group: String(formData.get("group") ?? ""),
        venue: String(formData.get("venue") ?? ""),
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo crear el partido privado");
      return;
    }

    form.reset();
    setMessage(data.message ?? "Partido privado creado en la sala");
    await loadRoom();
    setRoomView("matches");
  }

  async function publishRoomMatch(matchId: string, publish: boolean) {
    if (!selectedLeague) return;

    const response = await fetch(`/api/leagues/${selectedLeague.id}/matches/${matchId}/publish`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publish }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo cambiar la publicacion del partido");
      return;
    }

    setMessage(publish ? "Partido publicado en esta sala" : "Partido oculto en esta sala");
    await loadRoom();
  }

  async function closeMatchManually(event: FormEvent<HTMLFormElement>, match: Match) {
    event.preventDefault();
    if (!window.confirm("¿Seguro que deseas cerrar este partido? Esta acción actualizará puntos y ranking.")) return;

    const formData = new FormData(event.currentTarget);
    const homeScore = Number(formData.get("manualHomeScore"));
    const awayScore = Number(formData.get("manualAwayScore"));

    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) {
      setMessage("Ingresa un marcador final válido.");
      return;
    }

    const response = await fetch(`/api/admin/matches/${match.id}/result`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ homeScore, awayScore, isFinal: true }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo cerrar el partido.");
      return;
    }

    setMessage("Partido cerrado y puntos recalculados.");
    await loadRoom();
  }

  const sortedMatches = [...matches].sort((first, second) => new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime());
  const liveMatches = sortedMatches.filter((match) => match.status === "LIVE");
  const nextRoomMatch =
    liveMatches[0] ??
    sortedMatches.find((match) => match.status !== "FINISHED" && new Date(match.startsAt) >= now) ??
    null;
  const lastFinishedMatch = [...sortedMatches]
    .reverse()
    .find((match) => match.status === "FINISHED" && match.homeScore !== null && match.awayScore !== null);
  const nextStartsAt = nextRoomMatch ? new Date(nextRoomMatch.startsAt) : null;
  const nextDiff = nextStartsAt ? Math.max(0, nextStartsAt.getTime() - now.getTime()) : 0;
  const nextCountdown = {
    days: Math.floor(nextDiff / 86_400_000),
    hours: Math.floor((nextDiff % 86_400_000) / 3_600_000),
    minutes: Math.floor((nextDiff % 3_600_000) / 60_000),
    seconds: Math.floor((nextDiff % 60_000) / 1000),
  };
  const roomMatchesByDay = sortedMatches.reduce<Array<{ key: string; label: string; matches: Match[] }>>((days, match) => {
    const startsAt = new Date(match.startsAt);
    const key = startsAt.toISOString().slice(0, 10);
    const todayKey = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = tomorrow.toISOString().slice(0, 10);
    const label =
      key === todayKey
        ? "Hoy"
        : key === tomorrowKey
          ? "Mañana"
          : startsAt.toLocaleDateString("es", { weekday: "short", day: "2-digit", month: "short" });
    const existingDay = days.find((day) => day.key === key);

    if (existingDay) {
      existingDay.matches.push(match);
    } else {
      days.push({ key, label, matches: [match] });
    }

    return days;
  }, []);
  const totalPicks = members.reduce((sum, member) => sum + member.predictions, 0);
  const finishedMatches = matches.filter((match) => match.status === "FINISHED").length;
  const availableSpots = selectedLeague ? Math.max(0, selectedLeague.maxParticipants - members.length) : 0;
  const savedPicks = matches.flatMap((match) =>
    (match.predictions ?? []).map((prediction) => ({ match, prediction })),
  );
  const featuredPrediction = nextRoomMatch?.predictions?.[0] ?? null;
  const featuredActionLabel = nextRoomMatch
    ? nextRoomMatch.status === "LIVE"
      ? featuredPrediction
        ? "Ver partido"
        : "Ver en vivo"
      : featuredPrediction
        ? "Editar pronóstico"
        : "Hacer pronóstico"
    : "Ver calendario";
  const nextPendingPick = sortedMatches.find(
    (match) => match.status !== "FINISHED" && !(match.predictions ?? []).length,
  );
  const upcomingRoomMatches = sortedMatches
    .filter((match) => match.status !== "FINISHED")
    .slice(0, 3);
  const rankingPreview = ranking.slice(0, 5);
  const recentUserPicks = [...savedPicks]
    .sort((first, second) => new Date(second.match.startsAt).getTime() - new Date(first.match.startsAt).getTime())
    .slice(0, 3);
  const livePredictionMatchIds = new Set(liveMatches.map((match) => match.id));
  const liveRoomPredictions = predictions.filter((prediction) => livePredictionMatchIds.has(prediction.match.id));
  const previewPredictions = (liveRoomPredictions.length ? liveRoomPredictions : predictions).slice(0, 5);
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
  const userPickCount = userRanking?.predictions ?? savedPicks.length;
  const leader = ranking[0] ?? null;
  const pointsBehindLeader = userRanking && leader ? Math.max(0, leader.points - userRanking.points) : 0;
  const roomHasExpired = Boolean(selectedLeague?.expiresAt && new Date(selectedLeague.expiresAt) <= new Date());
  const activeLeagues = leagues.filter(isActiveLeague);
  const selectableLeagues = isSuperAdmin ? leagues : activeLeagues;
  const roomIsActivated = Boolean(
    selectedLeague?.paidAt ||
    ["APPROVED", "TRIAL", "MANUAL"].includes(selectedLeague?.paymentStatus ?? "") ||
    isSuperAdmin,
  );
  const roomCanPredict =
    !isSuperAdmin &&
    (selectedLeague?.status ?? "ACTIVE") === "ACTIVE" &&
    !roomHasExpired &&
    roomIsActivated;
  const roomDisabledMessage = isSuperAdmin
    ? "Modo espectador: administra la sala sin participar en la competencia."
    : roomHasExpired
      ? "Esta sala está vencida."
      : selectedLeague?.status === "SUSPENDED"
      ? "Esta sala está suspendida."
      : selectedLeague?.status === "CLOSED"
        ? "Esta sala está cerrada."
        : "La sala debe estar activa para guardar picks.";
  const roomFinishedMatches = matches.filter((match) => match.status === "FINISHED").length;
  const roomLiveMatches = matches.filter((match) => match.status === "LIVE").length;
  const intelligenceMatch = nextRoomMatch ?? lastFinishedMatch ?? sortedMatches[0] ?? null;
  const intelligenceHasEnoughInfo = Boolean(intelligenceMatch);
  const intelligenceScore =
    intelligenceMatch?.homeScore !== null && intelligenceMatch?.homeScore !== undefined &&
    intelligenceMatch?.awayScore !== null && intelligenceMatch?.awayScore !== undefined
      ? `${intelligenceMatch.homeScore}-${intelligenceMatch.awayScore}`
      : "Sin marcador";
  const intelligenceTrend = intelligenceMatch
    ? intelligenceMatch.homeScore !== null && intelligenceMatch.awayScore !== null
      ? intelligenceMatch.homeScore === intelligenceMatch.awayScore
        ? "Partido equilibrado por marcador actual."
        : `${intelligenceMatch.homeScore > intelligenceMatch.awayScore ? intelligenceMatch.homeTeam : intelligenceMatch.awayTeam} tiene ventaja en el marcador.`
      : intelligenceMatch.status === "SCHEDULED"
        ? "Partido pendiente. Revisa contexto, bajas y momento de cada equipo antes de pronosticar."
        : "Marcador en actualización. Espera datos completos para una lectura más confiable."
    : "";
  const roomTabs: Array<[RoomView, string]> = [
    ["home", "Inicio"],
    ["matches", "Calendario"],
    ["picks", "Picks"],
    ["ranking", "Ranking"],
    ["facts", "IA"],
    ["more", "Más"],
  ];
  const moreRoomViews: RoomView[] = ["participants", "chat", "more"];

  function shareRanking() {
    if (!selectedLeague || !userRanking) return;
    const text = `${user.name} está en la posición #${userRankingIndex + 1} de "${selectedLeague.name}" con ${userRanking.points} puntos en Mundial Picks. https://www.mundialpicks.online`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="grid">
      {!selectedLeague && !isSuperAdmin ? <section className="room-promo panel">
        <div>
            <span className="market-kicker">El centro de la competencia</span>
            <h2>Entra a una sala y juega todo desde allí</h2>
          <p>Cada sala reúne sus picks, ranking, estadísticas, chat y participantes.</p>
        </div>
        <a className="button primary" href="https://goallive.online" rel="noreferrer" target="_blank">Ver partidos</a>
      </section> : null}

      {!selectedLeague ? <div className={`grid ${isSuperAdmin ? "room-entry-grid" : "three-columns room-entry-grid"}`}>
        {isSuperAdmin ? (
          <section className="panel form room-command-center">
            <span className="market-kicker">Super usuario</span>
            <h3>Selecciona una sala</h3>
            <p className="muted">Los cambios se aplican solo a la sala que elijas. Cada sala conserva sus participantes, normas, ranking y chat propios.</p>
            <div className="form-row">
              <label htmlFor="room-selector">Sala</label>
              <select
                id="room-selector"
                onChange={(event) => {
                  const league = leagues.find((item) => item.id === event.target.value) ?? null;
                  setSelectedLeague(league);
                  setRoomView("home");
                }}
                value=""
              >
                <option value="">Selecciona sala</option>
                {selectableLeagues.map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.name} · {league.inviteCode} · {roomStatusLabel(league.status)}
                  </option>
                ))}
              </select>
            </div>
            {!selectableLeagues.length ? <div className="empty">Todavía no hay salas creadas.</div> : null}
          </section>
        ) : (
          <form className="panel form" onSubmit={joinLeague}>
            <h3>Entrar a una sala</h3>
            <div className="form-row">
              <label htmlFor="invite-code">Código</label>
              <input id="invite-code" name="inviteCode" maxLength={16} minLength={4} placeholder="MP20ABCD" required />
            </div>
            <button className="button secondary" type="submit">Entrar</button>
          </form>
        )}

        {!isSuperAdmin ? <div className="panel">
          <h3>Salas activas</h3>
          <div className="tabs room-list">
            {activeLeagues.map((league) => (
              <button
                className="tab"
                key={league.id}
                onClick={() => {
                  setSelectedLeague(league);
                  setRoomView("home");
                }}
                type="button"
              >
                <strong>{league.name}</strong>
                <span>{league.competition?.name ?? "Competición"}</span>
              </button>
            ))}
            {!activeLeagues.length ? (
              <div className="empty">Entra con un código para activar una sala aquí.</div>
            ) : null}
          </div>
        </div> : null}

        {!isSuperAdmin ? <div className="panel room-promo">
          <span className="market-kicker">Crear nueva sala</span>
          <h3>Las salas se crean desde planes o desde el super admin</h3>
          <p>Si quieres una sala para amigos, familia o empresa, elige un plan y la activamos con su código.</p>
          <a className="button primary" href="/planes">Ver planes de salas</a>
        </div> : null}
      </div> : null}

      {message ? <div className="notice">{message}</div> : null}
      {syncError ? <div className="notice error">{syncError}</div> : null}

      {selectedLeague ? (
        <section className={`league-room ${embedded ? "embedded-room-view" : ""}`}>
          {isSuperAdmin && !embedded ? (
            <div className="panel super-room-selector-bar">
              <div>
                <span className="market-kicker">Super usuario</span>
                <strong>Administrando una sala específica</strong>
                <p className="muted">Selecciona una sala aquí antes de cambiar participantes, ranking, reglas o chat.</p>
              </div>
              <div className="form-row">
                <label htmlFor="super-active-room-selector">Sala seleccionada</label>
                <select
                  id="super-active-room-selector"
                  onChange={(event) => {
                    const league = leagues.find((item) => item.id === event.target.value) ?? selectedLeague;
                    setSelectedLeague(league);
                    setRoomView("home");
                  }}
                  value={selectedLeague.id}
                >
                  {selectableLeagues.map((league) => (
                    <option key={league.id} value={league.id}>
                      {league.name} · {league.inviteCode} · {roomStatusLabel(league.status)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
          <div className="panel league-room-hero room-player-header">
            <div className="room-player-title">
              <span className="market-kicker">{selectedLeague.competition?.name ?? "Sala privada"}</span>
              <h2>{selectedLeague.name}</h2>
              <p className="muted">Código {selectedLeague.inviteCode} · {roomStatusLabel(selectedLeague.status)}</p>
            </div>
            <div className="room-player-metrics" aria-label="Resumen de la sala">
              <article><span>Participantes</span><strong>{members.length}/{selectedLeague.maxParticipants}</strong></article>
              <article><span>Cupos</span><strong>{availableSpots}</strong></article>
              <article><span>Partidos</span><strong>{matches.length}</strong></article>
            </div>
            <div className="room-owner-actions room-header-actions">
              <button className="button secondary compact-button" onClick={copyInvitation} type="button">Copiar invitación</button>
              {!embedded ? <button className="button secondary compact-button" onClick={() => setSelectedLeague(null)} type="button">Cambiar sala</button> : null}
            </div>
          </div>

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
          <div className="room-mobile-drawer">
            <span>{selectedLeague.name}</span>
            <div className="room-mobile-cajons">
              {roomTabs.map(([view, label]) => (
                <button
                  className={`room-mobile-cajon ${roomView === view || (view === "more" && moreRoomViews.includes(roomView)) ? "active" : ""}`}
                  key={view}
                  onClick={() => setRoomView(view)}
                  type="button"
                >
                  <strong>{label}</strong>
                  <small>{roomView === view || (view === "more" && moreRoomViews.includes(roomView)) ? "Abierto" : "Tocar para abrir"}</small>
                </button>
              ))}
            </div>
          </div>

          <nav className="admin-nav room-nav" aria-label="Secciones de la sala">
            {roomTabs.map(([view, label]) => (
              <button
                className={`tab ${roomView === view || (view === "more" && moreRoomViews.includes(roomView)) ? "active" : ""}`}
                key={view}
                onClick={() => setRoomView(view)}
                type="button"
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="room-main-layout">
            <div className="room-main-content">
          {roomView === "home" ? (
            <div className="room-home-screen">
              <div className="room-home-grid">
                <div className="room-home-primary">
                  <section className="room-next-card room-featured-match">
                    <div className="room-next-card-header">
                      <span>{nextRoomMatch ? (nextRoomMatch.status === "LIVE" ? "En vivo" : "Próximo partido") : "Sin partido abierto"}</span>
                      <strong>{selectedLeague.name}</strong>
                    </div>
                    {nextRoomMatch ? (
                      <>
                        <div className="room-next-teams">
                          <div>
                            <span>{flagForTeam(nextRoomMatch.homeTeam)}</span>
                            <strong>{nextRoomMatch.homeTeam}</strong>
                          </div>
                          <em>{nextRoomMatch.status === "LIVE" && nextRoomMatch.homeScore !== null && nextRoomMatch.awayScore !== null ? `${nextRoomMatch.homeScore} - ${nextRoomMatch.awayScore}` : "vs"}</em>
                          <div>
                            <span>{flagForTeam(nextRoomMatch.awayTeam)}</span>
                            <strong>{nextRoomMatch.awayTeam}</strong>
                          </div>
                        </div>
                        <p>
                          {nextRoomMatch.group ? `${nextRoomMatch.group} · ` : ""}
                          {new Date(nextRoomMatch.startsAt).toLocaleDateString("es", { weekday: "short", day: "2-digit", month: "short" })}
                          {" · "}
                          <strong>{new Date(nextRoomMatch.startsAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}</strong>
                          {nextRoomMatch.venue ? ` · ${nextRoomMatch.venue}` : ""}
                        </p>
                        {featuredPrediction ? (
                          <div className="room-my-pick-pill">
                            <span>Mi pronóstico</span>
                            <strong>{featuredPrediction.homeScore} - {featuredPrediction.awayScore}</strong>
                          </div>
                        ) : nextRoomMatch.status === "LIVE" ? (
                          <div className="room-my-pick-pill">
                            <span>Marcador actual</span>
                            <strong>{nextRoomMatch.homeScore ?? 0} - {nextRoomMatch.awayScore ?? 0}</strong>
                          </div>
                        ) : (
                          <div className="room-countdown-grid" aria-label="Cuenta regresiva">
                            <article><strong>{String(nextCountdown.days).padStart(2, "0")}</strong><span>Días</span></article>
                            <article><strong>{String(nextCountdown.hours).padStart(2, "0")}</strong><span>Hrs</span></article>
                            <article><strong>{String(nextCountdown.minutes).padStart(2, "0")}</strong><span>Min</span></article>
                            <article><strong>{String(nextCountdown.seconds).padStart(2, "0")}</strong><span>Seg</span></article>
                          </div>
                        )}
                        <div className="room-home-actions single-action">
                          <button className="button primary" onClick={() => setRoomView("picks")} type="button">
                            {isSuperAdmin ? "Ver picks" : featuredActionLabel}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="room-activity-empty">
                          <strong>{members.length}</strong>
                          <span>participantes</span>
                          <strong>{totalPicks}</strong>
                          <span>picks guardados</span>
                        </div>
                        <div className="room-home-actions single-action">
                          <button className="button primary" onClick={() => setRoomView("matches")} type="button">Ver calendario</button>
                        </div>
                      </>
                    )}
                  </section>

                  <section className="panel room-home-summary compact-home-summary">
                    {isSuperAdmin ? (
                      <>
                        <article><span>Participantes</span><strong>{members.length}</strong></article>
                        <article><span>Picks sala</span><strong>{totalPicks}</strong></article>
                        <article><span>En vivo</span><strong>{roomLiveMatches}</strong></article>
                        <article><span>Finalizados</span><strong>{roomFinishedMatches}</strong></article>
                      </>
                    ) : (
                      <>
                        <article><span>Mi posición</span><strong>{userRanking ? `#${userRankingIndex + 1}` : "-"}</strong></article>
                        <article><span>Mis puntos</span><strong>{userRanking?.points ?? 0}</strong></article>
                        <article><span>Picks realizados</span><strong>{userPickCount}</strong></article>
                        <article><span>Próximo pick</span><strong>{nextPendingPick ? `${flagForTeam(nextPendingPick.homeTeam)} ${flagForTeam(nextPendingPick.awayTeam)}` : "-"}</strong></article>
                      </>
                    )}
                  </section>

                  <section className="panel room-home-games compact-room-games">
                    <div className="section-title">
                      <div>
                        <span className="market-kicker">Calendario</span>
                        <h3>Próximos 3 partidos</h3>
                      </div>
                      <button className="button secondary compact-button" onClick={() => setRoomView("matches")} type="button">Ver calendario</button>
                    </div>
                    <div className="room-home-day-list">
                      {upcomingRoomMatches.map((match) => (
                        <article className="room-home-match" key={match.id}>
                          <div>
                            <span>{flagForTeam(match.homeTeam)}</span>
                            <strong>{match.homeTeam}</strong>
                          </div>
                          <div>
                            <span>{flagForTeam(match.awayTeam)}</span>
                            <strong>{match.awayTeam}</strong>
                          </div>
                          <small>{match.status === "LIVE" ? "En vivo" : new Date(match.startsAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}</small>
                        </article>
                      ))}
                      {!upcomingRoomMatches.length ? <div className="empty">No hay partidos pendientes publicados.</div> : null}
                    </div>
                  </section>
                </div>

                <aside className="room-home-sidebar">
                  <section className="panel room-ranking-preview">
                    <div className="section-title">
                      <div>
                        <span className="market-kicker">Ranking</span>
                        <h3>Top de la sala</h3>
                      </div>
                      <button className="button secondary compact-button" onClick={() => setRoomView("ranking")} type="button">Ver completo</button>
                    </div>
                    <div className="room-ranking-card-list">
                      {rankingPreview.map((entry, index) => (
                        <article className={entry.id === user.id ? "current-user" : ""} key={entry.id}>
                          <span>#{index + 1}</span>
                          <strong>{entry.name}</strong>
                          <em>{entry.points} pts</em>
                        </article>
                      ))}
                      {!rankingPreview.length ? <div className="empty">El ranking aparecerá cuando haya participantes.</div> : null}
                    </div>
                  </section>

                  <section className="panel room-recent-picks">
                    <div className="section-title">
                      <div>
                        <span className="market-kicker">{liveRoomPredictions.length ? "Picks en vivo" : "Actividad"}</span>
                        <h3>{liveRoomPredictions.length ? "Partido en juego" : "Picks recientes"}</h3>
                      </div>
                      <button className="button secondary compact-button" onClick={() => setRoomView("picks")} type="button">Ver picks</button>
                    </div>
                    <div className="room-prediction-list compact-prediction-list">
                      {previewPredictions.map((prediction) => (
                        <article className="room-prediction" key={prediction.id}>
                          <div><strong>{prediction.user.name}</strong><span>{prediction.match.homeTeam} vs {prediction.match.awayTeam}</span></div>
                          <strong>{prediction.homeScore} - {prediction.awayScore}</strong>
                          <span>{prediction.points} pts</span>
                        </article>
                      ))}
                      {!previewPredictions.length ? <div className="empty">Todavía no hay picks para mostrar.</div> : null}
                    </div>
                  </section>

                  <section className="panel room-recent-picks">
                    <div className="section-title">
                      <div>
                        <span className="market-kicker">Mi historial</span>
                        <h3>Últimos picks</h3>
                      </div>
                      <button className="button secondary compact-button" onClick={() => setRoomView("picks")} type="button">Ver todos</button>
                    </div>
                    <div className="room-prediction-list compact-prediction-list">
                      {recentUserPicks.map(({ match, prediction }) => (
                        <article className="room-prediction" key={prediction.id}>
                          <div><strong>{match.homeTeam} vs {match.awayTeam}</strong><span>{matchStatusLabel(match.status)}</span></div>
                          <strong>{prediction.homeScore} - {prediction.awayScore}</strong>
                          <span>{prediction.points} pts</span>
                        </article>
                      ))}
                      {!recentUserPicks.length ? <div className="empty">Tus picks guardados aparecerán aquí.</div> : null}
                    </div>
                  </section>
                </aside>
              </div>
            </div>
          ) : null}

          {roomView === "picks" ? (
            <div className="grid">
              <section className="panel room-live-inline">
                <div className="section-title">
                  <div>
                    <span className="market-kicker">Picks en vivo</span>
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
                        : "Cuando haya un partido publicado en vivo, sus picks aparecerán aquí sin abrir otra pestaña."}
                    </div>
                  ) : null}
                </div>
              </section>
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
                  {!matches.length ? <div className="empty">Esta sala todavía no tiene partidos publicados.</div> : null}
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
            </div>
          ) : null}

          {roomView === "matches" ? (
            <div className="grid">
              {canEditRoomInfo ? <section className="panel room-match-admin">
                <div className="section-title">
                  <div>
                    <span className="market-kicker">Configuración de sala</span>
                    <h3>Calendario y partidos</h3>
                  </div>
                </div>
                <details className="room-config-drawer" open>
                  <summary>Usar calendario existente</summary>
                  <form className="room-match-loader" onSubmit={importCompetitionMatches}>
                    <div className="form-row">
                      <label htmlFor="roomCompetitionId">Calendario base disponible</label>
                      <select id="roomCompetitionId" name="competitionId" defaultValue={selectedLeague.competitionId ?? competitions[0]?.id ?? ""} required>
                        <option value="">Selecciona calendario base</option>
                        {competitions.map((competition) => (
                          <option key={competition.id} value={competition.id}>
                            {competition.name} · {competition.season}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button className="button primary" type="submit">Cargar partidos en esta sala</button>
                  </form>
                </details>
                <details className="room-config-drawer">
                  <summary>Crear liga privada</summary>
                  <form className="room-private-match-form" onSubmit={createPrivateMatch}>
                    <div className="inline-form">
                      <div className="form-row">
                        <label htmlFor="privateHomeTeam">Equipo local</label>
                        <input id="privateHomeTeam" name="homeTeam" minLength={2} required />
                      </div>
                      <div className="form-row">
                        <label htmlFor="privateAwayTeam">Equipo visitante</label>
                        <input id="privateAwayTeam" name="awayTeam" minLength={2} required />
                      </div>
                    </div>
                    <div className="inline-form">
                      <div className="form-row">
                        <label htmlFor="privateStartsAt">Fecha y hora</label>
                        <input id="privateStartsAt" name="startsAt" type="datetime-local" required />
                      </div>
                      <div className="form-row">
                        <label htmlFor="privateGroup">Grupo o fase</label>
                        <input id="privateGroup" name="group" placeholder="Grupo A" />
                      </div>
                      <div className="form-row">
                        <label htmlFor="privateVenue">Lugar</label>
                        <input id="privateVenue" name="venue" placeholder="Cancha principal" />
                      </div>
                    </div>
                    <button className="button primary" type="submit">Crear partido privado</button>
                  </form>
                </details>
              </section> : null}

              <section className="panel room-match-admin-list">
                <div className="section-title">
                  <div>
                    <span className="market-kicker">{canEditRoomInfo ? "Publicación por sala" : "Calendario de la sala"}</span>
                    <h3>{canEditRoomInfo ? managedMatches.length : matches.length} partidos cargados</h3>
                  </div>
                </div>
                <div className="room-match-control-list">
                  {(canEditRoomInfo ? managedMatches : matches).map((match) => (
                    <article className={`room-match-control ${match.isPublished ? "published" : "hidden"}`} key={match.id}>
                      <div className="room-match-control-teams">
                        <strong>{match.homeTeam} vs {match.awayTeam}</strong>
                        <span>
                          {new Date(match.startsAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                          {match.venue ? ` · ${match.venue}` : ""}
                        </span>
                      </div>
                      <div className="room-match-control-score">
                        <strong>{match.homeScore !== null && match.awayScore !== null ? `${match.homeScore}-${match.awayScore}` : "--"}</strong>
                        <span>{matchStatusLabel(match.status)}</span>
                      </div>
                      <div className="room-match-control-actions">
                        <span>{match.isPublished ? "Publicado" : "Oculto"}</span>
                        {canEditRoomInfo ? (
                          <button
                            className={match.isPublished ? "button secondary" : "button primary"}
                            onClick={() => publishRoomMatch(match.id, !match.isPublished)}
                            type="button"
                          >
                            {match.isPublished ? "Ocultar" : "Publicar"}
                          </button>
                        ) : null}
                        {isSuperAdmin ? (
                          match.status === "FINISHED" ? (
                            <span>Partido cerrado</span>
                          ) : (
                            <form className="room-close-match-form" onSubmit={(event) => closeMatchManually(event, match)}>
                              <input
                                aria-label={`Goles de ${match.homeTeam}`}
                                defaultValue={match.homeScore ?? ""}
                                min={0}
                                name="manualHomeScore"
                                placeholder="L"
                                type="number"
                              />
                              <input
                                aria-label={`Goles de ${match.awayTeam}`}
                                defaultValue={match.awayScore ?? ""}
                                min={0}
                                name="manualAwayScore"
                                placeholder="V"
                                type="number"
                              />
                              <button className="button danger compact-button" type="submit">Cerrar partido</button>
                            </form>
                          )
                        ) : null}
                      </div>
                    </article>
                  ))}
                  {!(canEditRoomInfo ? managedMatches : matches).length ? (
                    <div className="empty">Carga una competición o crea partidos privados para armar el calendario de esta sala.</div>
                  ) : null}
                </div>
              </section>
            </div>
          ) : null}

          {roomView === "facts" ? (
            <section className="panel smart-preview-board">
              <div className="section-title">
                <div>
                  <span className="market-kicker">Previa inteligente</span>
                  <h3>Ayuda para pronosticar</h3>
                </div>
              </div>
              {intelligenceHasEnoughInfo && intelligenceMatch ? (
                <div className="smart-preview-layout">
                  <article className="smart-preview-match">
                    <span>{matchStatusLabel(intelligenceMatch.status)}</span>
                    <div className="room-next-teams compact">
                      <div><span>{flagForTeam(intelligenceMatch.homeTeam)}</span><strong>{intelligenceMatch.homeTeam}</strong></div>
                      <em>{intelligenceScore}</em>
                      <div><span>{flagForTeam(intelligenceMatch.awayTeam)}</span><strong>{intelligenceMatch.awayTeam}</strong></div>
                    </div>
                    <p>
                      {new Date(intelligenceMatch.startsAt).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}
                      {intelligenceMatch.group ? ` · ${intelligenceMatch.group}` : ""}
                      {intelligenceMatch.venue ? ` · ${intelligenceMatch.venue}` : ""}
                    </p>
                  </article>
                  <article className="smart-preview-card">
                    <h4>Resumen breve</h4>
                    <p>{intelligenceTrend}</p>
                  </article>
                  <article className="smart-preview-card">
                    <h4>Factores clave</h4>
                    <ul>
                      <li>Estado: {matchStatusLabel(intelligenceMatch.status)}.</li>
                      <li>{intelligenceMatch.group ? `Fase: ${intelligenceMatch.group}.` : "Fase no registrada."}</li>
                      <li>{intelligenceMatch.venue ? `Sede: ${intelligenceMatch.venue}.` : "Sede no registrada."}</li>
                    </ul>
                  </article>
                  <article className="smart-preview-card accent">
                    <h4>Recomendación orientativa</h4>
                    <p>
                      Usa esta previa como apoyo y compárala con tu intuición. Si faltan datos del partido, evita confiar en una sola señal.
                    </p>
                  </article>
                  <p className="smart-preview-note">La IA solo ofrece una orientación. El resultado real puede variar.</p>
                </div>
              ) : (
                <div className="empty">No hay suficiente información para generar una previa confiable.</div>
              )}
              <details className="room-config-drawer compact-facts-drawer">
                <summary>Ver datos curiosos de selecciones</summary>
                <FormidableFacts />
              </details>
            </section>
          ) : null}

          {roomView === "more" ? (
            <section className="panel room-more-panel">
              <div className="section-title">
                <div>
                  <span className="market-kicker">Más opciones</span>
                  <h3>Participantes, chat y reglas</h3>
                </div>
              </div>
              <div className="room-more-grid">
                <button className="button secondary" onClick={() => setRoomView("participants")} type="button">
                  Participantes
                </button>
                <button className="button secondary" onClick={() => setRoomView("chat")} type="button">
                  Chat de la sala
                </button>
                <button className="button secondary" onClick={shareInvitation} type="button">
                  Compartir invitación
                </button>
                {canEditRoomInfo ? (
                  <button className="button secondary" onClick={() => setRoomView("participants")} type="button">
                    Configuración
                  </button>
                ) : null}
              </div>
              <div className="room-more-info">
                <article>
                  <span className="market-kicker">Reglas</span>
                  <h4>{selectedLeague.description || "Sala privada de picks"}</h4>
                  <p>{selectedLeague.rules || "El administrador de la sala todavía no ha publicado reglas internas."}</p>
                </article>
                <p className="room-legal-notice">
                  Mundial Picks solo proporciona la plataforma tecnológica para crear y administrar salas privadas. Los premios,
                  pagos, acuerdos o beneficios ofrecidos dentro de cada sala son responsabilidad exclusiva del creador o
                  administrador de la sala.
                </p>
              </div>
            </section>
          ) : null}

          {roomView === "ranking" ? (
            <div className="grid">
              <section className="room-ranking-summary">
                {isSuperAdmin ? (
                  <>
                    <article className="panel"><span>Miembros</span><strong>{members.length}</strong></article>
                    <article className="panel"><span>Picks</span><strong>{totalPicks}</strong></article>
                    <article className="panel"><span>En vivo</span><strong>{roomLiveMatches}</strong></article>
                    <article className="panel"><span>Finalizados</span><strong>{roomFinishedMatches}</strong></article>
                  </>
                ) : (
                  <>
                    <article className="panel"><span>Tu lugar</span><strong>{userRanking ? `#${userRankingIndex + 1}` : "-"}</strong></article>
                    <article className="panel"><span>Diferencia con el líder</span><strong>{userRanking ? `${pointsBehindLeader} pts` : "-"}</strong></article>
                    <article className="panel"><span>Racha actual</span><strong>{userRanking?.currentStreak ?? 0}</strong></article>
                    <article className="panel"><span>Marcadores exactos</span><strong>{userRanking?.exactScores ?? 0}</strong></article>
                  </>
                )}
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
              <StatisticsPanel roomId={selectedLeague.id} />
            </div>
          ) : null}

          {roomView === "chat" ? (
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
          ) : null}

          {roomView === "participants" ? (
            <div className="league-room-grid">
              <section className="panel">
                <div className="section-title"><div><span className="market-kicker">Integrantes</span><h3>{members.length} participantes</h3></div></div>
                <div className="league-member-list">
                  {members.map((member) => (
                    <article className="league-member" key={member.id}>
                      <div><strong>{member.name}</strong><span>{member.predictions} picks · {member.points} puntos</span></div>
                      {canModerateRoom && member.id !== user.id ? (
                        <button className="button danger compact-button" onClick={() => removeMember(member)} type="button">Retirar</button>
                      ) : null}
                      {member.roomRole === "ADMIN" ? <span className="market-kicker">Admin sala</span> : null}
                    </article>
                  ))}
                </div>
              </section>
              {canEditRoomInfo ? (
                <section className="panel room-management">
                  <form className="form" onSubmit={updateLeague}>
                    <h3>{isSuperAdmin ? "Control de super usuario" : "Administrar sala"}</h3>
                    <div className="form-row"><label htmlFor="rename-league">Nombre</label><input id="rename-league" name="name" defaultValue={selectedLeague.name} minLength={3} required /></div>
                    <div className="form-row"><label htmlFor="room-description">Descripción</label><textarea id="room-description" name="description" defaultValue={selectedLeague.description ?? ""} maxLength={500} rows={3} /></div>
                    <div className="form-row"><label htmlFor="room-rules">Reglas internas</label><textarea id="room-rules" name="rules" defaultValue={selectedLeague.rules ?? ""} maxLength={3000} rows={7} /></div>
                    <button className="button primary" type="submit">Guardar cambios</button>
                    {canCloseRoom ? <button className="button secondary" onClick={closeRoom} type="button">Cerrar sala</button> : null}
                    {canDeleteRoom ? <button className="button danger" onClick={deleteRoom} type="button">Eliminar sala</button> : null}
                  </form>
                </section>
              ) : null}
            </div>
          ) : null}
            </div>
          </div>
          {roomView !== "chat" ? (
            <button className="room-chat-fab" onClick={() => setRoomView("chat")} type="button" aria-label="Abrir chat de sala">
              Chat
            </button>
          ) : null}
          </>
          )}
        </section>
      ) : null}
    </div>
  );
}
