"use client";

import { FormEvent, useEffect, useState } from "react";
import { LeaguePanel } from "@/components/league-panel";
import type { Competition, Match, RoomPlan, User } from "@/components/types";
import { matchStatusLabel, roomStatusLabel } from "@/lib/status-labels";
import { flagForTeam } from "@/lib/team-flags";

type AdminUser = {
  id: string;
  name: string;
  phone: string;
  role: "USER" | "ADMIN";
  isActive: boolean;
  entryPaidAt: string | null;
  picksCount: number;
  points: number;
};

type Props = {
  matches: Match[];
  onChanged: () => void;
  initialView?: AdminView;
  refreshRequest?: number;
  user: User;
};

type AdminView = "overview" | "matches" | "tools" | "users" | "rooms";
type OwnerRoomStatusFilter = "all" | "active" | "pending" | "closed";

type PinDeliveryNote = {
  name: string;
  phone: string;
  pin: string;
  message: string;
};

type AdminRoom = {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  maxParticipants: number;
  status: "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CLOSED";
  expiresAt: string | null;
  paymentStatus: string;
  paymentAmountInCents: number;
  paidAt: string | null;
  plan: { id: string; name: string; slug: string } | null;
  competition: { id: string; name: string; season: string } | null;
  owner: { id: string; name: string; phone: string };
  memberships: Array<{
    role: "MEMBER" | "ADMIN";
    user: { id: string; name: string; phone: string; role: "USER" | "ADMIN" };
  }>;
};

type RoomSummary = {
  total: number;
  activeRooms: number;
  expiredRooms: number;
  incomeInCents: number;
};

type AdminRoomDashboard = {
  summary: {
    participants: number;
    admins: number;
    matches: number;
    picks: number;
    messages: number;
    finishedMatches: number;
    liveMatches: number;
  };
  participants: Array<{
    id: string;
    name: string;
    phone: string;
    isActive: boolean;
    entryPaidAt: string | null;
    role: "MEMBER" | "ADMIN";
    joinedAt: string;
  }>;
  ranking: Array<{
    id: string;
    name: string;
    phone: string;
    isActive: boolean;
    entryPaidAt: string | null;
    roomRole: "MEMBER" | "ADMIN";
    predictions: number;
    points: number;
    exactScores: number;
  }>;
  matches: Array<{
    id: string;
    homeTeam: string;
    awayTeam: string;
    group: string | null;
    venue: string | null;
    startsAt: string;
    homeScore: number | null;
    awayScore: number | null;
    status: "SCHEDULED" | "LIVE" | "FINISHED";
    isPublished: boolean;
  }>;
  predictions: Array<{
    id: string;
    homeScore: number;
    awayScore: number;
    points: number;
    user: { id: string; name: string; phone: string };
    match: {
      id: string;
      homeTeam: string;
      awayTeam: string;
      startsAt: string;
      homeScore: number | null;
      awayScore: number | null;
      status: "SCHEDULED" | "LIVE" | "FINISHED";
    };
  }>;
  messages: Array<{
    id: string;
    body: string;
    createdAt: string;
    user: { id: string; name: string; phone: string; role: "USER" | "ADMIN" };
  }>;
};

function bogotaDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return `${year}-${month}-${day}`;
}

function readableBogotaDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00-05:00`).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function datetimeLocalValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return offsetDate.toISOString().slice(0, 16);
}

function bogotaDateTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "fecha invalida";
  const parts = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "00";

  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}`;
}

function formatAdminMatchOption(
  match: Pick<Match, "id" | "homeTeam" | "awayTeam" | "startsAt" | "status" | "isPublished">,
) {
  const shortId = match.id.slice(-6);
  const hiddenLabel = match.isPublished ? "" : " — oculto";
  return `${match.homeTeam} vs ${match.awayTeam} — ${bogotaDateTimeLabel(match.startsAt)} — ${match.status}${hiddenLabel} — ${shortId}`;
}

function buildPinDeliveryMessage(name: string, phone: string, pin: string) {
  return `Hola, ${name}. Tu acceso a Mundial Picks está listo. Entra con tu WhatsApp ${phone} y tu PIN: ${pin}. No compartas este PIN.`;
}

function isAdminRoomActivated(room: Pick<AdminRoom, "paidAt" | "paymentStatus">) {
  const paymentStatus = room.paymentStatus.toUpperCase();
  return Boolean(room.paidAt) || ["APPROVED", "TRIAL", "MANUAL"].includes(paymentStatus);
}

function adminRoomPaymentLabel(room: Pick<AdminRoom, "paidAt" | "paymentStatus">) {
  const paymentStatus = room.paymentStatus.toUpperCase();

  if (paymentStatus === "TRIAL") return "Prueba";
  if (paymentStatus === "MANUAL") return "Manual";
  if (room.paidAt || paymentStatus === "APPROVED") return "Pago aprobado";
  if (paymentStatus === "PENDING") return "Pendiente de pago";
  return paymentStatus || "Sin estado de pago";
}

