"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Competition, Match, RoomPlan } from "@/components/types";
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
    user: { id: string; name: string; phone: string };
  }>;
};

type RoomSummary = {
  total: number;
  activeRooms: number;
  expiredRooms: number;
  incomeInCents: number;
};

export function AdminPanel({ matches, onChanged }: Props) {
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [adminView, setAdminView] = useState<"overview" | "matches" | "users" | "rooms" | "security">("overview");
  const [selectedPasswordUserId, setSelectedPasswordUserId] = useState("");
  const [adminRooms, setAdminRooms] = useState<AdminRoom[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [roomPlans, setRoomPlans] = useState<RoomPlan[]>([]);
  const [roomSummary, setRoomSummary] = useState<RoomSummary>({ total: 0, activeRooms: 0, expiredRooms: 0, incomeInCents: 0 });
  const [selectedAdminRoomId, setSelectedAdminRoomId] = useState("");
  const [selectedSettingsRoomId, setSelectedSettingsRoomId] = useState("");
  const publishedMatches = matches.filter((match) => match.isPublished).length;
  const resultLoadedMatches = matches.filter((match) => match.homeScore !== null && match.awayScore !== null).length;
  const activeUsers = users.filter((user) => user.isActive).length;
  const publishedOpenMatches = matches.filter((match) => match.isPublished && match.status !== "FINISHED");
  const playedPublishedMatches = matches
    .filter((match) => match.isPublished && new Date(match.startsAt) <= new Date())
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

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

    setAdminRooms(roomsData.rooms ?? []);
    setRoomSummary(roomsData.summary ?? { total: 0, activeRooms: 0, expiredRooms: 0, incomeInCents: 0 });
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

  useEffect(() => {
    loadRooms();
  }, []);

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
  }

  async function deleteAdminRoom(room: AdminRoom) {
    if (!window.confirm(`¿Eliminar definitivamente la sala "${room.name}"?`)) return;
    const response = await fetch(`/api/leagues/${room.id}`, { method: "DELETE" });
    const data = await response.json();
    setMessage(response.ok ? `Sala eliminada: ${room.name}` : data.error ?? "No se pudo eliminar la sala");
    if (response.ok) await loadRooms();
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

    setMessage(
      isFinal
        ? "Resultado final guardado y puntos recalculados"
        : "Marcador parcial guardado y puntos actualizados en vivo.",
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

  async function recalculate() {
    setMessage("");
    const response = await fetch("/api/admin/recalculate", { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo recalcular");
      return;
    }
    setMessage(`Picks recalculados: ${data.updated}`);
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

    setMessage(
      `API recibio: ${data.received ?? 0}. Relacionados: ${data.matched ?? 0}. Resultados revisados: ${data.checked}. Partidos actualizados: ${data.updated}. Picks recalculados: ${data.predictionsUpdated}.`,
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
      body: JSON.stringify({ userId, matchId }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo eliminar el pick");
      return;
    }

    setMessage(`Pick eliminado: ${data.deleted.user} - ${data.deleted.match}`);
    await loadUsers();
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
    const form = event.currentTarget;
    const formData = new FormData(form);

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

    setMessage(`${data.user.name} fue creado desactivado. Activalo cuando confirme el pago.`);
    form.reset();
    await loadUsers();
  }

  async function resetUserPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const userId = String(formData.get("passwordUserId"));
    const user = users.find((item) => item.id === userId);

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
      setMessage(data.error ?? "No se pudo cambiar la contrasena del usuario");
      return;
    }

    setMessage(`Contrasena actualizada para ${data.user.name}. Ya puede ingresar con la nueva clave.`);
    form.reset();
    setSelectedPasswordUserId("");
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
  }

  async function saveAdminPick(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = event.currentTarget;
    const formData = new FormData(form);

    const response = await fetch("/api/admin/predictions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: String(formData.get("adminPickUserId")),
        matchId: String(formData.get("adminPickMatchId")),
        homeScore: Number(formData.get("adminPickHomeScore")),
        awayScore: Number(formData.get("adminPickAwayScore")),
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo guardar el pick");
      return;
    }

    setMessage(`Pick actualizado por super admin: ${data.user} - ${data.match}.`);
    form.reset();
    await loadUsers();
    onChanged();
  }

  async function saveAdminPickPoints(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = event.currentTarget;
    const formData = new FormData(form);

    const response = await fetch("/api/admin/predictions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: String(formData.get("adminPointsUserId")),
        matchId: String(formData.get("adminPointsMatchId")),
        points: Number(formData.get("adminManualPoints")),
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

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = event.currentTarget;
    const formData = new FormData(form);

    const response = await fetch("/api/auth/change-password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: String(formData.get("currentPassword")),
        newPassword: String(formData.get("newPassword")),
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo cambiar la contrasena");
      return;
    }

    setMessage("Contrasena actualizada. Usa la nueva clave en tu proximo ingreso.");
    form.reset();
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
      <div className="section-title">
        <div>
          <span className="market-kicker">Control general</span>
          <h2>Panel administrador</h2>
        </div>
      </div>
      {message ? <div className="notice">{message}</div> : null}
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
        <article>
          <span>Salas vencidas</span>
          <strong>{roomSummary.expiredRooms}</strong>
        </article>
        <article>
          <span>Ingresos por salas</span>
          <strong>{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(roomSummary.incomeInCents / 100)}</strong>
        </article>
      </div>
      <div className="admin-nav" aria-label="Secciones del administrador">
        <button
          className={`tab ${adminView === "overview" ? "active" : ""}`}
          onClick={() => setAdminView("overview")}
          type="button"
        >
          Resumen
        </button>
        <button
          className={`tab ${adminView === "matches" ? "active" : ""}`}
          onClick={() => setAdminView("matches")}
          type="button"
        >
          Partidos
        </button>
        <button
          className={`tab ${adminView === "users" ? "active" : ""}`}
          onClick={async () => {
            setAdminView("users");
            if (!usersLoaded) await loadUsers();
          }}
          type="button"
        >
          Usuarios
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
          className={`tab ${adminView === "security" ? "active" : ""}`}
          onClick={() => setAdminView("security")}
          type="button"
        >
          Seguridad
        </button>
      </div>
      <div className="grid two-columns">
        {adminView === "overview" ? (
          <>
            <section className="form admin-quick-actions">
              <div className="section-title">
                <div>
                  <span className="market-kicker">Operación diaria</span>
                  <h3>Acciones rápidas</h3>
                </div>
              </div>
              <div className="admin-action-grid">
                <button className="button primary" onClick={updateResults} type="button">
                  Actualizar resultados
                </button>
                <button className="button secondary" onClick={recalculate} type="button">
                  Recalcular puntos
                </button>
                <button className="button secondary" onClick={importWorldCupCalendar} type="button">
                  Cargar calendario
                </button>
                <button className="button secondary" onClick={testWhatsApp} type="button">
                  Probar WhatsApp
                </button>
                <button
                  className="button primary"
                  onClick={async () => {
                    setAdminView("rooms");
                    await loadRooms();
                  }}
                  type="button"
                >
                  Administrar salas
                </button>
                <a className="button secondary" href="/api/admin/export" download>
                  Descargar Excel
                </a>
              </div>
            </section>
            <section className="form admin-guide">
              <span className="market-kicker">Estado del sistema</span>
              <h3>Orden recomendado</h3>
              <ol>
                <li>Publica únicamente los partidos que quieres mostrar.</li>
                <li>La actualización automática consulta resultados cada 15 minutos.</li>
                <li>Usa la actualización manual solo para comprobar o corregir.</li>
                <li>Los pagos se administran por plan de sala, no por usuario.</li>
              </ol>
            </section>
            <section className="form result-audit">
              <div className="section-title">
                <div>
                  <span className="market-kicker">Revisión de marcadores</span>
                  <h3>Partidos publicados que ya comenzaron</h3>
                </div>
              </div>
              <div className="admin-user-list">
                {playedPublishedMatches.map((match) => {
                  const hasScore = match.homeScore !== null && match.awayScore !== null;
                  const statusLabel = !hasScore
                    ? "Falta marcador"
                    : match.status === "FINISHED"
                    ? "Cerrado"
                    : match.status === "LIVE"
                    ? "En vivo"
                    : "Marcador cargado, falta cerrar";
                  return (
                    <article className={`admin-user-card ${hasScore ? "active" : "inactive"}`} key={match.id}>
                      <div>
                        <strong>{match.homeTeam} vs {match.awayTeam}</strong>
                        <span>{new Date(match.startsAt).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}</span>
                      </div>
                      <div className="admin-user-stats">
                        <span>
                          <strong>{hasScore ? `${match.homeScore}-${match.awayScore}` : "--"}</strong>
                          Marcador
                        </span>
                      </div>
                      <div className="admin-user-badges"><span>{statusLabel}</span></div>
                    </article>
                  );
                })}
                {!playedPublishedMatches.length ? <div className="empty">No hay partidos publicados que ya hayan comenzado.</div> : null}
              </div>
            </section>
          </>
        ) : null}
        {adminView === "matches" ? (
          <>
            <section className="form publish-manager">
              <div className="section-title">
                <h3>Publicar partidos</h3>
                <span className="muted">
                  {publishedMatches}/{matches.length} publicados
                </span>
              </div>
              <div className="inline-form">
                <button className="button secondary" type="button" onClick={() => publishAll(false)}>
                  Ocultar todas
                </button>
                <button className="button secondary" type="button" onClick={() => publishAll(true)}>
                  Publicar todas
                </button>
              </div>
              <div className="publish-list">
                {matches.map((match) => (
                  <article className={`publish-card ${match.isPublished ? "published" : ""}`} key={match.id}>
                    <div className="publish-teams">
                      <span>
                        <strong>{flagForTeam(match.homeTeam)}</strong>
                        {match.homeTeam}
                      </span>
                      <span>
                        <strong>{flagForTeam(match.awayTeam)}</strong>
                        {match.awayTeam}
                      </span>
                    </div>
                    <div className="publish-meta">
                      <span>{new Date(match.startsAt).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}</span>
                      {match.group ? <span>{match.group}</span> : null}
                      <strong>{match.isPublished ? "Publicado" : "Oculto"}</strong>
                    </div>
                    <div className="publish-actions">
                      <button
                        className="button primary"
                        disabled={match.isPublished}
                        onClick={() => publishMatch(match, true)}
                        type="button"
                      >
                        Publicar
                      </button>
                      <button
                        className="button secondary"
                        disabled={!match.isPublished}
                        onClick={() => publishMatch(match, false)}
                        type="button"
                      >
                        Ocultar
                      </button>
                      <button
                        className="button danger"
                        disabled={!match.isPublished || match.status === "FINISHED"}
                        onClick={() => closeMatch(match)}
                        type="button"
                      >
                        Cerrar
                      </button>
                    </div>
                  </article>
                ))}
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
                  {publishedOpenMatches.map((match) => (
                    <option key={match.id} value={match.id}>
                      {match.homeTeam} vs {match.awayTeam}
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
                El parcial deja el partido en vivo y actualiza puntos provisionales. Cerrar partido deja el resultado final.
              </small>
              {!publishedOpenMatches.length ? (
                <div className="empty">No hay partidos publicados y abiertos para actualizar.</div>
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
          </>
        ) : null}
        {adminView === "users" ? (
          <>
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
                  pattern="([+]57[ -]?)?3[0-9 -]{9,13}"
                  placeholder="300 000 0000"
                  required
                  title="Ingresa un celular colombiano valido. Ejemplo: 300 000 0000"
                />
              </div>
              <div className="form-row">
                <label htmlFor="newUserPassword">Contraseña inicial</label>
                <input id="newUserPassword" name="newUserPassword" type="password" minLength={8} required />
              </div>
              <button className="button primary" type="submit">
                Crear usuario desactivado
              </button>
            </form>
            <form className="form" onSubmit={resetUserPassword}>
              <h3>Cambiar contraseña de usuario</h3>
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
                <label htmlFor="userNewPassword">Nueva contraseña</label>
                <input id="userNewPassword" name="userNewPassword" type="password" minLength={8} required />
              </div>
              <button className="button primary" type="submit">
                Guardar contraseña
              </button>
              {!usersLoaded ? (
                <button className="button secondary" type="button" onClick={loadUsers}>
                  Cargar usuarios
                </button>
              ) : null}
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
            <form className="form" onSubmit={saveAdminPick}>
              <h3>Crear o editar pick de participante</h3>
              <p className="muted">
                Solo el super admin puede modificar picks aunque el partido ya esté cerrado.
                Los puntos se calculan automáticamente si el partido ya tiene marcador.
              </p>
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
                <select id="adminPickMatchId" name="adminPickMatchId" required>
                  <option value="">Selecciona partido</option>
                  {matches.map((match) => (
                    <option key={match.id} value={match.id}>
                      {match.homeTeam} vs {match.awayTeam} · {match.status}
                      {match.isPublished ? "" : " · oculto"}
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
              <button className="button primary" type="submit">Guardar pick</button>
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
                      {match.homeTeam} vs {match.awayTeam} · {match.status}
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
            <section className="form users-admin-list">
              <div className="section-title">
                <div>
                  <h3>Base de usuarios</h3>
                  <p className="muted">Consulta WhatsApp, picks guardados, puntos y estado de cada usuario.</p>
                </div>
                <button className="button secondary" type="button" onClick={loadUsers}>
                  {usersLoaded ? "Actualizar" : "Cargar usuarios"}
                </button>
              </div>
              {usersLoaded ? (
                <div className="admin-user-list">
                  {users.map((user) => (
                    <article className={`admin-user-card ${user.isActive ? "active" : "inactive"}`} key={user.id}>
                      <div>
                        <strong>{user.name}</strong>
                        <span>WhatsApp: {user.phone}</span>
                      </div>
                      <div className="admin-user-stats">
                        <span>
                          <strong>{user.picksCount}</strong>
                          Picks
                        </span>
                        <span>
                          <strong>{user.points}</strong>
                          Puntos
                        </span>
                      </div>
                      <div className="admin-user-badges">
                        <span>{user.isActive ? "Activo" : "Desactivado"}</span>
                        {user.role === "ADMIN" ? <span>Admin</span> : null}
                      </div>
                      <div className="admin-user-actions">
                        <button
                          className="button secondary"
                          disabled={user.isActive}
                          onClick={() => updateUserStatus(user.id, true)}
                          type="button"
                        >
                          Activar
                        </button>
                        <button
                          className="button danger"
                          disabled={!user.isActive}
                          onClick={() => updateUserStatus(user.id, false)}
                          type="button"
                        >
                          Desactivar
                        </button>
                        <button
                          className="button secondary"
                          onClick={() => {
                            setSelectedPasswordUserId(user.id);
                            setMessage(`Listo para cambiar la contrasena de ${user.name}`);
                          }}
                          type="button"
                        >
                          Cambiar clave
                        </button>
                        <button className="button danger" onClick={() => deleteUserById(user.id)} type="button">
                          Eliminar
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty">Carga los usuarios para activar pagos o desactivar accesos.</div>
              )}
            </section>
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
          </>
        ) : null}
        {adminView === "rooms" ? (
          <>
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
                <label htmlFor="manualCompetitionId">Liga</label>
                <select id="manualCompetitionId" name="manualCompetitionId" required>
                  <option value="">Selecciona liga</option>
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
                <label htmlFor="trialCompetitionId">Liga</label>
                <select id="trialCompetitionId" name="trialCompetitionId" required>
                  <option value="">Selecciona liga</option>
                  {competitions.map((competition) => (
                    <option key={competition.id} value={competition.id}>{competition.name} · {competition.season}</option>
                  ))}
                </select>
              </div>
              <button className="button primary" type="submit">Crear prueba gratis de 10</button>
            </form>

            <form className="form" onSubmit={updateRoomAdmin}>
              <span className="market-kicker">Permisos de sala</span>
              <h3>Asignar administrador</h3>
              <div className="form-row">
                <label htmlFor="adminRoomId">Sala</label>
                <select
                  id="adminRoomId"
                  name="adminRoomId"
                  onChange={(event) => setSelectedAdminRoomId(event.target.value)}
                  required
                  value={selectedAdminRoomId}
                >
                  <option value="">Selecciona sala</option>
                  {adminRooms.map((room) => (
                    <option key={room.id} value={room.id}>{room.name} · {room.inviteCode}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="roomAdminUserId">Participante</label>
                <select id="roomAdminUserId" name="roomAdminUserId" required>
                  <option value="">Selecciona participante</option>
                  {adminRooms.find((room) => room.id === selectedAdminRoomId)?.memberships.map((membership) => (
                    <option key={membership.user.id} value={membership.user.id}>
                      {membership.user.name} · {membership.role === "ADMIN" ? "Admin actual" : "Participante"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="roomRole">Rol</label>
                <select id="roomRole" name="roomRole" defaultValue="ADMIN" required>
                  <option value="ADMIN">Administrador de sala</option>
                  <option value="MEMBER">Participante</option>
                </select>
              </div>
              <button className="button primary" type="submit">Guardar rol de sala</button>
            </form>

            <form className="form" onSubmit={updateRoomSettings}>
              <span className="market-kicker">Control de alquiler</span>
              <h3>Estado, propietario y vencimiento</h3>
              <div className="form-row">
                <label htmlFor="settingsRoomId">Sala</label>
                <select
                  id="settingsRoomId"
                  name="settingsRoomId"
                  onChange={(event) => setSelectedSettingsRoomId(event.target.value)}
                  required
                  value={selectedSettingsRoomId}
                >
                  <option value="">Selecciona sala</option>
                  {adminRooms.map((room) => <option key={room.id} value={room.id}>{room.name} · {room.inviteCode}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="settingsRoomName">Nombre de la sala</label>
                <input
                  id="settingsRoomName"
                  key={selectedSettingsRoomId}
                  name="settingsRoomName"
                  defaultValue={adminRooms.find((room) => room.id === selectedSettingsRoomId)?.name ?? ""}
                  minLength={3}
                  maxLength={80}
                  placeholder="Selecciona una sala"
                />
              </div>
              <div className="form-row">
                <label htmlFor="settingsOwnerId">Nuevo propietario (opcional)</label>
                <select id="settingsOwnerId" name="settingsOwnerId">
                  <option value="">Conservar propietario</option>
                  {users.filter((item) => item.role === "USER").map((item) => (
                    <option key={item.id} value={item.id}>{item.name} - {item.phone}</option>
                  ))}
                </select>
              </div>
              <div className="inline-form">
                <div className="form-row">
                  <label htmlFor="settingsStatus">Estado</label>
                  <select id="settingsStatus" name="settingsStatus" defaultValue="">
                    <option value="">Conservar estado</option>
                    <option value="ACTIVE">Activa</option>
                    <option value="SUSPENDED">Suspendida</option>
                    <option value="EXPIRED">Vencida</option>
                    <option value="CLOSED">Cerrada</option>
                  </select>
                </div>
                <div className="form-row">
                  <label htmlFor="settingsMaxParticipants">Límite</label>
                  <input id="settingsMaxParticipants" name="settingsMaxParticipants" type="number" min={2} max={10000} placeholder="Conservar" />
                </div>
                <div className="form-row">
                  <label htmlFor="settingsExpiresAt">Vencimiento</label>
                  <input id="settingsExpiresAt" name="settingsExpiresAt" type="datetime-local" />
                </div>
              </div>
              <button className="button primary" type="submit">Guardar configuración</button>
            </form>

            <section className="form users-admin-list">
              <div className="section-title">
                <div>
                  <h3>Salas registradas</h3>
                  <p className="muted">Revisa cupo, pago y administradores asignados.</p>
                </div>
                <button className="button secondary" onClick={loadRooms} type="button">Actualizar</button>
              </div>
              <div className="admin-user-list">
                {adminRooms.map((room) => (
                  <article className="admin-user-card active" key={room.id}>
                    <div>
                      <strong>{room.name}</strong>
                      <span>{room.competition?.name ?? "Sin liga"} · Código {room.inviteCode}</span>
                    </div>
                    <div className="admin-user-stats">
                      <span><strong>{room.memberships.length}/{room.maxParticipants}</strong>Cupo</span>
                      <span><strong>{room.memberships.filter((membership) => membership.role === "ADMIN").length}</strong>Admins</span>
                    </div>
                    <div className="admin-user-badges">
                      <span>{room.paymentStatus === "TRIAL" ? "Prueba gratis" : room.paidAt ? "Pagada" : "Pago pendiente"}</span>
                      <span>{room.status === "ACTIVE" ? "Activa" : room.status === "EXPIRED" ? "Vencida" : room.status === "SUSPENDED" ? "Suspendida" : "Cerrada"}</span>
                      <span>Creador: {room.owner.name}</span>
                      {room.expiresAt ? <span>Vence: {new Date(room.expiresAt).toLocaleDateString("es")}</span> : null}
                    </div>
                    <div className="admin-user-actions">
                      <button className="button danger" onClick={() => deleteAdminRoom(room)} type="button">Eliminar sala</button>
                    </div>
                  </article>
                ))}
                {!adminRooms.length ? <div className="empty">No hay salas registradas.</div> : null}
              </div>
            </section>
          </>
        ) : null}
        {adminView === "security" ? (
          <form className="form" onSubmit={changePassword}>
            <h3>Cambiar mi contraseña</h3>
            <div className="form-row">
              <label htmlFor="currentPassword">Contraseña actual</label>
              <input id="currentPassword" name="currentPassword" type="password" minLength={6} required />
            </div>
            <div className="form-row">
              <label htmlFor="newPassword">Nueva contraseña</label>
              <input id="newPassword" name="newPassword" type="password" minLength={8} required />
            </div>
            <button className="button primary" type="submit">
              Guardar nueva contraseña
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
