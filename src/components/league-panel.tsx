"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { MatchCard } from "@/components/match-card";
import { FormidableFacts } from "@/components/formidable-facts";
import { StatisticsPanel } from "@/components/statistics-panel";
import type { Competition, League, LeagueMember, Match, RankingEntry, User } from "@/components/types";
import { isPickClosed } from "@/lib/pick-lock";
import { matchStatusLabel, roomStatusLabel } from "@/lib/status-labels";
import { flagForTeam } from "@/lib/team-flags";

type Props = {
  user: User;
  initialLeagueId?: string | null;
  embedded?: boolean;
  roomMenuRequest?: number;
  onLogout?: () => void;
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
  predictionId?: string | null;
  homeScore: number | null;
  awayScore: number | null;
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

function isActiveLeague(league: League) {
  const expired = Boolean(league.expiresAt && new Date(league.expiresAt) <= new Date());
  return (league.status ?? "ACTIVE") === "ACTIVE" && !expired;
}

function getVisualMatchStatus(match: Match, now: Date) {
  const status = String(match.status).trim().toUpperCase();
  const startsAt = new Date(match.startsAt);
  const liveWindowMs = 120 * 60 * 1000;
  const elapsedMs = now.getTime() - startsAt.getTime();
  const hasScore = match.homeScore !== null && match.awayScore !== null;

  if (status === "LIVE") return "LIVE";
  if (status === "FINISHED") return "FINISHED";

  if (status === "SCHEDULED" && elapsedMs >= 0 && elapsedMs <= liveWindowMs) {
    return "LIVE";
  }

  if (status === "SCHEDULED" && hasScore && elapsedMs > liveWindowMs) {
    return "FINISHED";
  }

  return status;
}

export function LeaguePanel({ user, initialLeagueId = null, embedded = false, roomMenuRequest = 0, onLogout }: Props) {
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
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [message, setMessage] = useState("");
  const [syncError, setSyncError] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isRoomMenuOpen, setIsRoomMenuOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(true);
  const [mobileNavTouchStart, setMobileNavTouchStart] = useState<number | null>(null);
  const [quickHomePick, setQuickHomePick] = useState(0);
  const [quickAwayPick, setQuickAwayPick] = useState(0);
  const [quickPickMessage, setQuickPickMessage] = useState("");
  const [quickPickSaving, setQuickPickSaving] = useState(false);
  const [lastSeenChatMessageId, setLastSeenChatMessageId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [calendarFilter, setCalendarFilter] = useState<"ALL" | "TODAY" | "PENDING" | "LIVE" | "FINISHED">("ALL");
  const [picksFilter, setPicksFilter] = useState<"PENDING" | "LIVE" | "FINISHED" | "ALL">("PENDING");
  const isSuperAdmin = user.role === "ADMIN";
  const isOwner = selectedLeague?.ownerId === user.id;
  const roomMembership = selectedLeague?.memberships?.find((membership) => membership.userId === user.id);
  const isRoomAdmin = roomMembership?.role === "ADMIN";
  const canEditRoomInfo = Boolean(isSuperAdmin || isOwner || isRoomAdmin);
  const canModerateRoom = Boolean(isSuperAdmin || isOwner || isRoomAdmin);
  const canManageInvitation = Boolean(isSuperAdmin || isOwner || isRoomAdmin);
  const canCloseRoom = Boolean(isSuperAdmin || isOwner);
  const canDeleteRoom = isSuperAdmin;
  const mobileNavTimerRef = useRef<number | null>(null);

  function clearMobileNavTimer() {
    if (!mobileNavTimerRef.current) return;
    window.clearTimeout(mobileNavTimerRef.current);
    mobileNavTimerRef.current = null;
  }

  function showMobileNav(autoHide = true) {
    clearMobileNavTimer();
    setIsMobileNavOpen(true);
    if (autoHide) {
      mobileNavTimerRef.current = window.setTimeout(() => setIsMobileNavOpen(false), 4200);
    }
  }

  function hideMobileNavSoon(delay = 450) {
    clearMobileNavTimer();
    mobileNavTimerRef.current = window.setTimeout(() => setIsMobileNavOpen(false), delay);
  }

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
      } else {
        syncErrors.push(predictionsResult.reason instanceof Error ? predictionsResult.reason.message : "No se pudieron cargar los picks en vivo.");
        setPredictions([]);
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
    if (!selectedLeague) return;
    showMobileNav();
    return clearMobileNavTimer;
  }, [selectedLeague?.id]);

  useEffect(() => {
    loadRoom();
  }, [selectedLeague?.id]);

  useEffect(() => {
    if (!roomMenuRequest || embedded) return;
    setIsRoomMenuOpen(true);
    hideMobileNavSoon();
  }, [roomMenuRequest, embedded]);

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
      setLastSeenChatMessageId(null);
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

  const latestChatMessage = chatMessages[chatMessages.length - 1] ?? null;

  useEffect(() => {
    if (isChatOpen && latestChatMessage) {
      setLastSeenChatMessageId(latestChatMessage.id);
    }
  }, [isChatOpen, latestChatMessage?.id]);

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
    setIsRoomMenuOpen(false);
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
  const visualMatchStatus = (match: Match) => getVisualMatchStatus(match, now);
  const liveMatches = sortedMatches.filter((match) => visualMatchStatus(match) === "LIVE");
  const scheduledMatches = sortedMatches.filter((match) => visualMatchStatus(match) === "SCHEDULED");
  const finishedMatchesWithScore = sortedMatches.filter(
    (match) => visualMatchStatus(match) === "FINISHED" && match.homeScore !== null && match.awayScore !== null,
  );
  const nextScheduledMatch = scheduledMatches.find((match) => new Date(match.startsAt) >= now) ?? scheduledMatches[0] ?? null;
  const lastFinishedMatch = finishedMatchesWithScore[finishedMatchesWithScore.length - 1] ?? null;
  // LIVE tiene prioridad para no cambiar la tarjeta mientras el partido está en curso.
  const featuredMatch =
    liveMatches[0] ??
    nextScheduledMatch ??
    lastFinishedMatch ??
    null;
  const featuredMatchStatus = featuredMatch ? visualMatchStatus(featuredMatch) : null;
  const featuredMatchHasScore = Boolean(featuredMatch && featuredMatch.homeScore !== null && featuredMatch.awayScore !== null);
  const nextStartsAt = featuredMatch ? new Date(featuredMatch.startsAt) : null;
  const nextDiff = nextStartsAt ? Math.max(0, nextStartsAt.getTime() - now.getTime()) : 0;
  const nextCountdown = {
    days: Math.floor(nextDiff / 86_400_000),
    hours: Math.floor((nextDiff % 86_400_000) / 3_600_000),
    minutes: Math.floor((nextDiff % 3_600_000) / 60_000),
    seconds: Math.floor((nextDiff % 60_000) / 1000),
  };
  const buildMatchDays = (items: Match[]) => items.reduce<Array<{ key: string; label: string; matches: Match[] }>>((days, match) => {
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
  const todayKey = now.toISOString().slice(0, 10);
  const calendarSourceMatches = canEditRoomInfo
    ? [...managedMatches].sort((first, second) => new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime())
    : sortedMatches;
  const filteredCalendarMatches = calendarSourceMatches.filter((match) => {
    const matchDayKey = new Date(match.startsAt).toISOString().slice(0, 10);
    if (calendarFilter === "TODAY") return matchDayKey === todayKey;
    if (calendarFilter === "PENDING") return match.status === "SCHEDULED";
    if (calendarFilter === "LIVE") return match.status === "LIVE";
    if (calendarFilter === "FINISHED") return match.status === "FINISHED";
    return true;
  });
  const calendarMatchesByDay = buildMatchDays(filteredCalendarMatches);
  const filteredPickMatches = sortedMatches.filter((match) => {
    const hasPrediction = Boolean(match.predictions?.length);
    if (picksFilter === "PENDING") return match.status !== "FINISHED" && !hasPrediction;
    if (picksFilter === "LIVE") return match.status === "LIVE";
    if (picksFilter === "FINISHED") return match.status === "FINISHED";
    return true;
  });
  const totalPicks = members.reduce((sum, member) => sum + member.predictions, 0);
  const finishedMatches = matches.filter((match) => match.status === "FINISHED").length;
  const availableSpots = selectedLeague ? Math.max(0, selectedLeague.maxParticipants - members.length) : 0;
  const savedPicks = matches.flatMap((match) =>
    (match.predictions ?? []).map((prediction) => ({ match, prediction })),
  );
  const featuredPrediction = featuredMatch?.predictions?.[0] ?? null;
  const featuredActionLabel = featuredMatch
    ? featuredMatchStatus === "LIVE"
      ? featuredPrediction
        ? "Ver partido"
        : "Ver en vivo"
      : featuredMatchStatus === "FINISHED"
        ? "Ver resultado"
        : featuredPrediction
        ? "Editar pronóstico"
        : "Hacer pronóstico"
    : "Ver calendario";
  const nextPendingPick = sortedMatches.find(
    (match) => match.status !== "FINISHED" && !(match.predictions ?? []).length,
  );
  const recentUserPicks = [...savedPicks]
    .sort((first, second) => new Date(second.match.startsAt).getTime() - new Date(first.match.startsAt).getTime())
    .slice(0, 3);
  const pendingPickCount = sortedMatches.filter((match) => match.status !== "FINISHED" && !(match.predictions ?? []).length).length;
  const rankingTopThree = ranking.slice(0, 3);
  const livePredictionMatchIds = new Set(liveMatches.map((match) => match.id));
  const liveRoomPredictions = predictions.filter((prediction) => livePredictionMatchIds.has(prediction.match.id));
  const visibleRoomPredictions = predictions.filter(
    (prediction) => prediction.match.status === "LIVE" || prediction.match.status === "FINISHED",
  );
  const roomHomePredictions = liveRoomPredictions.length ? liveRoomPredictions : visibleRoomPredictions;
  const userRankingIndex = ranking.findIndex((entry) => entry.id === user.id);
  const userRanking = userRankingIndex >= 0 ? ranking[userRankingIndex] : null;
  const userPickCount = userRanking?.predictions ?? savedPicks.length;
  const userExactScores = userRanking?.exactScores ?? 0;
  const leader = ranking[0] ?? null;
  const pointsBehindLeader = userRanking && leader ? Math.max(0, leader.points - userRanking.points) : 0;
  const userPointsFromPicks = userRanking?.points ?? savedPicks.reduce((sum, { match, prediction }) => {
    if (match.status === "SCHEDULED" || match.homeScore === null || match.awayScore === null) return sum;
    return sum + (prediction.points ?? 0);
  }, 0);
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
  const featuredPickClosed = featuredMatch ? isPickClosed(new Date(featuredMatch.startsAt)) || featuredMatchStatus === "LIVE" || featuredMatchStatus === "FINISHED" : true;
  const canEditFeaturedPick = Boolean(featuredMatch && selectedLeague && roomCanPredict && !featuredPickClosed);
  const roomDisabledMessage = isSuperAdmin
    ? "Modo espectador: administra la sala sin participar en la competencia."
    : roomHasExpired
      ? "Esta sala está vencida."
      : selectedLeague?.status === "SUSPENDED"
      ? "Esta sala está suspendida."
      : selectedLeague?.status === "CLOSED"
        ? "Esta sala está cerrada."
        : "La sala debe estar activa para guardar picks.";
  const lastSeenChatIndex = lastSeenChatMessageId
    ? chatMessages.findIndex((chatMessage) => chatMessage.id === lastSeenChatMessageId)
    : -1;
  const chatActivityCount = isChatOpen
    ? 0
    : lastSeenChatIndex >= 0
      ? Math.max(0, chatMessages.length - lastSeenChatIndex - 1)
      : chatMessages.length;
  const chatActivityLabel = chatActivityCount > 9 ? "9+" : String(chatActivityCount);
  const hasChatActivity = chatActivityCount > 0;
  const intelligenceMatch = featuredMatch ?? lastFinishedMatch ?? sortedMatches[0] ?? null;
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
  const intelligenceSuggestedTrend = intelligenceMatch
    ? intelligenceMatch.homeScore !== null && intelligenceMatch.awayScore !== null
      ? intelligenceMatch.homeScore === intelligenceMatch.awayScore
        ? "Partido parejo"
        : intelligenceMatch.homeScore > intelligenceMatch.awayScore
          ? "Local"
          : "Visitante"
      : "Partido parejo"
    : "Sin datos";
  const intelligenceSuggestedScore = intelligenceMatch
    ? intelligenceMatch.homeScore !== null && intelligenceMatch.awayScore !== null
      ? `${intelligenceMatch.homeScore} - ${intelligenceMatch.awayScore}`
      : "1 - 1"
    : "-";
  const intelligenceConfidence = intelligenceMatch
    ? intelligenceMatch.status === "LIVE"
      ? "Media"
      : intelligenceMatch.status === "FINISHED"
        ? "Alta"
        : "Baja"
    : "Baja";

  useEffect(() => {
    setQuickHomePick(featuredPrediction?.homeScore ?? 0);
    setQuickAwayPick(featuredPrediction?.awayScore ?? 0);
    setQuickPickMessage("");
  }, [featuredMatch?.id, featuredPrediction?.homeScore, featuredPrediction?.awayScore]);

  async function saveFeaturedPick() {
    if (!featuredMatch || !selectedLeague) return;

    if (!canEditFeaturedPick) {
      setQuickPickMessage(roomDisabledMessage);
      return;
    }

    setQuickPickMessage("");
    setQuickPickSaving(true);

    try {
      const response = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: featuredMatch.id,
          roomId: selectedLeague.id,
          leagueId: selectedLeague.id,
          roomKey: selectedLeague.id,
          homeScore: quickHomePick,
          awayScore: quickAwayPick,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setQuickPickMessage(data.error ?? "No se pudo guardar el pick");
        return;
      }

      setQuickPickMessage("Pick guardado");
      await loadRoom();
    } catch {
      setQuickPickMessage("No hay conexión con el servidor. Intenta nuevamente.");
    } finally {
      setQuickPickSaving(false);
    }
  }

  useEffect(() => {
    if (!selectedLeague || !featuredMatch) return;

    let cancelled = false;

    fetch(`/api/leagues/${selectedLeague.id}/predictions?matchId=${featuredMatch.id}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? "No se pudieron cargar los picks del partido.");
        if (!cancelled) setPredictions(data.predictions ?? []);
      })
      .catch(() => {
        if (!cancelled) setPredictions([]);
      });

    return () => {
      cancelled = true;
    };
  }, [
    selectedLeague?.id,
    featuredMatch?.id,
    featuredMatch?.status,
    featuredMatch?.homeScore,
    featuredMatch?.awayScore,
  ]);

  const roomTabs: Array<[RoomView, string]> = [
    ["home", "Inicio"],
    ["matches", "Calendario"],
    ["picks", "Picks"],
    ["ranking", "Ranking"],
    ["facts", "IA"],
    ["more", "Más"],
  ];
  const moreRoomViews: RoomView[] = ["participants", "more"];

  function roomRoleLabel(league: League) {
    if (isSuperAdmin) return "Super usuario";
    if (league.ownerId === user.id) return "Dueño";
    const membership = league.memberships?.find((item) => item.userId === user.id);
    return membership?.role === "ADMIN" ? "Admin" : "Participante";
  }

  function roomParticipantsLabel(league: League) {
    return `${league.memberships?.length ?? 0}/${league.maxParticipants} participantes`;
  }

  function selectRoom(league: League) {
    setSelectedLeague(league);
    setRoomView("home");
    setIsRoomMenuOpen(false);
    hideMobileNavSoon();
  }

  function handleMobileNavTouchEnd(y: number) {
    if (mobileNavTouchStart === null) return;
    if (mobileNavTouchStart - y > 28) showMobileNav();
    setMobileNavTouchStart(null);
  }

  function openRoomTab(view: RoomView) {
    setRoomView(view);
    hideMobileNavSoon();
  }

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

      {!selectedLeague ? <div className="grid room-entry-grid">
        <section className="panel room-picker-panel glass-room-selector">
          <div className="section-title compact-title">
            <div>
              <span className="market-kicker">{isSuperAdmin ? "Super usuario" : "Mis salas"}</span>
              <h3>Selecciona una sala</h3>
              <p>Toca una sala para entrar directamente.</p>
            </div>
            {!isSuperAdmin ? <a className="button secondary compact-button" href="/planes">Crear liga</a> : null}
          </div>
          <div className="room-picker-list">
            {selectableLeagues.map((league) => (
              <button className="room-picker-row" key={league.id} onClick={() => selectRoom(league)} type="button">
                <span>
                  <strong>{league.name}</strong>
                  <small>
                    Código {league.inviteCode} · {roomStatusLabel(league.status)} · {roomParticipantsLabel(league)}
                  </small>
                </span>
                <span className="room-picker-meta">
                  <small>{roomRoleLabel(league)}</small>
                  <b>›</b>
                </span>
              </button>
            ))}
            {!selectableLeagues.length ? (
              <div className="empty room-empty-actions">
                <span>Aún no tienes salas activas.</span>
                <div>
                  <a className="button secondary compact-button" href="/planes">Crear liga</a>
                  {!isSuperAdmin ? <button className="button secondary compact-button" onClick={() => setIsRoomMenuOpen(true)} type="button">Ingresar con código</button> : null}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {!isSuperAdmin ? (
          <form className="panel form room-code-card" onSubmit={joinLeague}>
            <span className="market-kicker">¿Tienes código?</span>
            <h3>Ingresar con código</h3>
            <div className="form-row">
              <label htmlFor="invite-code">Código</label>
              <input id="invite-code" name="inviteCode" maxLength={16} minLength={4} placeholder="MP20ABCD" required />
            </div>
            <button className="button secondary compact-button" type="submit">Unirme</button>
          </form>
        ) : null}
      </div> : null}

      {message ? <div className="notice">{message}</div> : null}
      {syncError ? <div className="notice error">{syncError}</div> : null}

      {selectedLeague ? (
        <section className={`league-room ${embedded ? "embedded-room-view" : ""}`}>
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
              {canManageInvitation ? (
                <button className="button secondary compact-button" onClick={copyInvitation} type="button">Copiar invitación</button>
              ) : null}
              {!embedded ? (
                <button
                  className="button secondary compact-button"
                  onClick={() => {
                    setIsRoomMenuOpen(true);
                    hideMobileNavSoon();
                  }}
                  type="button"
                >
                  Salas
                </button>
              ) : null}
              {onLogout ? (
                <button className="button danger compact-button room-header-logout" onClick={onLogout} type="button">
                  <span aria-hidden="true">↗</span>
                  Salir
                </button>
              ) : null}
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
          <button
            className={`room-mobile-nav-handle ${isMobileNavOpen ? "is-open" : ""}`}
            onClick={() => showMobileNav()}
            onTouchStart={(event) => setMobileNavTouchStart(event.touches[0]?.clientY ?? null)}
            onTouchEnd={(event) => handleMobileNavTouchEnd(event.changedTouches[0]?.clientY ?? 0)}
            type="button"
            aria-label="Mostrar navegación de sala"
          >
            <span />
          </button>

          <div className={`room-mobile-drawer ${isMobileNavOpen ? "is-open" : "is-hidden"}`}>
            <span>{selectedLeague.name}</span>
            <div className="room-mobile-cajons">
              {roomTabs.slice(0, 2).map(([view, label]) => (
                <button
                  className={`room-mobile-cajon ${roomView === view || (view === "more" && moreRoomViews.includes(roomView)) ? "active" : ""}`}
                  key={view}
                  onClick={() => openRoomTab(view)}
                  type="button"
                >
                  <strong>{label}</strong>
                  <small>{roomView === view || (view === "more" && moreRoomViews.includes(roomView)) ? "Abierto" : "Tocar para abrir"}</small>
                </button>
              ))}
              {!embedded ? (
                <button
                  className="room-mobile-cajon"
                  onClick={() => {
                    setIsRoomMenuOpen(true);
                    hideMobileNavSoon();
                  }}
                  type="button"
                >
                  <strong>Salas</strong>
                  <small>Cambiar sala</small>
                </button>
              ) : null}
              {roomTabs.slice(2).map(([view, label]) => (
                <button
                  className={`room-mobile-cajon ${roomView === view || (view === "more" && moreRoomViews.includes(roomView)) ? "active" : ""}`}
                  key={view}
                  onClick={() => openRoomTab(view)}
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
                      <span>
                        {featuredMatch
                          ? featuredMatchStatus === "LIVE"
                            ? "PARTIDO EN VIVO"
                            : featuredMatchStatus === "FINISHED"
                              ? "ÚLTIMO RESULTADO"
                              : "PRÓXIMO PARTIDO"
                          : "Sin partido abierto"}
                      </span>
                      <strong>{selectedLeague.name}</strong>
                    </div>
                    {featuredMatch ? (
                      <>
                        <div className="room-next-teams">
                          <div>
                            <span>{flagForTeam(featuredMatch.homeTeam)}</span>
                            <strong>{featuredMatch.homeTeam}</strong>
                          </div>
                          <em>
                            {(featuredMatchStatus === "LIVE" || featuredMatchStatus === "FINISHED") &&
                            featuredMatchHasScore
                              ? `${featuredMatch.homeScore} - ${featuredMatch.awayScore}`
                              : featuredMatchStatus === "LIVE"
                                ? "En vivo"
                                : "vs"}
                          </em>
                          <div>
                            <span>{flagForTeam(featuredMatch.awayTeam)}</span>
                            <strong>{featuredMatch.awayTeam}</strong>
                          </div>
                        </div>
                        <p>
                          {featuredMatch.group ? `${featuredMatch.group} · ` : ""}
                          {new Date(featuredMatch.startsAt).toLocaleDateString("es", { weekday: "short", day: "2-digit", month: "short" })}
                          {" · "}
                          <strong>{new Date(featuredMatch.startsAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}</strong>
                          {featuredMatch.venue ? ` · ${featuredMatch.venue}` : ""}
                        </p>
                        {featuredPrediction ? (
                          <div className="room-my-pick-pill">
                            <span>Mi pronóstico</span>
                            <strong>{featuredPrediction.homeScore} - {featuredPrediction.awayScore}</strong>
                          </div>
                        ) : featuredMatchStatus === "LIVE" || featuredMatchStatus === "FINISHED" ? (
                          <>
                            <div className="room-my-pick-pill">
                              <span>Mi pronóstico</span>
                              <strong>Sin pronóstico</strong>
                            </div>
                            <div className="room-my-pick-pill">
                              <span>{featuredMatchStatus === "FINISHED" ? "Resultado final" : "Marcador actual"}</span>
                              <strong>
                                {featuredMatchHasScore
                                  ? `${featuredMatch.homeScore} - ${featuredMatch.awayScore}`
                                  : "Marcador pendiente"}
                              </strong>
                            </div>
                          </>
                        ) : (
                          <div className="room-countdown-grid" aria-label="Cuenta regresiva">
                            <article><strong>{String(nextCountdown.days).padStart(2, "0")}</strong><span>Días</span></article>
                            <article><strong>{String(nextCountdown.hours).padStart(2, "0")}</strong><span>Hrs</span></article>
                            <article><strong>{String(nextCountdown.minutes).padStart(2, "0")}</strong><span>Min</span></article>
                            <article><strong>{String(nextCountdown.seconds).padStart(2, "0")}</strong><span>Seg</span></article>
                          </div>
                        )}
                        {canEditFeaturedPick ? (
                          <div className="quick-home-pick-card" aria-label="Guardar pick rapido">
                            <div className="quick-home-scoreboard">
                              <div>
                                <span>{featuredMatch.homeTeam}</span>
                                <div className="quick-home-stepper">
                                  <button aria-label={`Restar gol a ${featuredMatch.homeTeam}`} onClick={() => setQuickHomePick((score) => Math.max(0, score - 1))} type="button">−</button>
                                  <strong>{quickHomePick}</strong>
                                  <button aria-label={`Sumar gol a ${featuredMatch.homeTeam}`} onClick={() => setQuickHomePick((score) => score + 1)} type="button">+</button>
                                </div>
                              </div>
                              <em>:</em>
                              <div>
                                <span>{featuredMatch.awayTeam}</span>
                                <div className="quick-home-stepper">
                                  <button aria-label={`Restar gol a ${featuredMatch.awayTeam}`} onClick={() => setQuickAwayPick((score) => Math.max(0, score - 1))} type="button">−</button>
                                  <strong>{quickAwayPick}</strong>
                                  <button aria-label={`Sumar gol a ${featuredMatch.awayTeam}`} onClick={() => setQuickAwayPick((score) => score + 1)} type="button">+</button>
                                </div>
                              </div>
                            </div>
                            <button className="button primary quick-home-save" disabled={quickPickSaving} onClick={saveFeaturedPick} type="button">
                              {quickPickSaving ? "Guardando..." : featuredPrediction ? "Actualizar pick" : "Guardar pick"}
                            </button>
                            {quickPickMessage ? <p className="quick-home-message">{quickPickMessage}</p> : null}
                          </div>
                        ) : (
                          <div className="room-home-actions single-action">
                            <button className="button primary" onClick={() => setRoomView("picks")} type="button">
                              {isSuperAdmin ? "Ver picks" : featuredActionLabel}
                            </button>
                          </div>
                        )}
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

                  <section className="panel room-create-promo-card visual-room-ad">
                    <div>
                      <span className="market-kicker">Crea tu propia liga</span>
                      <h3>Crea una liga privada</h3>
                      <p>Invita a tus amigos y compite en una sala privada.</p>
                    </div>
                    <div className="room-ad-visual" aria-hidden="true">
                      <span className="room-ad-trophy">🏆</span>
                      <div className="room-ad-mini-ranking">
                        <strong>1. Tú</strong>
                        <span>2. Amigo</span>
                        <span>3. Grupo</span>
                      </div>
                      <small>CODIGO: MP26</small>
                    </div>
                    <a className="button secondary compact-button room-promo-action" href="/planes">
                      Crear liga
                    </a>
                  </section>

                  <section className="panel room-home-summary compact-home-summary personal-room-summary">
                    <article><span>Tu posición</span><strong>{userRanking ? `#${userRankingIndex + 1}` : "-"}</strong></article>
                    <article><span>Tus puntos</span><strong>{userRanking?.points ?? 0}</strong></article>
                    <article><span>Tus aciertos</span><strong>{userExactScores}</strong></article>
                  </section>
                </div>

                <aside className="room-home-sidebar">
                  <section className="panel room-ranking-preview room-complete-ranking">
                    <div className="section-title">
                      <div>
                        <span className="market-kicker">Ranking</span>
                        <h3>Ranking completo</h3>
                      </div>
                    </div>
                    <div className="room-ranking-card-list">
                      {ranking.map((entry, index) => (
                        <article
                          className={`${entry.id === user.id ? "current-user" : ""} ${index < 3 ? "podium-rank" : ""}`}
                          key={entry.id}
                        >
                          <span>{index === 0 ? "🏆" : `#${index + 1}`}</span>
                          <strong>{entry.name}</strong>
                          <em>{entry.points} pts · {entry.predictions} picks</em>
                        </article>
                      ))}
                      {!ranking.length ? <div className="empty">El ranking aparecerá cuando haya participantes.</div> : null}
                    </div>
                  </section>

                  <section className="panel room-recent-picks room-all-picks-card">
                    <div className="section-title">
                      <div>
                        <span className="market-kicker">Picks</span>
                        <h3>{liveRoomPredictions.length ? "Picks en vivo" : "Picks finales"}</h3>
                      </div>
                    </div>
                    <div className="room-prediction-list compact-prediction-list">
                      {roomHomePredictions.map((prediction) => (
                        <article className="room-prediction" key={prediction.id}>
                          <div>
                            <strong>{prediction.user.name}</strong>
                            <span>
                              {prediction.match.homeTeam} vs {prediction.match.awayTeam}
                              {" · "}
                              {matchStatusLabel(prediction.match.status)}
                            </span>
                          </div>
                          <strong>
                            {prediction.homeScore !== null && prediction.awayScore !== null
                              ? `${prediction.homeScore} - ${prediction.awayScore}`
                              : "Sin pronóstico"}
                          </strong>
                          <span>{prediction.points} pts</span>
                        </article>
                      ))}
                      {!roomHomePredictions.length ? <div className="empty">Los picks se mostrarán cuando inicie el partido.</div> : null}
                    </div>
                  </section>
                </aside>
              </div>
            </div>
          ) : null}

          {roomView === "picks" ? (
            <div className="room-screen">
              <section className="panel room-screen-header">
                <div>
                  <span className="market-kicker">Tus pronósticos</span>
                  <h3>Mis picks</h3>
                  <p>Revisa tus picks pendientes, en vivo y finalizados.</p>
                </div>
                <div className="room-filter-pills" aria-label="Filtrar picks">
                  {[
                    ["PENDING", "Pendientes"],
                    ["LIVE", "En vivo"],
                    ["FINISHED", "Finalizados"],
                    ["ALL", "Todos"],
                  ].map(([value, label]) => (
                    <button
                      className={picksFilter === value ? "active" : ""}
                      key={value}
                      onClick={() => setPicksFilter(value as typeof picksFilter)}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="room-picks-summary">
                <article className="panel"><span>Picks realizados</span><strong>{savedPicks.length}</strong></article>
                <article className="panel"><span>Picks pendientes</span><strong>{pendingPickCount}</strong></article>
                <article className="panel"><span>Puntos obtenidos</span><strong>{userPointsFromPicks}</strong></article>
              </section>

              <section className="panel market-board room-picks-board compact-room-picks">
                <div className="market-list room-picks-list">
                  {filteredPickMatches.map((match) => (
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
                  {!filteredPickMatches.length ? <div className="empty">No hay picks para este filtro.</div> : null}
                </div>
              </section>

              <section className="panel room-predictions compact-history-panel">
                <div className="section-title">
                  <div><span className="market-kicker">Historial</span><h3>Últimos picks guardados</h3></div>
                </div>
                <div className="room-prediction-list compact-prediction-list">
                  {recentUserPicks.map(({ match, prediction }) => (
                    <article className="room-prediction" key={prediction.id}>
                      <div>
                        <strong>{match.homeTeam} vs {match.awayTeam}</strong>
                        <span>{matchStatusLabel(match.status)}</span>
                      </div>
                      <strong>{prediction.homeScore} - {prediction.awayScore}</strong>
                      <span>{prediction.points} pts</span>
                    </article>
                  ))}
                  {!recentUserPicks.length ? <div className="empty">Todavía no has guardado picks en esta sala.</div> : null}
                </div>
              </section>
            </div>
          ) : null}

          {roomView === "matches" ? (
            <div className="room-screen">
              <section className="panel room-screen-header">
                <div>
                  <span className="market-kicker">Calendario</span>
                  <h3>Calendario de partidos</h3>
                  <p>Consulta los partidos de la sala y revisa tus pronósticos.</p>
                </div>
                <div className="room-filter-pills" aria-label="Filtrar calendario">
                  {[
                    ["ALL", "Todos"],
                    ["TODAY", "Hoy"],
                    ["PENDING", "Pendientes"],
                    ["LIVE", "En vivo"],
                    ["FINISHED", "Finalizados"],
                  ].map(([value, label]) => (
                    <button
                      className={calendarFilter === value ? "active" : ""}
                      key={value}
                      onClick={() => setCalendarFilter(value as typeof calendarFilter)}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              {canEditRoomInfo ? (
                <details className="panel room-config-drawer room-admin-calendar-tools">
                  <summary>Herramientas de calendario</summary>
                  <div className="room-admin-tool-grid">
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
                      <button className="button secondary compact-button" type="submit">Cargar partidos</button>
                    </form>

                    <details className="room-config-drawer compact-private-league">
                      <summary>Crear partido privado</summary>
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
                        <button className="button secondary compact-button" type="submit">Crear partido</button>
                      </form>
                    </details>
                  </div>
                </details>
              ) : null}

              <section className="room-calendar-list">
                {calendarMatchesByDay.map((day) => (
                  <div className="room-calendar-day" key={day.key}>
                    <div className="room-calendar-day-header">
                      <h4>{day.label}</h4>
                      <span>{day.matches.length} partido{day.matches.length === 1 ? "" : "s"}</span>
                    </div>
                    {day.matches.map((match) => {
                      const prediction = match.predictions?.[0];
                      const actionLabel = match.status === "FINISHED"
                        ? "Ver resultado"
                        : prediction
                          ? "Editar pronóstico"
                          : "Hacer pronóstico";

                      return (
                        <article className={`room-calendar-card ${match.status.toLowerCase()}`} key={match.id}>
                          <div className="room-calendar-teams">
                            <span>{flagForTeam(match.homeTeam)}</span>
                            <strong>{match.homeTeam}</strong>
                            <em>vs</em>
                            <span>{flagForTeam(match.awayTeam)}</span>
                            <strong>{match.awayTeam}</strong>
                          </div>
                          <div className="room-calendar-meta">
                            <span>{matchStatusLabel(match.status)}</span>
                            <span>{new Date(match.startsAt).toLocaleString("es", { hour: "2-digit", minute: "2-digit" })}</span>
                            {match.group ? <span>{match.group}</span> : null}
                            {match.venue ? <span>{match.venue}</span> : null}
                          </div>
                          <div className="room-calendar-result">
                            <strong>{match.homeScore !== null && match.awayScore !== null ? `${match.homeScore} - ${match.awayScore}` : "vs"}</strong>
                            {prediction ? <span>Mi pick {prediction.homeScore} - {prediction.awayScore} · {prediction.points} pts</span> : <span>Sin pick</span>}
                          </div>
                          <div className="room-calendar-actions">
                            <button className="button primary compact-button" onClick={() => setRoomView("picks")} type="button">
                              {actionLabel}
                            </button>
                            {canEditRoomInfo ? (
                              <button
                                className="button secondary compact-button"
                                onClick={() => publishRoomMatch(match.id, !match.isPublished)}
                                type="button"
                              >
                                {match.isPublished ? "Ocultar" : "Publicar"}
                              </button>
                            ) : null}
                            {isSuperAdmin && match.status !== "FINISHED" ? (
                              <form className="room-close-match-form compact-close-form" onSubmit={(event) => closeMatchManually(event, match)}>
                                <input aria-label={`Goles de ${match.homeTeam}`} defaultValue={match.homeScore ?? ""} min={0} name="manualHomeScore" placeholder="L" type="number" />
                                <input aria-label={`Goles de ${match.awayTeam}`} defaultValue={match.awayScore ?? ""} min={0} name="manualAwayScore" placeholder="V" type="number" />
                                <button className="button danger compact-button" type="submit">Cerrar</button>
                              </form>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ))}
                {!calendarMatchesByDay.length ? (
                  <div className="empty">No hay partidos para este filtro.</div>
                ) : null}
              </section>
            </div>
          ) : null}

          {roomView === "facts" ? (
            <section className="panel smart-preview-board room-screen">
              <div className="section-title room-screen-title">
                <div>
                  <span className="market-kicker">Previa inteligente</span>
                  <h3>Previa inteligente</h3>
                  <p>Análisis orientativo para ayudarte a decidir tu pronóstico.</p>
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
                    <h4>Lectura del partido</h4>
                    <p>{intelligenceTrend || "Información limitada. Esta previa se basa solo en los datos disponibles del partido."}</p>
                  </article>
                  <article className="smart-preview-card">
                    <h4>Factores clave</h4>
                    <ul className="smart-factor-list">
                      <li><span>Estado</span><strong>{matchStatusLabel(intelligenceMatch.status)}</strong></li>
                      <li><span>Contexto</span><strong>{intelligenceMatch.group ?? "Grupo sin registrar"}</strong></li>
                      <li><span>Riesgo</span><strong>{intelligenceMatch.status === "LIVE" ? "Medio" : "Alto"}</strong></li>
                      <li><span>Incertidumbre</span><strong>{intelligenceMatch.homeScore !== null ? "Media" : "Alta"}</strong></li>
                    </ul>
                  </article>
                  <article className="smart-preview-card accent">
                    <h4>Pronóstico orientativo</h4>
                    <div className="smart-outlook-grid">
                      <span><small>Tendencia</small><strong>{intelligenceSuggestedTrend}</strong></span>
                      <span><small>Marcador</small><strong>{intelligenceSuggestedScore}</strong></span>
                      <span><small>Confianza</small><strong>{intelligenceConfidence}</strong></span>
                    </div>
                    <button className="button secondary compact-button" onClick={() => setRoomView("picks")} type="button">
                      Usar como referencia
                    </button>
                  </article>
                  <p className="smart-preview-note">La IA solo ofrece una orientación. El resultado real puede variar.</p>
                </div>
              ) : (
                <div className="empty">Información limitada. Esta previa se basa solo en los datos disponibles del partido.</div>
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
                <button className={`button secondary room-more-chat-button ${hasChatActivity ? "has-activity" : ""}`} onClick={() => setIsChatOpen(true)} type="button">
                  <span>Chat de la sala</span>
                  {hasChatActivity ? <small className="room-more-badge">{chatActivityLabel}</small> : null}
                </button>
                {canManageInvitation ? (
                  <button className="button secondary" onClick={shareInvitation} type="button">
                    Compartir invitación
                  </button>
                ) : null}
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
            <div className="room-screen">
              <section className="panel room-screen-header">
                <div>
                  <span className="market-kicker">Clasificación privada</span>
                  <h3>Ranking de la sala</h3>
                  <p>Compite con tus amigos y revisa tu posición.</p>
                </div>
                {userRanking ? <button className="button secondary compact-button" onClick={shareRanking} type="button">Compartir ranking</button> : null}
              </section>

              <section className="room-ranking-hero">
                <article className="panel room-my-ranking-card">
                  <span>{isSuperAdmin ? "Sala completa" : "Mi posición"}</span>
                  <strong>{userRanking ? `#${userRankingIndex + 1}` : "-"}</strong>
                  <p>{userRanking ? `${userRanking.points} puntos · ${userRanking.predictions} picks` : `${members.length} participantes · ${totalPicks} picks`}</p>
                  {!isSuperAdmin ? <small>{userRanking ? `${pointsBehindLeader} pts del líder` : "Aún sin posición"}</small> : null}
                </article>
                <article className="panel room-group-mini">
                  <span>Información del grupo</span>
                  <div>
                    <strong>{groupInfo?.memberCount ?? members.length}</strong><small>miembros</small>
                    <strong>{groupInfo?.predictionCount ?? totalPicks}</strong><small>picks</small>
                    <strong>{groupInfo?.mostExact?.exactScores ?? 0}</strong><small>exactos</small>
                  </div>
                </article>
              </section>

              <section className="panel room-ranking">
                <div className="section-title">
                  <div><span className="market-kicker">Top ranking</span><h3>Top 3</h3></div>
                </div>
                <div className="room-podium-grid">
                  {rankingTopThree.map((entry, index) => (
                    <article className={`${entry.id === user.id ? "current-user" : ""} podium-rank-${index + 1}`} key={entry.id}>
                      <span>{index === 0 ? "🏆 #1" : `#${index + 1}`}</span>
                      <strong>{entry.name}</strong>
                      <em>{entry.points} pts</em>
                      <small>{entry.predictions} picks</small>
                    </article>
                  ))}
                  {!rankingTopThree.length ? <div className="empty">El ranking aparecerá cuando haya picks guardados.</div> : null}
                </div>
              </section>

              <section className="panel room-ranking">
                <div className="section-title">
                  <div><span className="market-kicker">Lista completa</span><h3>Todos los participantes</h3></div>
                </div>
                <div className="room-ranking-list">
                  {ranking.map((entry, index) => (
                    <article className={entry.id === user.id ? "current-user" : ""} key={entry.id}>
                      <span>{index === 0 ? "🏆 #1" : `#${index + 1}`}</span>
                      <strong>{entry.name}</strong>
                      <small>{entry.predictions} picks</small>
                      <em>{entry.points} pts</em>
                    </article>
                  ))}
                  {!ranking.length ? <div className="empty">El ranking completo aparecerá cuando haya participantes.</div> : null}
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
          <button className={`room-chat-fab ${hasChatActivity ? "has-activity" : ""}`} onClick={() => setIsChatOpen(true)} type="button" aria-label="Abrir chat de sala">
            <span>Chat</span>
            {hasChatActivity ? <small className="room-chat-badge">{chatActivityLabel}</small> : null}
          </button>
          {isChatOpen ? (
            <div className="room-chat-shell" role="dialog" aria-modal="true" aria-label="Chat de sala">
              <button className="room-chat-backdrop" onClick={() => setIsChatOpen(false)} type="button" aria-label="Cerrar chat" />
              <section className="league-chat room-chat-panel">
                <div className="room-chat-handle" aria-hidden="true" />
                <header className="room-chat-header">
                  <div>
                    <span className="market-kicker">Chat de sala</span>
                    <h3>Chat de sala</h3>
                    <p>Conversa con los participantes de esta quiniela.</p>
                  </div>
                  <button className="room-chat-close" onClick={() => setIsChatOpen(false)} type="button" aria-label="Cerrar chat">
                    ×
                  </button>
                </header>
                <div className="league-chat-messages room-chat-messages" aria-live="polite">
                  {chatMessages.map((chatMessage) => (
                    <article className={`league-chat-message ${chatMessage.user.id === user.id ? "own-message" : ""}`} key={chatMessage.id}>
                      <div>
                        <strong>{chatMessage.user.name}</strong>
                        <time>{new Date(chatMessage.createdAt).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}</time>
                      </div>
                      {chatMessage.body ? <p>{chatMessage.body}</p> : null}
                    </article>
                  ))}
                  {!chatMessages.length ? <div className="empty room-chat-empty">Aún no hay mensajes en esta sala. Sé el primero en escribir.</div> : null}
                </div>
                <form className="league-chat-form room-chat-form" onSubmit={sendChatMessage}>
                  <input maxLength={500} name="message" placeholder="Escribe un mensaje..." required />
                  <button className="button primary compact-button" type="submit">Enviar</button>
                </form>
              </section>
            </div>
          ) : null}
          </>
          )}
        </section>
      ) : null}
      {isRoomMenuOpen && !embedded ? (
        <div className="room-sheet-shell" role="dialog" aria-modal="true" aria-label="Mis salas">
          <button className="room-sheet-backdrop" onClick={() => setIsRoomMenuOpen(false)} type="button" aria-label="Cerrar selector de salas" />
          <section className="room-sheet-panel glass-room-selector">
            <div className="room-chat-handle" aria-hidden="true" />
            <header className="room-sheet-header">
              <div>
                <span className="market-kicker">{isSuperAdmin ? "Todas las salas" : "Mis salas"}</span>
                <h3>Mis salas</h3>
                <p>Toca una sala para entrar directamente.</p>
              </div>
              <button className="room-chat-close" onClick={() => setIsRoomMenuOpen(false)} type="button" aria-label="Cerrar selector de salas">
                ×
              </button>
            </header>
            <div className="room-sheet-list">
              {selectableLeagues.map((league) => (
                <button className="room-picker-row sheet-row" key={league.id} onClick={() => selectRoom(league)} type="button">
                  <span>
                    <strong>{league.name}</strong>
                    <small>
                      Código {league.inviteCode} · {roomStatusLabel(league.status)} · {roomParticipantsLabel(league)}
                    </small>
                  </span>
                  <span className="room-picker-meta">
                    <small>{roomRoleLabel(league)}</small>
                    <b>›</b>
                  </span>
                </button>
              ))}
              {!selectableLeagues.length ? (
                <div className="empty room-empty-actions">
                  <span>Aún no tienes salas activas.</span>
                  <div>
                    <a className="button secondary compact-button" href="/planes">Crear liga</a>
                  </div>
                </div>
              ) : null}
            </div>
            {!isSuperAdmin ? (
              <form className="room-sheet-code-form" onSubmit={joinLeague}>
                <label htmlFor="sheet-invite-code">Ingresar con código</label>
                <div>
                  <input id="sheet-invite-code" name="inviteCode" maxLength={16} minLength={4} placeholder="MP20ABCD" required />
                  <button className="button secondary compact-button" type="submit">Unirme</button>
                </div>
              </form>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