export function AdminPanel({ matches, onChanged, initialView = "rooms", refreshRequest = 0, user }: Props) {
  const [message, setMessage] = useState("");
  const [pinDeliveryNote, setPinDeliveryNote] = useState<PinDeliveryNote | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [ownerDirectorySearchTerm, setOwnerDirectorySearchTerm] = useState("");
  const [ownerRoomStatusFilter, setOwnerRoomStatusFilter] = useState<OwnerRoomStatusFilter>("all");
  const [adminView, setAdminView] = useState<AdminView>(initialView);
  const [selectedPasswordUserId, setSelectedPasswordUserId] = useState("");
  const [adminRooms, setAdminRooms] = useState<AdminRoom[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [roomPlans, setRoomPlans] = useState<RoomPlan[]>([]);
  const [roomSummary, setRoomSummary] = useState<RoomSummary>({ total: 0, activeRooms: 0, expiredRooms: 0, incomeInCents: 0 });
  const [selectedAdminRoomId, setSelectedAdminRoomId] = useState("");
  const [selectedSettingsRoomId, setSelectedSettingsRoomId] = useState("");
  const [selectedRoomUserId, setSelectedRoomUserId] = useState("");
  const [roomDashboard, setRoomDashboard] = useState<AdminRoomDashboard | null>(null);
  const [roomDashboardLoading, setRoomDashboardLoading] = useState(false);
  const [selectedPublishDate, setSelectedPublishDate] = useState("");
  const [adminPickLeagueId, setAdminPickLeagueId] = useState("");
  const [adminPickMatches, setAdminPickMatches] = useState<AdminRoomDashboard["matches"]>([]);
  const [adminPickMatchesLoading, setAdminPickMatchesLoading] = useState(false);
  const [adminPickSaving, setAdminPickSaving] = useState(false);
  const publishedMatches = matches.filter((match) => match.isPublished).length;
  const resultLoadedMatches = matches.filter((match) => match.homeScore !== null && match.awayScore !== null).length;
  const activeUsers = users.filter((user) => user.isActive).length;
  const normalizedOwnerSearchTerm = ownerDirectorySearchTerm.trim().toLowerCase();
  const normalizedOwnerSearchDigits = ownerDirectorySearchTerm.replace(/\D/g, "");
  const visibleOwnerRooms = adminRooms.filter((room) => {
    const searchableText = `${room.name} ${room.owner.name} ${room.owner.phone}`.toLowerCase();
    const ownerPhoneDigits = room.owner.phone.replace(/\D/g, "");
    const isActivated = isAdminRoomActivated(room);
    const isClosed = ["CLOSED", "SUSPENDED", "EXPIRED"].includes(room.status);
    const matchesSearch =
      !normalizedOwnerSearchTerm ||
      searchableText.includes(normalizedOwnerSearchTerm) ||
      (Boolean(normalizedOwnerSearchDigits) && ownerPhoneDigits.includes(normalizedOwnerSearchDigits));
    const matchesStatus =
      ownerRoomStatusFilter === "all" ||
      (ownerRoomStatusFilter === "active" && room.status === "ACTIVE" && isActivated) ||
      (ownerRoomStatusFilter === "pending" && !isActivated) ||
      (ownerRoomStatusFilter === "closed" && isClosed);

    return matchesSearch && matchesStatus;
  });
  const liveMatch = matches
    .filter((match) => match.isPublished && match.status === "LIVE")
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
  const nextScheduledMatch = matches
    .filter((match) => match.isPublished && match.status === "SCHEDULED")
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
  const editableResultMatches = matches.filter((match) => match.isPublished);
  const matchesWithScoreNotClosed = matches
    .filter((match) => match.homeScore !== null && match.awayScore !== null && match.status !== "FINISHED")
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const matchDays = [...matches]
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .reduce<Array<{ date: string; label: string; matches: Match[]; published: number }>>((days, match) => {
      const date = bogotaDateKey(new Date(match.startsAt));
      let day = days.find((item) => item.date === date);
      if (!day) {
        day = { date, label: readableBogotaDate(date), matches: [], published: 0 };
        days.push(day);
      }
      day.matches.push(match);
      if (match.isPublished) day.published += 1;
      return days;
    }, []);
  const selectedPublishDay = matchDays.find((day) => day.date === selectedPublishDate) ?? matchDays[0] ?? null;
  const todayKey = bogotaDateKey(new Date());
  const todayPublishDay = matchDays.find((day) => day.date === todayKey) ?? null;
  const nextPendingPublishDay = matchDays.find((day) => day.published < day.matches.length) ?? null;
  const selectedHiddenMatches = selectedPublishDay ? selectedPublishDay.matches.length - selectedPublishDay.published : 0;
  const selectedRoom =
    adminRooms.find((room) => room.id === selectedSettingsRoomId) ??
    adminRooms.find((room) => room.id === selectedAdminRoomId) ??
    null;
  const selectedRoomMemberships = selectedRoom?.memberships.filter((membership) => membership.user.role !== "ADMIN") ?? [];
  const selectedRoomParticipant =
    roomDashboard?.participants.find((participant) => participant.id === selectedRoomUserId) ?? null;
  const selectedRoomRanking =
    roomDashboard?.ranking.find((entry) => entry.id === selectedRoomUserId) ?? null;
  const selectedRoomUserPredictions =
    roomDashboard?.predictions.filter((prediction) => prediction.user.id === selectedRoomUserId) ?? [];

  async function loadUsers() {
    const response = await fetch("/api/admin/users");
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudieron cargar los usuarios");
      return;
    }

    setUsers(data.users);
    setUsersLoaded(true);
  }

  async function loadRooms() {
    const [roomsResponse, competitionsResponse, plansResponse] = await Promise.all([
      fetch("/api/admin/rooms"),
      fetch("/api/competitions"),
      fetch("/api/plans"),
    ]);
    const roomsData = await roomsResponse.json();

    if (!roomsResponse.ok) {
      setMessage(roomsData.error ?? "No se pudieron cargar las salas");
      return;
    }

    const loadedRooms = (roomsData.rooms ?? []) as AdminRoom[];
    setAdminRooms(loadedRooms);
    setRoomSummary(roomsData.summary ?? { total: 0, activeRooms: 0, expiredRooms: 0, incomeInCents: 0 });
    setSelectedSettingsRoomId((current) =>
      current && loadedRooms.some((room) => room.id === current) ? current : "",
    );
    setSelectedAdminRoomId((current) =>
      current && loadedRooms.some((room) => room.id === current) ? current : "",
    );
    if (competitionsResponse.ok) {
      const competitionsData = await competitionsResponse.json();
      setCompetitions(competitionsData.competitions ?? []);
    }
    if (plansResponse.ok) {
      const plansData = await plansResponse.json();
      setRoomPlans(plansData.plans ?? []);
    }
    if (!usersLoaded) await loadUsers();
  }

  async function loadRoomDashboard(roomId = selectedRoom?.id ?? "") {
    if (!roomId) {
      setRoomDashboard(null);
      setSelectedRoomUserId("");
      return;
    }

    setRoomDashboardLoading(true);
    const response = await fetch(`/api/admin/rooms/${roomId}/dashboard`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    setRoomDashboardLoading(false);

    if (!response.ok) {
      setRoomDashboard(null);
      setMessage(data.error ?? "No se pudo cargar el tablero de la sala");
      return;
    }

    setRoomDashboard(data);
    setSelectedRoomUserId((current) =>
      current && data.participants?.some((participant: { id: string }) => participant.id === current) ? current : "",
    );
  }

  async function loadAdminPickMatches(roomId: string) {
    setAdminPickLeagueId(roomId);
    setAdminPickMatches([]);

    if (!roomId) return;

    setAdminPickMatchesLoading(true);
    try {
      const response = await fetch(`/api/admin/rooms/${roomId}/dashboard`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data.error ?? "No se pudieron cargar los partidos de la sala.");
        return;
      }

      setAdminPickMatches(data.matches ?? []);
    } finally {
      setAdminPickMatchesLoading(false);
    }
  }

  async function selectAdminRoom(roomId: string) {
    setSelectedSettingsRoomId(roomId);
    setSelectedAdminRoomId(roomId);
    setSelectedRoomUserId("");

    if (!roomId) {
      setRoomDashboard(null);
      setMessage("Selecciona una sala para cargar su tablero.");
      return;
    }

    setAdminView("rooms");
    const room = adminRooms.find((item) => item.id === roomId);
    setMessage(room ? `Sala seleccionada: ${room.name}` : "Sala seleccionada.");
    await loadRoomDashboard(roomId);
  }

  async function refreshVisibleAdminData() {
    if (adminView === "rooms") {
      await loadRooms();
      if (selectedRoom?.id) await loadRoomDashboard(selectedRoom.id);
      return;
    }

    if (adminView === "users") {
      await loadRooms();
      if (usersLoaded) await loadUsers();
      return;
    }

    if (adminView === "overview") {
      await loadRooms();
      await loadUsers();
      return;
    }

    await onChanged();
  }

  useEffect(() => {
    loadRooms();
  }, []);

  useEffect(() => {
    if (!refreshRequest) return;
    void refreshVisibleAdminData();
  }, [refreshRequest]);

  useEffect(() => {
    if (adminView === "rooms" && !usersLoaded) {
      loadUsers();
    }
  }, [adminView, usersLoaded]);

  useEffect(() => {
    if (adminView === "rooms" && selectedRoom?.id) {
      loadRoomDashboard(selectedRoom.id);
    } else if (adminView === "rooms" && !selectedRoom?.id) {
      setRoomDashboard(null);
      setSelectedRoomUserId("");
    }
  }, [adminView, selectedRoom?.id]);

  useEffect(() => {
    if (!matchDays.length) {
      if (selectedPublishDate) setSelectedPublishDate("");
      return;
    }
    if (!selectedPublishDate || !matchDays.some((day) => day.date === selectedPublishDate)) {
      setSelectedPublishDate(matchDays[0].date);
    }
  }, [matches, selectedPublishDate]);

  async function createTrialRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const response = await fetch("/api/admin/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("trialRoomName")),
        ownerId: String(formData.get("trialOwnerId")),
        competitionId: String(formData.get("trialCompetitionId")),
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo crear la prueba gratis");
      return;
    }

    setMessage(`Prueba gratis creada para ${data.owner}. Código: ${data.room.inviteCode}`);
    form.reset();
    await loadRooms();
  }

  async function createManualRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const expiresAt = String(formData.get("manualExpiresAt") ?? "");
    const response = await fetch("/api/admin/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "MANUAL",
        name: String(formData.get("manualRoomName")),
        ownerId: String(formData.get("manualOwnerId")),
        competitionId: String(formData.get("manualCompetitionId")),
        planId: String(formData.get("manualPlanId") ?? "") || undefined,
        maxParticipants: Number(formData.get("manualMaxParticipants")),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        pricePaidCop: Number(formData.get("manualPricePaidCop") || 0),
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo crear la sala manual");
      return;
    }

    setMessage(`Sala creada para ${data.owner}. Código: ${data.room.inviteCode}`);
    form.reset();
    await loadRooms();
  }

  async function updateRoomAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/rooms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leagueId: String(formData.get("adminRoomId")),
        userId: String(formData.get("roomAdminUserId")),
        role: String(formData.get("roomRole")),
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo cambiar el administrador de sala");
      return;
    }

    setMessage(`${data.membership.user.name} ahora es ${data.membership.role === "ADMIN" ? "administrador" : "participante"} en ${data.room}.`);
    await loadRooms();
    await loadRoomDashboard(String(formData.get("adminRoomId")));
  }

  async function updateSelectedRoomParticipantRole(role: "MEMBER" | "ADMIN") {
    if (!selectedRoom || !selectedRoomParticipant) {
      setMessage("Selecciona una sala y un participante");
      return;
    }

    const response = await fetch("/api/admin/rooms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leagueId: selectedRoom.id,
        userId: selectedRoomParticipant.id,
        role,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo cambiar el rol del participante");
      return;
    }

    setMessage(`${data.membership.user.name} actualizado dentro de ${data.room}.`);
    await loadRooms();
    await loadRoomDashboard(selectedRoom.id);
  }

  async function updateSelectedRoomParticipantStatus(isActive: boolean) {
    if (!selectedRoom || !selectedRoomParticipant) {
      setMessage("Selecciona una sala y un participante");
      return;
    }

    await updateUserStatus(selectedRoomParticipant.id, isActive);
    await loadRoomDashboard(selectedRoom.id);
  }

  async function removeSelectedRoomParticipant() {
    if (!selectedRoom || !selectedRoomParticipant) {
      setMessage("Selecciona una sala y un participante");
      return;
    }

    if (!window.confirm(`¿Retirar a ${selectedRoomParticipant.name} de ${selectedRoom.name}?`)) return;

    const response = await fetch(`/api/leagues/${selectedRoom.id}/members/${selectedRoomParticipant.id}`, { method: "DELETE" });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo retirar el participante de esta sala");
      return;
    }

    setMessage(`${data.removed.name} fue retirado de ${selectedRoom.name}.`);
    setSelectedRoomUserId("");
    await loadRooms();
    await loadRoomDashboard(selectedRoom.id);
  }

  async function updateRoomSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const expiresAt = String(formData.get("settingsExpiresAt") ?? "");
    const maxParticipants = String(formData.get("settingsMaxParticipants") ?? "");
    const response = await fetch("/api/admin/rooms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "roomSettings",
        leagueId: String(formData.get("settingsRoomId")),
        name: String(formData.get("settingsRoomName") ?? "").trim() || undefined,
        ownerId: String(formData.get("settingsOwnerId") ?? "") || undefined,
        status: String(formData.get("settingsStatus") ?? "") || undefined,
        maxParticipants: maxParticipants ? Number(maxParticipants) : undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo actualizar la sala");
      return;
    }
    setMessage(`Sala actualizada: ${data.room.name}`);
    await loadRooms();
    await loadRoomDashboard(data.room.id);
  }

  async function deleteAdminRoom(room: AdminRoom) {
    if (!window.confirm(`¿Eliminar definitivamente la sala "${room.name}"?`)) return;
    const response = await fetch(`/api/leagues/${room.id}`, { method: "DELETE" });
    const data = await response.json();
    setMessage(response.ok ? `Sala eliminada: ${room.name}` : data.error ?? "No se pudo eliminar la sala");
    if (response.ok) await loadRooms();
  }

  async function syncSelectedRoomResults(room: AdminRoom) {
    setMessage(`Sincronizando resultados de ${room.name}...`);
    const response = await fetch("/api/admin/rooms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "syncRoomResults", leagueId: room.id }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo sincronizar la sala");
      return;
    }
    setMessage(
      `${room.name}: resultados revisados ${data.roomMatchesMatched}. Actualizados ${data.roomMatchesSynced}. Ya sincronizados ${data.roomMatchesAlreadySynced}. Picks recalculados ${data.predictionsUpdated}.`,
    );
    await loadRooms();
    await loadRoomDashboard(room.id);
    await onChanged();
  }

  async function keepOnlyFamiliaAvella() {
    if (!window.confirm("¿Eliminar todas las salas excepto Familia Avella? Esta acción no se puede deshacer.")) return;
    setMessage("Limpiando salas y conservando Familia Avella...");
    const response = await fetch("/api/admin/rooms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "keepOnlyRoom", name: "Familia Avella" }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No se pudieron limpiar las salas");
      return;
    }
    setMessage(
      `Se conservó ${data.keptRoom.name}. Salas eliminadas ${data.deletedRooms}. Resultados actualizados ${data.roomMatchesSynced}. Picks recalculados ${data.predictionsUpdated}. Puntos manuales antiguos limpiados.`,
    );
    await loadRooms();
    await loadRoomDashboard(data.keptRoom.id);
    await onChanged();
  }

  async function copyRoomInvitation(room: AdminRoom) {
    const invitation = `Únete a "${room.name}" en Mundial Picks: https://www.mundialpicks.online. Código: ${room.inviteCode}`;
    await navigator.clipboard.writeText(invitation);
    setMessage(`Invitación copiada para ${room.name}`);
  }

  async function copyPinDeliveryMessage() {
    if (!pinDeliveryNote) return;

    try {
      await navigator.clipboard.writeText(pinDeliveryNote.message);
      setMessage(`Mensaje de PIN copiado para ${pinDeliveryNote.name}`);
    } catch {
      setMessage("No se pudo copiar el mensaje. Selecciona el texto y cópialo manualmente.");
    }
  }

  async function createMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const startsAt = new Date(String(formData.get("startsAt"))).toISOString();

    const response = await fetch("/api/admin/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        homeTeam: String(formData.get("homeTeam")),
        awayTeam: String(formData.get("awayTeam")),
        group: String(formData.get("group") ?? ""),
        venue: String(formData.get("venue") ?? ""),
        broadcastUrl: String(formData.get("broadcastUrl") ?? ""),
        startsAt,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo crear el partido");
      return;
    }

    setMessage("Partido creado");
    event.currentTarget.reset();
    onChanged();
  }

  async function saveResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const matchId = String(formData.get("matchId"));
    const isFinal = formData.get("resultAction") === "final";

    const response = await fetch(`/api/admin/matches/${matchId}/result`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        homeScore: Number(formData.get("homeScore")),
        awayScore: Number(formData.get("awayScore")),
        isFinal,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo cargar el resultado");
      return;
    }

    const syncNote = data.roomMatchesSynced
      ? ` Salas sincronizadas: ${data.roomMatchesSynced}.`
      : data.roomMatchesAlreadySynced
        ? ` Salas ya estaban sincronizadas: ${data.roomMatchesAlreadySynced}.`
        : "";
    setMessage(
      isFinal
        ? `Resultado final guardado y puntos recalculados.${syncNote}`
        : `Marcador parcial guardado y puntos actualizados en vivo.${syncNote}`,
    );
    onChanged();
  }

  async function saveBroadcastUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const matchId = String(formData.get("broadcastMatchId"));

    const response = await fetch(`/api/admin/matches/${matchId}/broadcast`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        broadcastUrl: String(formData.get("broadcastUrl") ?? ""),
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo guardar el enlace");
      return;
    }

    setMessage(`Enlace oficial actualizado: ${data.match.homeTeam} vs ${data.match.awayTeam}`);
    onChanged();
    event.currentTarget.reset();
  }

  async function recalculate(options: { clearManualPoints?: boolean } = {}) {
    if (
      options.clearManualPoints &&
      !window.confirm("¿Recalcular todo automaticamente y borrar ajustes manuales de puntos?")
    ) {
      return;
    }

    setMessage("");
    const response = await fetch("/api/admin/recalculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo recalcular");
      return;
    }
    setMessage(
      data.clearManualPoints
        ? `Picks recalculados automaticamente: ${data.updated}. Ajustes manuales limpiados.`
        : `Picks recalculados: ${data.updated}. Se respetaron puntos manuales.`,
    );
    onChanged();
  }

  async function testWhatsApp() {
    setMessage("Enviando prueba de WhatsApp...");
    const response = await fetch("/api/admin/whatsapp-test", { method: "POST" });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo enviar la prueba de WhatsApp");
      return;
    }

    if (data.sent > 0) {
      setMessage("Prueba de WhatsApp enviada. Revisa el celular configurado.");
      return;
    }

    const errorDetail = Array.isArray(data.errors) && data.errors.length ? ` Detalle: ${data.errors[0]}` : "";
    setMessage(`WhatsApp no envio el mensaje. Revisa token, plantilla aprobada y variables en Vercel.${errorDetail}`);
  }

  async function updateResults() {
    setMessage("Actualizando resultados reales...");
    const response = await fetch("/api/admin/update-results", { method: "POST" });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudieron actualizar los resultados");
      return;
    }

    const unchangedNote =
      data.updated === 0 && data.matched > 0
        ? ` ${data.matched} partido(s) ya estaban al día en el calendario principal.`
        : "";
    const roomNote =
      data.roomMatchesAlreadySynced > 0
        ? ` Salas ya sincronizadas: ${data.roomMatchesAlreadySynced}.`
        : "";
    const providerNote = Array.isArray(data.providerErrors) && data.providerErrors.length
      ? ` Aviso proveedor: ${data.providerErrors[0]}`
      : "";
    setMessage(
      `API recibió: ${data.received ?? 0}. Relacionados: ${data.matched ?? 0}. Resultados revisados: ${data.checked}. Partidos actualizados: ${data.updated}. Salas revisadas: ${data.roomMatchesMatched ?? 0}. Salas sincronizadas: ${data.roomMatchesSynced ?? 0}.${unchangedNote}${roomNote} Picks recalculados: ${data.predictionsUpdated}.${providerNote}`,
    );
    onChanged();
  }

  async function syncAllRoomResults() {
    setMessage("Sincronizando resultados de salas...");
    const response = await fetch("/api/admin/sync-room-results", { method: "POST" });
    const data = await response.json();

    if (!response.ok || !data.ok) {
      setMessage(data.error ?? "No se pudieron sincronizar las salas");
      return;
    }

    const result = data.result ?? {};
    setMessage(
      `Salas revisadas: ${result.checked ?? 0}. Actualizadas: ${result.updated ?? 0}. Ya sincronizadas: ${result.alreadySynced ?? 0}.`,
    );
    onChanged();
  }

  async function importWorldCupCalendar() {
    setMessage("Cargando calendario oficial...");
    const response = await fetch("/api/admin/import-worldcup-calendar", { method: "POST" });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo cargar el calendario");
      return;
    }

    setMessage(`Calendario cargado: ${data.total} partidos. Nuevos: ${data.created}. Actualizados: ${data.updated}.`);
    onChanged();
  }

  async function deleteMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const matchId = String(formData.get("deleteMatchId"));
    const match = matches.find((item) => item.id === matchId);

    if (!match) {
      setMessage("Selecciona un partido valido");
      return;
    }

    const confirmed = window.confirm(`Eliminar ${match.homeTeam} vs ${match.awayTeam}? Tambien se borraran sus picks.`);
    if (!confirmed) return;

    const response = await fetch(`/api/admin/matches/${matchId}`, { method: "DELETE" });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo eliminar el partido");
      return;
    }

    setMessage(`Partido eliminado: ${data.match.homeTeam} vs ${data.match.awayTeam}`);
    onChanged();
  }

  async function deletePick(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const userId = String(formData.get("pickUserId"));
    const matchId = String(formData.get("pickMatchId"));
    const leagueId = String(formData.get("pickLeagueId") ?? "");
    const user = users.find((item) => item.id === userId);
    const match = matches.find((item) => item.id === matchId);

    if (!user || !match) {
      setMessage("Selecciona usuario y partido");
      return;
    }

    const confirmed = window.confirm(`Eliminar pick de ${user.name} para ${match.homeTeam} vs ${match.awayTeam}?`);
    if (!confirmed) return;

    const response = await fetch("/api/admin/predictions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        matchId,
        leagueId: leagueId || undefined,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo eliminar el pick");
      return;
    }

    setMessage(`Pick eliminado: ${data.deleted.user} - ${data.deleted.match}`);
    await loadUsers();
    if (leagueId) await loadRoomDashboard(leagueId);
    onChanged();
    event.currentTarget.reset();
  }

  async function updateUserStatus(userId: string, isActive: boolean) {
    setMessage("");
    const user = users.find((item) => item.id === userId);

    if (!user) {
      setMessage("Selecciona un usuario");
      return;
    }

    const response = await fetch(`/api/admin/users/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo actualizar el usuario");
      return;
    }

    setMessage(
      data.user.isActive
        ? `${data.user.name} ahora está activo`
        : `${data.user.name} ahora esta desactivado para guardar picks`,
    );
    await loadUsers();
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setPinDeliveryNote(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const initialPin = String(formData.get("newUserPassword") ?? "");

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("newUserName") ?? ""),
        phone: String(formData.get("newUserPhone") ?? ""),
        password: String(formData.get("newUserPassword") ?? ""),
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo crear el usuario");
      return;
    }

    setMessage(`${data.user.name} fue creado desactivado con PIN inicial. Entrega ese PIN de forma segura.`);
    setPinDeliveryNote({
      name: data.user.name,
      phone: data.user.phone,
      pin: initialPin,
      message: buildPinDeliveryMessage(data.user.name, data.user.phone, initialPin),
    });
    form.reset();
    await loadUsers();
  }

  async function resetUserPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setPinDeliveryNote(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const userId = String(formData.get("passwordUserId"));
    const user = users.find((item) => item.id === userId);
    const newPin = String(formData.get("userNewPassword") ?? "");

    if (!user) {
      setMessage("Selecciona un usuario");
      return;
    }

    const response = await fetch(`/api/admin/users/${userId}/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newPassword: String(formData.get("userNewPassword") ?? ""),
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo asignar el PIN del usuario");
      return;
    }

    setMessage(`PIN actualizado para ${data.user.name}. Entrega ese PIN al participante de forma segura.`);
    setPinDeliveryNote({
      name: data.user.name,
      phone: data.user.phone,
      pin: newPin,
      message: buildPinDeliveryMessage(data.user.name, data.user.phone, newPin),
    });
    form.reset();
    setSelectedPasswordUserId("");
    if (selectedRoom?.id) await loadRoomDashboard(selectedRoom.id);
  }

  async function editUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const userId = String(formData.get("editUserId"));

    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("editUserName") ?? ""),
        phone: String(formData.get("editUserPhone") ?? ""),
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo editar el usuario");
      return;
    }

    setMessage(`Usuario actualizado: ${data.user.name}`);
    form.reset();
    await loadUsers();
    if (selectedRoom?.id) await loadRoomDashboard(selectedRoom.id);
  }

  async function saveAdminPick(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (adminPickSaving) return;
    setMessage("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const leagueId = String(formData.get("adminPickLeagueId") ?? "");
    const payload = {
      userId: String(formData.get("adminPickUserId")),
      matchId: String(formData.get("adminPickMatchId")),
      homeScore: Number(formData.get("adminPickHomeScore")),
      awayScore: Number(formData.get("adminPickAwayScore")),
      leagueId: leagueId || undefined,
    };

    if (process.env.NODE_ENV !== "production") {
      console.info("admin-pick-save-payload", payload);
    }

    setAdminPickSaving(true);
    try {
      const response = await fetch("/api/admin/predictions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (process.env.NODE_ENV !== "production") {
        console.info("admin-pick-save-response", { ok: response.ok, status: response.status, data });
      }

      if (!response.ok) {
        setMessage(data.error ?? "No se pudo guardar el pick");
        return;
      }

      const savedHomeScore =
        typeof data.prediction?.homeScore === "number" ? data.prediction.homeScore : payload.homeScore;
      const savedAwayScore =
        typeof data.prediction?.awayScore === "number" ? data.prediction.awayScore : payload.awayScore;
      const savedMatch = typeof data.match === "string" ? data.match : "Partido";
      const savedMatchLabel = savedMatch.includes(" vs ")
        ? savedMatch.replace(" vs ", ` ${savedHomeScore} - ${savedAwayScore} `)
        : `${savedMatch} ${savedHomeScore} - ${savedAwayScore}`;
      const savedRoom = typeof data.room === "string" && data.room ? ` en ${data.room}` : "";

      setMessage(`Pick guardado: ${savedMatchLabel} para ${data.user ?? "participante"}${savedRoom}.`);
      form.reset();
      setAdminPickLeagueId("");
      setAdminPickMatches([]);
      await loadUsers();
      if (leagueId) await loadRoomDashboard(leagueId);
      onChanged();
    } finally {
      setAdminPickSaving(false);
    }
  }

  async function saveAdminPickPoints(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const leagueId = String(formData.get("adminPointsLeagueId") ?? "");

    const response = await fetch("/api/admin/predictions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: String(formData.get("adminPointsUserId")),
        matchId: String(formData.get("adminPointsMatchId")),
        points: Number(formData.get("adminManualPoints")),
        leagueId: leagueId || undefined,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudieron guardar los puntos");
      return;
    }

    setMessage(`Puntos manuales actualizados: ${data.user} - ${data.match}.`);
    form.reset();
    await loadUsers();
    if (leagueId) await loadRoomDashboard(leagueId);
    onChanged();
  }

  async function deleteUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const userId = String(formData.get("deleteUserId"));
    await deleteUserById(userId);
    event.currentTarget.reset();
  }

  async function deleteUserById(userId: string) {
    setMessage("");
    const user = users.find((item) => item.id === userId);

    if (!user) {
      setMessage("Selecciona un usuario");
      return;
    }

    const confirmed = window.confirm(`Eliminar usuario ${user.name} (${user.phone})? Tambien se borraran sus picks y ligas.`);
    if (!confirmed) return;

    const response = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo eliminar el usuario");
      return;
    }

    setMessage(`Usuario eliminado: ${data.user.name}`);
    await loadUsers();
    onChanged();
  }

  async function publishAll(publish: boolean) {
    setMessage("");
    const confirmed = window.confirm(
      publish ? "Publicar todos los partidos?" : "Ocultar todos los partidos para usuarios normales?",
    );
    if (!confirmed) return;

    const response = await fetch("/api/admin/matches/publish-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publish }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo actualizar la publicacion");
      return;
    }

    setMessage(`${publish ? "Publicados" : "Ocultados"} ${data.updated} partidos`);
    onChanged();
  }

  async function publishMatch(match: Match, publish: boolean) {
    setMessage("");

    const response = await fetch(`/api/admin/matches/${match.id}/publish`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publish }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo actualizar el partido");
      return;
    }

    setMessage(`${publish ? "Publicado" : "Ocultado"}: ${data.match.homeTeam} vs ${data.match.awayTeam}`);
    onChanged();
  }

  async function publishDay(date: string, publish: boolean) {
    setMessage("");
    const label = readableBogotaDate(date);
    const confirmed = window.confirm(
      publish ? `Publicar todos los partidos de ${label}?` : `Ocultar todos los partidos de ${label}?`,
    );
    if (!confirmed) return;

    const response = await fetch("/api/admin/matches/publish-day", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, publish }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo actualizar la fecha");
      return;
    }

    setMessage(`${publish ? "Publicados" : "Ocultados"} ${data.updated} partidos de ${label}`);
    onChanged();
  }

  async function closeMatch(match: Match) {
    setMessage("");

    if (match.homeScore === null || match.awayScore === null) {
      setMessage(`Primero carga marcador parcial para ${match.homeTeam} vs ${match.awayTeam}.`);
      return;
    }

    const confirmed = window.confirm(`Cerrar ${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}?`);
    if (!confirmed) return;

    const response = await fetch(`/api/admin/matches/${match.id}/result`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        isFinal: true,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo cerrar el partido");
      return;
    }

    setMessage(`Partido cerrado: ${data.match.homeTeam} ${data.match.homeScore}-${data.match.awayScore} ${data.match.awayTeam}`);
    onChanged();
  }

  return (
    <section className="panel">
      <div className="section-title admin-summary-heading">
        <div>
          <span className="market-kicker">Control general</span>
          <h2>Panel administrador</h2>
          <p>Control general de Mundial Picks 2026</p>
        </div>
        {adminView === "overview" ? (
          <button className="button admin-refresh-inline" onClick={updateResults} type="button">
            Sincronizar resultados
          </button>
        ) : null}
      </div>
      {message ? <div className="notice">{message}</div> : null}
      {pinDeliveryNote ? (
        <section className="admin-pin-delivery-card" aria-label="Mensaje de PIN listo para copiar">
          <div className="admin-pin-delivery-heading">
            <span className="market-kicker">PIN listo para entregar</span>
            <strong>{pinDeliveryNote.name}</strong>
            <span>WhatsApp {pinDeliveryNote.phone} · PIN {pinDeliveryNote.pin}</span>
          </div>
          <p>{pinDeliveryNote.message}</p>
          <div className="admin-pin-delivery-actions">
            <button className="button primary" onClick={copyPinDeliveryMessage} type="button">
              Copiar mensaje
            </button>
            <button className="button secondary" onClick={() => setPinDeliveryNote(null)} type="button">
              Ocultar
            </button>
          </div>
        </section>
      ) : null}
      <div className="admin-nav" aria-label="Secciones del administrador">
        <button
          className={`tab ${adminView === "overview" ? "active" : ""}`}
          onClick={() => setAdminView("overview")}
          type="button"
        >
          Resumen
        </button>
        <button
          className={`tab ${adminView === "rooms" ? "active" : ""}`}
          onClick={async () => {
            setAdminView("rooms");
            await loadRooms();
          }}
          type="button"
        >
          Salas
        </button>
        <button
          className={`tab ${adminView === "users" ? "active" : ""}`}
          onClick={async () => {
            setAdminView("users");
            await loadRooms();
            if (usersLoaded) await loadUsers();
          }}
          type="button"
        >
          Usuarios
        </button>
        <button
          className={`tab ${adminView === "matches" ? "active" : ""}`}
          onClick={() => setAdminView("matches")}
          type="button"
        >
          Ligas
        </button>
        <button
          className={`tab ${adminView === "tools" ? "active" : ""}`}
          onClick={() => setAdminView("tools")}
          type="button"
        >
          Herramientas
        </button>
      </div>
      <div className="grid two-columns">
        {adminView === "overview" ? (
          <div className="admin-summary">
            <section className="form admin-summary-section admin-summary-status">
              <span className="market-kicker">Estado general</span>
              <div className="admin-overview">
                <article>
                  <span>Partidos publicados</span>
                  <strong>
                    {publishedMatches}/{matches.length}
                  </strong>
                </article>
                <article>
                  <span>Marcadores cargados</span>
                  <strong>{resultLoadedMatches}</strong>
                </article>
                <article>
                  <span>Usuarios activos</span>
                  <strong>{usersLoaded ? activeUsers : "-"}</strong>
                </article>
                <article>
                  <span>Salas activas</span>
                  <strong>{roomSummary.activeRooms || "-"}</strong>
                </article>
              </div>
            </section>

            <div className="admin-summary-layout">
              <div className="admin-summary-main">
                <section className="form admin-summary-section admin-operational-card">
                  <div className="section-title">
                    <div>
                      <span className="market-kicker">Estado operativo</span>
                      <h3>{liveMatch ? "Partido en vivo" : nextScheduledMatch ? "Próximo partido" : "Operación estable"}</h3>
                    </div>
                  </div>
                  <div className="admin-operational-status">
                    {liveMatch ?? nextScheduledMatch ? (
                      <article>
                        <strong>{(liveMatch ?? nextScheduledMatch)?.homeTeam} vs {(liveMatch ?? nextScheduledMatch)?.awayTeam}</strong>
                        <span>
                          {matchStatusLabel((liveMatch ?? nextScheduledMatch)?.status ?? "SCHEDULED")}
                          {" · "}
                          {new Date((liveMatch ?? nextScheduledMatch)?.startsAt ?? Date.now()).toLocaleString("es-CO", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      </article>
                    ) : (
                      <p>Sin alertas operativas por ahora.</p>
                    )}
                    <article>
                      <strong>{matchesWithScoreNotClosed.length}</strong>
                      <span>partidos pendientes por cerrar</span>
                    </article>
                  </div>
                </section>

              </div>

              <aside className="admin-summary-side">
                <section className="form admin-guide admin-guide-compact">
                  <span className="market-kicker">Guía rápida</span>
                  <ol>
                    <li>Revisa alertas globales.</li>
                    <li>Entra a la sala que vas a operar.</li>
                    <li>Usa Sincronizar resultados solo cuando necesites traer marcadores.</li>
                    <li>Corrige solo la sala afectada.</li>
                  </ol>
                </section>

                <section className="form admin-alert-card">
                  <div>
                    <span className="market-kicker">Revisión urgente</span>
                    <h3>Alertas</h3>
                  </div>
                  {matchesWithScoreNotClosed.length ? (
                    <div className="admin-alert-list">
                      {matchesWithScoreNotClosed.slice(0, 4).map((match) => (
                        <article key={match.id}>
                          <div>
                            <strong>{match.homeTeam} vs {match.awayTeam}</strong>
                            <span>{match.homeScore}-{match.awayScore} · {matchStatusLabel(match.status)}</span>
                          </div>
                        </article>
                      ))}
                      {matchesWithScoreNotClosed.length > 4 ? (
                        <small>+{matchesWithScoreNotClosed.length - 4} partido(s) pendientes de revisar.</small>
                      ) : null}
                    </div>
                  ) : (
                    <p className="admin-alert-empty">Sin alertas pendientes.</p>
                  )}
                </section>

                <section className="form admin-secondary-metrics">
                  <article>
                    <span>Salas vencidas</span>
                    <strong>{roomSummary.expiredRooms}</strong>
                  </article>
                  <article>
                    <span>Ingresos por salas</span>
                    <strong>
                      {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(roomSummary.incomeInCents / 100)}
                    </strong>
                  </article>
                </section>
              </aside>
            </div>
          </div>
        ) : null}
        {adminView === "matches" ? (
          <>
            <section className="form league-hub admin-room-section-wide">
              <div className="section-title">
                <div>
                  <span className="market-kicker">Biblioteca base</span>
                  <h3>Ligas disponibles para las salas</h3>
                  <p className="muted">
                    El super usuario administra aquí las ligas base. Cada sala copia su propio calendario desde una liga y luego publica sus partidos sin afectar a las demás.
                  </p>
                </div>
                <button className="button primary" onClick={importWorldCupCalendar} type="button">
                  Importar Mundial 2026
                </button>
              </div>
              <div className="competition-compact-grid">
                {competitions.map((competition) => (
                  <article className="competition-compact-card" key={competition.id}>
                    <div>
                      <strong>{competition.name}</strong>
                      <span>{competition.season}</span>
                    </div>
                    <small>Disponible para salas</small>
                  </article>
                ))}
                {!competitions.length ? <div className="empty">Todavía no hay ligas base cargadas.</div> : null}
              </div>
            </section>

            <details className="admin-room-section admin-room-section-wide admin-advanced-calendar">
              <summary>Calendario base avanzado</summary>
              <div className="grid two-columns admin-advanced-calendar-grid">
            <section className="form publish-manager">
              <div className="section-title publish-manager-title">
                <div>
                  <span className="market-kicker">Control de calendario</span>
                  <h3>Calendario base</h3>
                </div>
                <span className="muted">
                  {publishedMatches}/{matches.length} publicados
                </span>
              </div>
              <div className="publish-day-list">
                {selectedPublishDay ? (
                  <section className="publish-console">
                    <div className="publish-console-top">
                      <div className="form-row publish-date-select">
                        <label htmlFor="publish-date">Día que vas a publicar</label>
                        <select
                          id="publish-date"
                          onChange={(event) => setSelectedPublishDate(event.target.value)}
                          value={selectedPublishDay.date}
                        >
                          {matchDays.map((day) => (
                            <option key={day.date} value={day.date}>
                              {day.label} · {day.published}/{day.matches.length}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="publish-status-grid">
                        <div>
                          <span>Fecha</span>
                          <strong>{selectedPublishDay.date}</strong>
                        </div>
                        <div>
                          <span>Publicado</span>
                          <strong>{selectedPublishDay.published}</strong>
                        </div>
                        <div>
                          <span>Oculto</span>
                          <strong>{selectedHiddenMatches}</strong>
                        </div>
                      </div>
                    </div>
                    <div className="publish-quick-actions">
                      {todayPublishDay ? (
                        <button
                          className="button secondary"
                          disabled={selectedPublishDay.date === todayPublishDay.date}
                          onClick={() => setSelectedPublishDate(todayPublishDay.date)}
                          type="button"
                        >
                          Ir a hoy
                        </button>
                      ) : null}
                      {nextPendingPublishDay ? (
                        <button
                          className="button secondary"
                          disabled={selectedPublishDay.date === nextPendingPublishDay.date}
                          onClick={() => setSelectedPublishDate(nextPendingPublishDay.date)}
                          type="button"
                        >
                          Próxima pendiente
                        </button>
                      ) : null}
                      <button
                        className="button primary"
                        disabled={selectedPublishDay.published === selectedPublishDay.matches.length}
                        onClick={() => publishDay(selectedPublishDay.date, true)}
                        type="button"
                      >
                        Publicar esta fecha
                      </button>
                      <button
                        className="button secondary"
                        disabled={selectedPublishDay.published === 0}
                        onClick={() => publishDay(selectedPublishDay.date, false)}
                        type="button"
                      >
                        Ocultar esta fecha
                      </button>
                      <button
                        className="button danger"
                        disabled={publishedMatches === 0}
                        onClick={() => publishAll(false)}
                        type="button"
                      >
                        Ocultar todo
                      </button>
                    </div>
                    <div className="publish-day-strip" aria-label="Fechas del calendario">
                      {matchDays.map((day) => {
                        const hidden = day.matches.length - day.published;
                        return (
                          <button
                            className={`publish-day-chip ${day.date === selectedPublishDay.date ? "active" : ""}`}
                            key={day.date}
                            onClick={() => setSelectedPublishDate(day.date)}
                            type="button"
                          >
                            <strong>{new Date(`${day.date}T12:00:00-05:00`).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}</strong>
                            <span>{hidden === 0 ? "Completa" : `${hidden} ocultos`}</span>
                          </button>
                        );
                      })}
                    </div>
                    <details className="publish-global-actions">
                      <summary>Acciones globales</summary>
                      <div>
                        <button className="button secondary" type="button" onClick={() => publishAll(false)}>
                          Ocultar todos los partidos
                        </button>
                        <button className="button secondary" type="button" onClick={() => publishAll(true)}>
                          Publicar todos los partidos
                        </button>
                      </div>
                    </details>
                    <div className="publish-list compact">
                      {selectedPublishDay.matches.map((match) => {
                        const hasScore = match.homeScore !== null && match.awayScore !== null;
                        const canCloseMatch = hasScore && match.status !== "FINISHED";

                        return (
                          <article className={`publish-card ${match.isPublished ? "published" : ""}`} key={match.id}>
                            <div className="publish-match-main">
                              <div className="publish-time">
                                {new Date(match.startsAt).toLocaleTimeString("es-CO", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: "America/Bogota",
                                })}
                              </div>
                              <div className="publish-teams">
                                <span>
                                  <strong>{flagForTeam(match.homeTeam)}</strong>
                                  {match.homeTeam}
                                </span>
                                <small>vs</small>
                                <span>
                                  <strong>{flagForTeam(match.awayTeam)}</strong>
                                  {match.awayTeam}
                                </span>
                              </div>
                            </div>
                            <div className="publish-meta">
                              {match.group ? <span>{match.group}</span> : null}
                              <span>{hasScore ? `${match.homeScore}-${match.awayScore}` : "Sin marcador"}</span>
                              <strong className={match.isPublished ? "status-live" : "status-hidden"}>
                                {match.isPublished ? "Publicado" : "Oculto"}
                              </strong>
                            </div>
                            <div className="publish-actions">
                              {match.isPublished ? (
                                <button
                                  className="button secondary"
                                  onClick={() => publishMatch(match, false)}
                                  type="button"
                                >
                                  Ocultar
                                </button>
                              ) : (
                                <button
                                  className="button primary"
                                  onClick={() => publishMatch(match, true)}
                                  type="button"
                                >
                                  Publicar
                                </button>
                              )}
                              <button
                                className="button danger"
                                disabled={!canCloseMatch}
                                onClick={() => closeMatch(match)}
                                type="button"
                              >
                                {match.status === "FINISHED" ? "Cerrado" : hasScore ? "Cerrar" : "Sin marcador"}
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ) : null}
                {!matchDays.length ? <div className="empty">Todavía no hay partidos cargados.</div> : null}
              </div>
            </section>
            <form className="form" onSubmit={createMatch}>
              <h3>Crear partido</h3>
              <div className="inline-form">
                <div className="form-row">
                  <label htmlFor="homeTeam">Local</label>
                  <input id="homeTeam" name="homeTeam" required />
                </div>
                <div className="form-row">
                  <label htmlFor="awayTeam">Visitante</label>
                  <input id="awayTeam" name="awayTeam" required />
                </div>
                <button className="button primary" type="submit">
                  Crear
                </button>
              </div>
              <div className="inline-form">
                <div className="form-row">
                  <label htmlFor="group">Grupo</label>
                  <input id="group" name="group" />
                </div>
                <div className="form-row">
                  <label htmlFor="venue">Estadio</label>
                  <input id="venue" name="venue" />
                </div>
                <div className="form-row">
                  <label htmlFor="startsAt">Inicio</label>
                  <input id="startsAt" name="startsAt" type="datetime-local" required />
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="broadcastUrl">Enlace oficial de transmisión</label>
                <input id="broadcastUrl" name="broadcastUrl" placeholder="https://..." type="url" />
              </div>
            </form>
            <form className="form" onSubmit={saveBroadcastUrl}>
              <h3>Enlace de transmisión oficial</h3>
              <div className="form-row">
                <label htmlFor="broadcastMatchId">Partido</label>
                <select id="broadcastMatchId" name="broadcastMatchId" required>
                  <option value="">Selecciona partido</option>
                  {matches.map((match) => (
                    <option key={match.id} value={match.id}>
                      {match.homeTeam} vs {match.awayTeam} {match.broadcastUrl ? "(con enlace)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="broadcastUrlUpdate">URL oficial</label>
                <input id="broadcastUrlUpdate" name="broadcastUrl" placeholder="https://..." type="url" />
              </div>
              <button className="button primary" type="submit">
                Guardar enlace
              </button>
            </form>
            <form className="form" onSubmit={saveResult}>
              <h3>Actualizar marcador</h3>
              <div className="form-row">
                <label htmlFor="matchId">Partido</label>
                <select id="matchId" name="matchId" required>
                  {editableResultMatches.map((match) => (
                    <option key={match.id} value={match.id}>
                      {match.homeTeam} vs {match.awayTeam} {match.status === "FINISHED" ? "(cerrado)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="score-form">
                <div className="form-row">
                  <label htmlFor="resultHome">Local</label>
                  <input id="resultHome" name="homeScore" type="number" min={0} required />
                </div>
                <div className="form-row">
                  <label htmlFor="resultAway">Visitante</label>
                  <input id="resultAway" name="awayScore" type="number" min={0} required />
                </div>
              </div>
              <div className="inline-form">
                <button className="button primary" name="resultAction" type="submit" value="partial">
                  Actualizar parcial
                </button>
                <button className="button danger" name="resultAction" type="submit" value="final">
                  Cerrar partido
                </button>
              </div>
              <small className="muted">
                El super admin puede corregir marcadores de partidos abiertos o cerrados. El parcial reabre el partido en vivo; cerrar partido deja el resultado final.
              </small>
              {!editableResultMatches.length ? (
                <div className="empty">No hay partidos publicados para actualizar.</div>
              ) : null}
            </form>
            <form className="form" onSubmit={deleteMatch}>
              <h3>Eliminar partido</h3>
              <div className="form-row">
                <label htmlFor="deleteMatchId">Partido</label>
                <select id="deleteMatchId" name="deleteMatchId" required>
                  {matches.map((match) => (
                    <option key={match.id} value={match.id}>
                      {match.homeTeam} vs {match.awayTeam} {match.isPublished ? "" : "(oculto)"}
                    </option>
                  ))}
                </select>
              </div>
              <button className="button danger" type="submit">
                Eliminar partido
              </button>
            </form>
              </div>
            </details>
          </>
        ) : null}
        {adminView === "tools" ? (
          <section className="form admin-tools-hub admin-room-section-wide">
            <div className="section-title">
              <div>
                <span className="market-kicker">Herramientas</span>
                <h3>Mantenimiento técnico</h3>
                <p className="muted">
                  Acciones globales para actualizar resultados, recalcular datos y revisar integraciones. Para cambios de una sala específica, entra primero a Salas.
                </p>
              </div>
            </div>
            <div className="admin-action-grid admin-action-grid-tools admin-tools-grid">
              <button className="button admin-tool-button" onClick={() => recalculate()} type="button">
                Recalcular ranking
              </button>
              <button className="button admin-tool-button" onClick={syncAllRoomResults} type="button">
                Sincronizar salas
              </button>
              <button className="button admin-tool-button" onClick={importWorldCupCalendar} type="button">
                Importar calendario base
              </button>
              <button className="button admin-tool-button" onClick={testWhatsApp} type="button">
                Probar WhatsApp
              </button>
              <a className="button admin-tool-button" href="/api/admin/export" download>
                Descargar Excel global
              </a>
            </div>
            <div className="admin-tool-note">
              <strong>Acciones separadas, misma intención:</strong>
              <span>Sincronizar resultados trae marcadores; recalcular revisa puntos; sincronizar salas copia el estado correcto a cada sala.</span>
            </div>
          </section>
        ) : null}
        {adminView === "users" ? (
          <>
            <section className="form users-admin-list">
              <div className="section-title">
                <div>
                  <h3>Directorio de dueños de sala</h3>
                  <p className="muted">Ubica al responsable de cada sala y entra a administrarla sin duplicar participantes.</p>
                </div>
                <button className="button secondary" type="button" onClick={loadRooms}>
                  Actualizar directorio
                </button>
              </div>
              <div className="admin-owner-controls" aria-label="Filtros de dueños de sala">
                <div className="form-row">
                  <label htmlFor="adminOwnerSearch">Buscar sala o dueño</label>
                  <input
                    id="adminOwnerSearch"
                    onChange={(event) => setOwnerDirectorySearchTerm(event.target.value)}
                    placeholder="Buscar por sala, dueño o WhatsApp"
                    type="search"
                    value={ownerDirectorySearchTerm}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="adminOwnerRoomStatusFilter">Estado de sala</label>
                  <select
                    id="adminOwnerRoomStatusFilter"
                    onChange={(event) => setOwnerRoomStatusFilter(event.target.value as OwnerRoomStatusFilter)}
                    value={ownerRoomStatusFilter}
                  >
                    <option value="all">Todas</option>
                    <option value="active">Activas</option>
                    <option value="pending">Pendientes de pago</option>
                    <option value="closed">Cerradas o pausadas</option>
                  </select>
                </div>
                <span className="admin-owner-count">
                  Mostrando {visibleOwnerRooms.length} de {adminRooms.length} salas
                </span>
              </div>
              <div className="admin-user-list admin-owner-directory-list">
                {visibleOwnerRooms.map((room) => {
                  const memberCount = room.memberships.filter((membership) => membership.user.role !== "ADMIN").length;
                  const isActivated = isAdminRoomActivated(room);

                  return (
                    <article className={`admin-user-card admin-owner-room-card ${isActivated ? "active" : "inactive"}`} key={room.id}>
                      <div>
                        <strong>{room.name}</strong>
                        <span>Código: {room.inviteCode}</span>
                      </div>
                      <div>
                        <strong>{room.owner.name}</strong>
                        <span>WhatsApp: {room.owner.phone}</span>
                      </div>
                      <div className="admin-user-stats">
                        <span>
                          <strong>{memberCount}</strong>
                          Participantes
                        </span>
                        <span>
                          <strong>{room.maxParticipants}</strong>
                          Cupo
                        </span>
                      </div>
                      <div className="admin-user-badges">
                        <span>{roomStatusLabel(room.status)}</span>
                        <span>{adminRoomPaymentLabel(room)}</span>
                        {room.plan ? <span>{room.plan.name}</span> : null}
                      </div>
                      <div className="admin-user-actions">
                        <button className="button primary" onClick={() => void selectAdminRoom(room.id)} type="button">
                          Administrar sala
                        </button>
                      </div>
                    </article>
                  );
                })}
                {!visibleOwnerRooms.length ? <div className="empty">No hay salas con esos filtros.</div> : null}
              </div>
            </section>
            <section className="admin-users-group" aria-labelledby="admin-access-support-title">
              <div className="admin-users-group-heading">
                <span className="market-kicker">Soporte de acceso</span>
                <h3 id="admin-access-support-title">Usuarios y PIN</h3>
                <p className="muted">Acciones globales para crear usuarios, corregir datos y entregar acceso.</p>
              </div>
              <div className="admin-users-group-grid">
                <form className="form" onSubmit={createUser}>
                  <h3>Crear usuario</h3>
                  <div className="form-row">
                    <label htmlFor="newUserName">Nombre o apodo</label>
                    <input id="newUserName" name="newUserName" minLength={2} placeholder="Nombre del participante" required />
                  </div>
                  <div className="form-row">
                    <label htmlFor="newUserPhone">WhatsApp</label>
                    <input
                      id="newUserPhone"
                      inputMode="tel"
                      maxLength={18}
                      name="newUserPhone"
                      pattern="(\+57[ \-]?)?3[0-9 \-]{9,13}"
                      placeholder="300 000 0000"
                      required
                      title="Ingresa un celular colombiano valido. Ejemplo: 300 000 0000"
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor="newUserPassword">PIN inicial de 4 números</label>
                    <input
                      id="newUserPassword"
                      inputMode="numeric"
                      maxLength={4}
                      name="newUserPassword"
                      pattern="\d{4}"
                      required
                      title="El PIN debe tener exactamente 4 números"
                      type="password"
                    />
                  </div>
                  <button className="button primary" type="submit">
                    Crear usuario desactivado
                  </button>
                </form>
                <form className="form" onSubmit={editUser}>
                  <h3>Editar usuario</h3>
                  <div className="form-row">
                    <label htmlFor="editUserId">Usuario</label>
                    <select id="editUserId" name="editUserId" onFocus={() => !usersLoaded && loadUsers()} required>
                      <option value="">Selecciona usuario</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>{user.name} - {user.phone}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <label htmlFor="editUserName">Nuevo nombre o apodo</label>
                    <input id="editUserName" name="editUserName" minLength={2} required />
                  </div>
                  <div className="form-row">
                    <label htmlFor="editUserPhone">Nuevo WhatsApp</label>
                    <input id="editUserPhone" inputMode="tel" name="editUserPhone" placeholder="300 000 0000" required />
                  </div>
                  <button className="button primary" type="submit">Guardar usuario</button>
                </form>
                <form className="form" onSubmit={resetUserPassword}>
                  <h3>Asignar nuevo PIN de usuario</h3>
                  <div className="form-row">
                    <label htmlFor="passwordUserId">Usuario</label>
                    <select
                      id="passwordUserId"
                      name="passwordUserId"
                      onChange={(event) => setSelectedPasswordUserId(event.target.value)}
                      onFocus={() => !usersLoaded && loadUsers()}
                      required
                      value={selectedPasswordUserId}
                    >
                      <option value="">Selecciona usuario</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} - {user.phone}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <label htmlFor="userNewPassword">Nuevo PIN de 4 números</label>
                    <input
                      id="userNewPassword"
                      inputMode="numeric"
                      maxLength={4}
                      name="userNewPassword"
                      pattern="\d{4}"
                      required
                      title="El PIN debe tener exactamente 4 números"
                      type="password"
                    />
                  </div>
                  <button className="button primary" type="submit">
                    Guardar PIN
                  </button>
                  {!usersLoaded ? (
                    <button className="button secondary" type="button" onClick={loadUsers}>
                      Cargar usuarios
                    </button>
                  ) : null}
                </form>
              </div>
            </section>
            <section className="admin-users-group admin-users-advanced" aria-labelledby="admin-advanced-picks-title">
              <details className="admin-users-details">
                <summary>
                  <span>
                    <span className="market-kicker">Avanzado</span>
                    <strong id="admin-advanced-picks-title">Picks administrativos avanzados</strong>
                  </span>
                  <span className="muted">Usar solo para correcciones puntuales</span>
                </summary>
                <div className="admin-users-group-grid">
                  <form className="form" onSubmit={saveAdminPick}>
                    <h3>Crear o editar pick de participante</h3>
                    <p className="muted">
                      Solo el super admin puede modificar picks aunque el partido ya esté cerrado.
                      Los puntos se calculan automáticamente si el partido ya tiene marcador.
                    </p>
                    <div className="form-row">
                      <label htmlFor="adminPickLeagueId">Sala</label>
                      <select
                        id="adminPickLeagueId"
                        name="adminPickLeagueId"
                        onChange={(event) => {
                          void loadAdminPickMatches(event.target.value);
                        }}
                        required
                        value={adminPickLeagueId}
                      >
                        <option value="">Selecciona sala</option>
                        {adminRooms.map((room) => (
                          <option key={room.id} value={room.id}>
                            {room.name} · {room.inviteCode}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-row">
                      <label htmlFor="adminPickUserId">Usuario</label>
                      <select id="adminPickUserId" name="adminPickUserId" onFocus={() => !usersLoaded && loadUsers()} required>
                        <option value="">Selecciona usuario</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>{user.name} - {user.phone}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-row">
                      <label htmlFor="adminPickMatchId">Partido</label>
                      <select id="adminPickMatchId" name="adminPickMatchId" disabled={!adminPickLeagueId || adminPickMatchesLoading} required>
                        <option value="">
                          {adminPickMatchesLoading
                            ? "Cargando partidos de la sala..."
                            : adminPickLeagueId
                              ? "Selecciona partido de esta sala"
                              : "Selecciona sala primero"}
                        </option>
                        {adminPickMatches.map((match) => (
                          <option key={match.id} value={match.id}>
                            {formatAdminMatchOption(match)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="score-form">
                      <div className="form-row">
                        <label htmlFor="adminPickHomeScore">Local</label>
                        <input id="adminPickHomeScore" name="adminPickHomeScore" type="number" min={0} required />
                      </div>
                      <div className="form-row">
                        <label htmlFor="adminPickAwayScore">Visitante</label>
                        <input id="adminPickAwayScore" name="adminPickAwayScore" type="number" min={0} required />
                      </div>
                      <div className="form-row">
                        <span className="muted">Los puntos manuales se editan abajo, separados del pick.</span>
                      </div>
                    </div>
                    <button className="button primary" disabled={adminPickSaving} type="submit">
                      {adminPickSaving ? "Guardando..." : "Guardar pick"}
                    </button>
                  </form>
                  <form className="form" onSubmit={saveAdminPickPoints}>
                    <h3>Ajustar puntos manuales</h3>
                    <p className="muted">
                      Usa esto solo para corregir puntos de un pick existente. Estos puntos se respetan al recalcular.
                    </p>
                    <div className="form-row">
                      <label htmlFor="adminPointsUserId">Usuario</label>
                      <select id="adminPointsUserId" name="adminPointsUserId" onFocus={() => !usersLoaded && loadUsers()} required>
                        <option value="">Selecciona usuario</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>{user.name} - {user.phone}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-row">
                      <label htmlFor="adminPointsMatchId">Partido</label>
                      <select id="adminPointsMatchId" name="adminPointsMatchId" required>
                        <option value="">Selecciona partido</option>
                        {matches.map((match) => (
                          <option key={match.id} value={match.id}>
                            {match.homeTeam} vs {match.awayTeam} · {matchStatusLabel(match.status)}
                            {match.isPublished ? "" : " · oculto"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-row">
                      <label htmlFor="adminManualPoints">Puntos manuales</label>
                      <input id="adminManualPoints" name="adminManualPoints" type="number" min={0} max={100} required />
                    </div>
                    <button className="button primary" type="submit">Guardar puntos</button>
                  </form>
                </div>
              </details>
            </section>
            <section className="admin-users-group admin-users-danger" aria-labelledby="admin-danger-zone-title">
              <details className="admin-users-details">
                <summary>
                  <span>
                    <span className="market-kicker">Zona peligrosa</span>
                    <strong id="admin-danger-zone-title">Eliminaciones</strong>
                  </span>
                  <span className="muted">Acciones irreversibles o delicadas</span>
                </summary>
                <div className="admin-users-group-grid">
                  <form className="form" onSubmit={deletePick}>
                    <h3>Eliminar pick</h3>
                    <div className="form-row">
                      <label htmlFor="pickUserId">Usuario</label>
                      <select id="pickUserId" name="pickUserId" onFocus={() => !usersLoaded && loadUsers()} required>
                        <option value="">Selecciona usuario</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} - {user.phone}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-row">
                      <label htmlFor="pickMatchId">Partido</label>
                      <select id="pickMatchId" name="pickMatchId" required>
                        <option value="">Selecciona partido</option>
                        {matches.map((match) => (
                          <option key={match.id} value={match.id}>
                            {match.homeTeam} vs {match.awayTeam} {match.isPublished ? "" : "(oculto)"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button className="button danger" type="submit">
                      Eliminar pick
                    </button>
                    {!usersLoaded ? (
                      <button className="button secondary" type="button" onClick={loadUsers}>
                        Cargar usuarios
                      </button>
                    ) : null}
                  </form>
                  <form className="form" onSubmit={deleteUser}>
                    <h3>Eliminar usuario</h3>
                    <div className="form-row">
                      <label htmlFor="deleteUserId">Usuario</label>
                      <select id="deleteUserId" name="deleteUserId" onFocus={() => !usersLoaded && loadUsers()} required>
                        <option value="">Selecciona usuario</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name} - {user.phone} - {user.role}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button className="button danger" type="submit">
                      Eliminar usuario
                    </button>
                    {!usersLoaded ? (
                      <button className="button secondary" type="button" onClick={loadUsers}>
                        Cargar usuarios
                      </button>
                    ) : null}
                  </form>
                </div>
              </details>
            </section>
          </>
        ) : null}
        {adminView === "rooms" ? (
          <>
            <section className="form admin-rooms-workspace">
              <div className="section-title admin-rooms-title">
                <div>
                  <h3>Gestión de salas</h3>
                  <p className="muted">Selecciona una sala para administrarla.</p>
                </div>
                <a className="button secondary compact-button" href="#crear-activar-salas">
                  Crear sala / Activar sala
                </a>
              </div>

              <section className="admin-room-card-list" aria-label="Salas disponibles">
                {adminRooms.length ? (
                  adminRooms.map((room) => {
                    const isSelected = selectedRoom?.id === room.id;
                    const memberCount = room.memberships.length;

                    return (
                      <article className={`admin-room-list-card ${isSelected ? "active" : ""}`} key={room.id}>
                        <div className="admin-room-list-main">
                          <span className="market-kicker">{roomStatusLabel(room.status)}</span>
                          <strong>{room.name}</strong>
                          <small>Código {room.inviteCode}</small>
                        </div>
                        <div className="admin-room-list-meta">
                          <span><small>Participantes</small><strong>{memberCount}/{room.maxParticipants}</strong></span>
                          <span><small>Plan</small><strong>{room.plan?.name ?? "Personalizado"}</strong></span>
                          <span><small>Vence</small><strong>{room.expiresAt ? new Date(room.expiresAt).toLocaleDateString("es") : "Sin fecha"}</strong></span>
                        </div>
                        <button
                          className={`button ${isSelected ? "secondary" : "primary"} compact-button`}
                          onClick={() => {
                            void selectAdminRoom(room.id);
                          }}
                          type="button"
                        >
                          {isSelected ? "Administrando" : "Administrar"}
                        </button>
                      </article>
                    );
                  })
                ) : (
                  <div className="empty room-empty-state">
                    <strong>No hay salas disponibles.</strong>
                    <a className="button secondary compact-button" href="#crear-activar-salas">Crear o activar sala</a>
                  </div>
                )}
              </section>

              {selectedRoom ? (
                <>
	                  <section className="selected-room-card admin-room-shell compact-selected-room">
	                    <div className="selected-room-main">
	                      <div>
	                        <span className="market-kicker">Sala seleccionada</span>
	                        <strong>{selectedRoom.name}</strong>
	                        <small>{selectedRoom.competition?.name ?? "Sin calendario base"} · Propietario: {selectedRoom.owner.name}</small>
	                      </div>
	                    </div>
	                    <div className="selected-room-metrics">
	                      <span><small>Código</small><strong>{selectedRoom.inviteCode}</strong></span>
	                      <span><small>Estado</small><strong>{roomStatusLabel(selectedRoom.status)}</strong></span>
	                      <span><small>Participantes</small><strong>{selectedRoomMemberships.length}/{selectedRoom.maxParticipants}</strong></span>
	                      <span><small>Publicados</small><strong>{roomDashboard?.matches.filter((match) => match.isPublished).length ?? "-"}</strong></span>
	                      <span><small>Plan</small><strong>{selectedRoom.plan?.name ?? "Personalizado"}</strong></span>
	                      <span><small>Vence</small><strong>{selectedRoom.expiresAt ? new Date(selectedRoom.expiresAt).toLocaleDateString("es") : "Sin fecha"}</strong></span>
	                    </div>
	                  </section>

	                  <div className="admin-room-action-layout compact-room-actions">
	                    <section className="form admin-room-action-card primary-room-actions">
	                      <div>
	                        <span className="market-kicker">Acciones de sala</span>
	                        <h4>Opera la sala seleccionada sin mezclarla con otras salas.</h4>
	                      </div>
	                      <div className="admin-room-action-grid compact-actions-grid">
	                        <button className="button primary" onClick={() => syncSelectedRoomResults(selectedRoom)} type="button">
	                          Sincronizar resultados de sala
	                        </button>
	                        <button className="button secondary" onClick={() => copyRoomInvitation(selectedRoom)} type="button">
	                          Copiar invitación
	                        </button>
	                      </div>
	                    </section>

	                    <details className="admin-room-accordion admin-room-options-panel">
	                      <summary>Más opciones de administración</summary>
	                      <div className="admin-room-secondary-actions">
	                        <button
	                          className="button secondary"
	                          onClick={() => document.getElementById("selectedRoomUserId")?.focus()}
	                          type="button"
	                        >
	                          Ver participantes
	                        </button>
	                        <a className="button secondary" href="/api/admin/export" download>
	                          Descargar Excel global
	                        </a>
	                      </div>
	                      <details className="admin-room-accordion nested-admin-option">
	                        <summary>Editar sala</summary>
	                        <form className="form" onSubmit={updateRoomSettings}>
	                          <input name="settingsRoomId" type="hidden" value={selectedRoom.id} />
	                          <div className="form-row">
                            <label htmlFor="selectedSettingsRoomName">Nombre de la sala</label>
                            <input
                              id="selectedSettingsRoomName"
                              key={`${selectedRoom.id}-name`}
                              name="settingsRoomName"
                              defaultValue={selectedRoom.name}
                              minLength={3}
                              maxLength={80}
                              required
                            />
                          </div>
                          <div className="form-row">
                            <label htmlFor="selectedSettingsOwnerId">Propietario</label>
                            <select
                              id="selectedSettingsOwnerId"
                              key={`${selectedRoom.id}-owner`}
                              name="settingsOwnerId"
                              defaultValue={selectedRoom.ownerId}
                            >
                              {users.filter((item) => item.role === "USER").map((item) => (
                                <option key={item.id} value={item.id}>{item.name} - {item.phone}</option>
                              ))}
                            </select>
                          </div>
                          <div className="inline-form">
                            <div className="form-row">
                              <label htmlFor="selectedSettingsStatus">Estado</label>
                              <select
                                id="selectedSettingsStatus"
                                key={`${selectedRoom.id}-status`}
                                name="settingsStatus"
                                defaultValue={selectedRoom.status}
                              >
                                <option value="ACTIVE">Activa</option>
                                <option value="SUSPENDED">Suspendida</option>
                                <option value="EXPIRED">Vencida</option>
                                <option value="CLOSED">Cerrada</option>
                              </select>
                            </div>
                            <div className="form-row">
                              <label htmlFor="selectedSettingsMaxParticipants">Límite</label>
                              <input
                                id="selectedSettingsMaxParticipants"
                                key={`${selectedRoom.id}-limit`}
                                name="settingsMaxParticipants"
                                type="number"
                                min={2}
                                max={10000}
                                defaultValue={selectedRoom.maxParticipants}
                                required
                              />
                            </div>
                            <div className="form-row">
                              <label htmlFor="selectedSettingsExpiresAt">Vencimiento</label>
                              <input
                                id="selectedSettingsExpiresAt"
                                key={`${selectedRoom.id}-expires`}
                                name="settingsExpiresAt"
                                type="datetime-local"
                                defaultValue={datetimeLocalValue(selectedRoom.expiresAt)}
                              />
                            </div>
	                          </div>
	                          <button className="button primary" type="submit">Guardar sala</button>
	                        </form>
	                      </details>
	                      <details className="admin-room-accordion nested-admin-option">
	                        <summary>Asignar administrador de sala</summary>
	                        <form className="form" onSubmit={updateRoomAdmin}>
	                          <input name="adminRoomId" type="hidden" value={selectedRoom.id} />
                          <div className="form-row">
                            <label htmlFor="selectedRoomAdminUserId">Participante</label>
                            <select id="selectedRoomAdminUserId" name="roomAdminUserId" required>
                              <option value="">Selecciona participante</option>
                              {selectedRoomMemberships.map((membership) => (
                                <option key={membership.user.id} value={membership.user.id}>
                                  {membership.user.name} · {membership.role === "ADMIN" ? "Admin actual" : "Participante"}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="form-row">
                            <label htmlFor="selectedRoomRole">Rol</label>
                            <select id="selectedRoomRole" name="roomRole" defaultValue="ADMIN" required>
                              <option value="ADMIN">Administrador de sala</option>
                              <option value="MEMBER">Participante</option>
                            </select>
                          </div>
	                          <button className="button primary" type="submit">Guardar rol</button>
	                        </form>
	                      </details>
	                    </details>

	                    <details className="admin-room-accordion admin-room-danger-zone">
	                      <summary>Zona peligrosa</summary>
	                      <p className="muted">Eliminar una sala es una acción definitiva. Úsala solo cuando estés seguro.</p>
	                      <button className="button danger" onClick={() => deleteAdminRoom(selectedRoom)} type="button">
	                        Eliminar sala
	                      </button>
	                    </details>
	                  </div>

                  <section className="admin-room-live-panel">
                    <LeaguePanel user={user} initialLeagueId={selectedRoom.id} embedded refreshRequest={refreshRequest} />
                  </section>

                  <section className="admin-room-dashboard compact admin-room-operator-tools">
                    <div className="room-dashboard-bar">
                      <span className="market-kicker">Gestión interna de participantes</span>
                      {roomDashboardLoading ? <span className="user-chip">Cargando...</span> : null}
                    </div>
                    {roomDashboard ? (
                      <section className="admin-room-user-tools compact">
                        <div className="room-control-bar participant-control">
                          <div className="room-control-field">
                            <span className="market-kicker">Participante de la sala</span>
                            <label htmlFor="selectedRoomUserId">Usuario seleccionado</label>
                            <select
                              id="selectedRoomUserId"
                              onChange={(event) => setSelectedRoomUserId(event.target.value)}
                              value={selectedRoomUserId}
                            >
                              <option value="">Selecciona participante</option>
                              {roomDashboard.participants.map((participant) => (
                                <option key={participant.id} value={participant.id}>
                                  {participant.name} · {participant.phone} · {participant.role === "ADMIN" ? "Admin sala" : "Participante"}
                                </option>
                              ))}
                            </select>
                          </div>
                          {selectedRoomParticipant ? (
                            <span className="user-chip">
                              {selectedRoomParticipant.role === "ADMIN" ? "Admin sala" : "Participante"} · {selectedRoomParticipant.isActive ? "Activo" : "Inactivo"}
                            </span>
                          ) : null}
                        </div>
                        {selectedRoomParticipant ? (
                          <div className="admin-room-user-card">
                            <div className="admin-room-user-header">
                              <div>
                                <strong>{selectedRoomParticipant.name}</strong>
                                <span>{selectedRoomParticipant.phone}</span>
                              </div>
                              <div className="admin-user-badges">
                                <span>{selectedRoomParticipant.isActive ? "Activo" : "Inactivo"}</span>
                                <span>{selectedRoomParticipant.role === "ADMIN" ? "Admin sala" : "Participante"}</span>
                              </div>
                            </div>
                            <div className="admin-room-summary compact">
                              <article><span>Puntos</span><strong>{selectedRoomRanking?.points ?? 0}</strong></article>
                              <article><span>Picks</span><strong>{selectedRoomRanking?.predictions ?? selectedRoomUserPredictions.length}</strong></article>
                              <article><span>Exactos</span><strong>{selectedRoomRanking?.exactScores ?? 0}</strong></article>
                            </div>
                            <details className="admin-room-accordion">
                              <summary>Acciones del participante seleccionado</summary>
                              <div className="admin-room-user-groups">
                                <section className="admin-room-user-action-group is-global">
                                  <div className="admin-room-user-action-heading">
                                    <span className="market-kicker">Acciones globales del usuario</span>
                                    <p>Estos cambios afectan el acceso del usuario completo, no solo esta sala.</p>
                                  </div>
                                  <div className="admin-room-user-forms">
                                    <form className="room-user-mini-form" onSubmit={editUser}>
                                      <input name="editUserId" type="hidden" value={selectedRoomParticipant.id} />
                                      <h4>Editar datos globales</h4>
                                      <div className="inline-form">
                                        <div className="form-row">
                                          <label htmlFor="roomUserEditName">Nombre o apodo</label>
                                          <input
                                            id="roomUserEditName"
                                            key={`${selectedRoomParticipant.id}-name`}
                                            name="editUserName"
                                            defaultValue={selectedRoomParticipant.name}
                                            minLength={2}
                                            required
                                          />
                                        </div>
                                        <div className="form-row">
                                          <label htmlFor="roomUserEditPhone">WhatsApp</label>
                                          <input
                                            id="roomUserEditPhone"
                                            key={`${selectedRoomParticipant.id}-phone`}
                                            name="editUserPhone"
                                            defaultValue={selectedRoomParticipant.phone}
                                            inputMode="tel"
                                            required
                                          />
                                        </div>
                                      </div>
                                      <button className="button primary" type="submit">Guardar datos</button>
                                    </form>

                                    <form className="room-user-mini-form" onSubmit={resetUserPassword}>
                                      <input name="passwordUserId" type="hidden" value={selectedRoomParticipant.id} />
                                      <h4>Asignar nuevo PIN</h4>
                                      <div className="form-row">
                                        <label htmlFor="roomUserNewPassword">Nuevo PIN de 4 números</label>
                                        <input
                                          id="roomUserNewPassword"
                                          inputMode="numeric"
                                          maxLength={4}
                                          name="userNewPassword"
                                          pattern="\d{4}"
                                          required
                                          title="El PIN debe tener exactamente 4 números"
                                          type="password"
                                        />
                                      </div>
                                      <button className="button primary" type="submit">Guardar PIN</button>
                                    </form>
                                  </div>
                                  <div className="admin-user-actions admin-user-actions-start">
                                    <button
                                      className="button secondary"
                                      disabled={selectedRoomParticipant.isActive}
                                      onClick={() => updateSelectedRoomParticipantStatus(true)}
                                      type="button"
                                    >
                                      Activar usuario global
                                    </button>
                                    <button
                                      className="button danger"
                                      disabled={!selectedRoomParticipant.isActive}
                                      onClick={() => updateSelectedRoomParticipantStatus(false)}
                                      type="button"
                                    >
                                      Desactivar usuario global
                                    </button>
                                  </div>
                                </section>

                                <section className="admin-room-user-action-group is-room">
                                  <div className="admin-room-user-action-heading">
                                    <span className="market-kicker">Acciones dentro de esta sala</span>
                                    <p>Estos cambios aplican al rol, participación y picks de la sala seleccionada.</p>
                                  </div>
                                  <div className="admin-user-actions admin-user-actions-start">
                                    <button
                                      className="button secondary"
                                      disabled={selectedRoomParticipant.role === "ADMIN"}
                                      onClick={() => updateSelectedRoomParticipantRole("ADMIN")}
                                      type="button"
                                    >
                                      Hacer admin de sala
                                    </button>
                                    <button
                                      className="button secondary"
                                      disabled={selectedRoomParticipant.role === "MEMBER"}
                                      onClick={() => updateSelectedRoomParticipantRole("MEMBER")}
                                      type="button"
                                    >
                                      Dejar participante
                                    </button>
                                    <button className="button danger" onClick={removeSelectedRoomParticipant} type="button">
                                      Retirar de sala
                                    </button>
                                  </div>
                                  <div className="admin-room-user-forms">
                                    <form className="room-user-mini-form" onSubmit={saveAdminPick}>
                                      <input name="adminPickUserId" type="hidden" value={selectedRoomParticipant.id} />
                                      <input name="adminPickLeagueId" type="hidden" value={selectedRoom.id} />
                                      <h4>Crear o editar pick en esta sala</h4>
                                      <div className="form-row">
                                        <label htmlFor="roomUserPickMatch">Partido</label>
                                        <select id="roomUserPickMatch" name="adminPickMatchId" required>
                                          <option value="">Selecciona partido</option>
                                          {roomDashboard.matches.map((match) => (
                                            <option key={match.id} value={match.id}>
                                              {formatAdminMatchOption(match)}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="score-form">
                                        <div className="form-row">
                                          <label htmlFor="roomUserPickHome">Local</label>
                                          <input id="roomUserPickHome" name="adminPickHomeScore" type="number" min={0} required />
                                        </div>
                                        <div className="form-row">
                                          <label htmlFor="roomUserPickAway">Visitante</label>
                                          <input id="roomUserPickAway" name="adminPickAwayScore" type="number" min={0} required />
                                        </div>
                                      </div>
                                      <button className="button primary" disabled={adminPickSaving} type="submit">
                                        {adminPickSaving ? "Guardando..." : "Guardar pick en sala"}
                                      </button>
                                    </form>

                                    <form className="room-user-mini-form" onSubmit={saveAdminPickPoints}>
                                      <input name="adminPointsUserId" type="hidden" value={selectedRoomParticipant.id} />
                                      <input name="adminPointsLeagueId" type="hidden" value={selectedRoom.id} />
                                      <h4>Ajustar puntos de esta sala</h4>
                                      <div className="inline-form">
                                        <div className="form-row">
                                          <label htmlFor="roomUserPointsMatch">Partido</label>
                                          <select id="roomUserPointsMatch" name="adminPointsMatchId" required>
                                            <option value="">Selecciona pick</option>
                                            {selectedRoomUserPredictions.map((prediction) => (
                                              <option key={prediction.id} value={prediction.match.id}>
                                                {prediction.match.homeTeam} vs {prediction.match.awayTeam} · actual {prediction.points} pts
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div className="form-row">
                                          <label htmlFor="roomUserManualPoints">Puntos</label>
                                          <input id="roomUserManualPoints" name="adminManualPoints" type="number" min={0} max={100} required />
                                        </div>
                                      </div>
                                      <button className="button primary" type="submit">Guardar puntos</button>
                                    </form>

                                    <form className="room-user-mini-form" onSubmit={deletePick}>
                                      <input name="pickUserId" type="hidden" value={selectedRoomParticipant.id} />
                                      <input name="pickLeagueId" type="hidden" value={selectedRoom.id} />
                                      <h4>Eliminar pick de esta sala</h4>
                                      <div className="form-row">
                                        <label htmlFor="roomUserDeletePick">Pick</label>
                                        <select id="roomUserDeletePick" name="pickMatchId" required>
                                          <option value="">Selecciona pick</option>
                                          {selectedRoomUserPredictions.map((prediction) => (
                                            <option key={prediction.id} value={prediction.match.id}>
                                              {prediction.match.homeTeam} vs {prediction.match.awayTeam} · {prediction.homeScore}-{prediction.awayScore}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <button className="button danger" type="submit">Eliminar pick</button>
                                    </form>
                                  </div>
                                </section>
                              </div>
                            </details>
                            <div className="admin-room-section">
                              <h3>Picks de este usuario en la sala</h3>
                              <div className="admin-room-list compact">
                                {selectedRoomUserPredictions.map((prediction) => (
                                  <article key={prediction.id}>
                                    <strong>{prediction.match.homeTeam} vs {prediction.match.awayTeam}</strong>
                                    <span>
                                      Pick {prediction.homeScore}-{prediction.awayScore} · {prediction.points} pts · {matchStatusLabel(prediction.match.status)}
                                    </span>
                                  </article>
                                ))}
                              </div>
                              {!selectedRoomUserPredictions.length ? <div className="empty">Este usuario todavía no tiene picks guardados en esta sala.</div> : null}
                            </div>
                          </div>
                        ) : (
                          <div className="empty">Selecciona un participante para ver su tablero dentro de esta sala.</div>
                        )}
                      </section>
                    ) : (
                      <div className="empty">Selecciona una sala para ver su tablero completo.</div>
                    )}
                  </section>
                </>
              ) : (
                null
              )}
            </section>

            <details className="admin-room-section admin-room-section-wide room-admin-utilities compact-create-room-panel" id="crear-activar-salas">
              <summary>Crear sala / Activar sala</summary>
              <div className="grid two-columns">
            <form className="form" onSubmit={createManualRoom}>
              <span className="market-kicker">Alta administrativa</span>
              <h3>Crear sala manualmente</h3>
              <div className="form-row">
                <label htmlFor="manualRoomName">Nombre de la sala</label>
                <input id="manualRoomName" name="manualRoomName" minLength={3} required />
              </div>
              <div className="form-row">
                <label htmlFor="manualOwnerId">Propietario</label>
                <select id="manualOwnerId" name="manualOwnerId" required>
                  <option value="">Selecciona usuario</option>
                  {users.filter((item) => item.role === "USER").map((item) => (
                    <option key={item.id} value={item.id}>{item.name} - {item.phone}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="manualCompetitionId">Calendario base</label>
                <select id="manualCompetitionId" name="manualCompetitionId" required>
                  <option value="">Selecciona calendario base</option>
                  {competitions.map((competition) => (
                    <option key={competition.id} value={competition.id}>{competition.name} · {competition.season}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="manualPlanId">Plan</label>
                <select id="manualPlanId" name="manualPlanId">
                  <option value="">Personalizado</option>
                  {roomPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
                </select>
              </div>
              <div className="inline-form">
                <div className="form-row">
                  <label htmlFor="manualMaxParticipants">Límite</label>
                  <input id="manualMaxParticipants" name="manualMaxParticipants" type="number" min={2} max={10000} defaultValue={20} required />
                </div>
                <div className="form-row">
                  <label htmlFor="manualExpiresAt">Vencimiento</label>
                  <input id="manualExpiresAt" name="manualExpiresAt" type="datetime-local" />
                </div>
                <div className="form-row">
                  <label htmlFor="manualPricePaidCop">Valor pagado COP</label>
                  <input id="manualPricePaidCop" name="manualPricePaidCop" type="number" min={0} step={1000} defaultValue={0} />
                </div>
              </div>
              <button className="button primary" type="submit">Crear y activar sala</button>
            </form>

            <form className="form" onSubmit={createTrialRoom}>
              <span className="market-kicker">Beneficio administrado</span>
              <h3>Generar prueba gratis</h3>
              <p className="muted">Crea una sala activa para máximo 10 participantes, sin cobro por Wompi.</p>
              <div className="form-row">
                <label htmlFor="trialRoomName">Nombre de la sala</label>
                <input id="trialRoomName" name="trialRoomName" minLength={3} placeholder="Prueba amigos" required />
              </div>
              <div className="form-row">
                <label htmlFor="trialOwnerId">Administrador de la sala</label>
                <select id="trialOwnerId" name="trialOwnerId" required>
                  <option value="">Selecciona usuario</option>
                  {users.filter((item) => item.role === "USER").map((item) => (
                    <option key={item.id} value={item.id}>{item.name} - {item.phone}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="trialCompetitionId">Calendario base</label>
                <select id="trialCompetitionId" name="trialCompetitionId" required>
                  <option value="">Selecciona calendario base</option>
                  {competitions.map((competition) => (
                    <option key={competition.id} value={competition.id}>{competition.name} · {competition.season}</option>
                  ))}
                </select>
              </div>
              <button className="button primary" type="submit">Crear prueba gratis de 10</button>
            </form>
              </div>
            </details>

          </>
        ) : null}
      </div>
    </section>
  );
}
