"use client";

import { FormEvent, useState } from "react";
import type { Match } from "@/components/types";
import { flagForTeam } from "@/lib/team-flags";

type AdminUser = {
  id: string;
  name: string;
  phone: string;
  role: "USER" | "ADMIN";
  isActive: boolean;
  entryPaidAt: string | null;
};

type Props = {
  matches: Match[];
  onChanged: () => void;
};

export function AdminPanel({ matches, onChanged }: Props) {
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const publishedMatches = matches.filter((match) => match.isPublished).length;

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

    const response = await fetch(`/api/admin/matches/${matchId}/result`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        homeScore: Number(formData.get("homeScore")),
        awayScore: Number(formData.get("awayScore")),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "No se pudo cargar el resultado");
      return;
    }

    setMessage("Resultado guardado y puntos recalculados");
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

  async function updateResults() {
    setMessage("Actualizando resultados reales...");
    const response = await fetch("/api/admin/update-results", { method: "POST" });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudieron actualizar los resultados");
      return;
    }

    setMessage(
      `Resultados revisados: ${data.checked}. Partidos actualizados: ${data.updated}. Picks recalculados: ${data.predictionsUpdated}.`,
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
        ? `${data.user.name} ahora esta activo porque ya pago la inscripcion`
        : `${data.user.name} ahora esta desactivado para guardar picks`,
    );
    await loadUsers();
  }

  async function deleteUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const userId = String(formData.get("deleteUserId"));
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
    event.currentTarget.reset();
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

  return (
    <section className="panel">
      <div className="section-title">
        <h2>Panel administrador</h2>
        <div className="top-actions">
          <button className="button secondary" onClick={importWorldCupCalendar}>
            Cargar calendario Mundial 2026
          </button>
          <button className="button primary" onClick={updateResults}>
            Actualizar resultados reales
          </button>
          <button className="button secondary" onClick={recalculate}>
            Recalcular puntos
          </button>
        </div>
      </div>
      <div className="grid two-columns">
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
          <h3>Cargar resultado</h3>
          <div className="form-row">
            <label htmlFor="matchId">Partido</label>
            <select id="matchId" name="matchId" required>
              {matches.map((match) => (
                <option key={match.id} value={match.id}>
                  {match.homeTeam} vs {match.awayTeam} {match.isPublished ? "" : "(oculto)"}
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
            <button className="button primary" type="submit">
              Guardar
            </button>
          </div>
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
        <section className="form users-admin-list">
          <div className="section-title">
            <div>
              <h3>Usuarios</h3>
              <p className="muted">Activar confirma que el usuario ya pagó la inscripción.</p>
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
                    <span>{user.phone}</span>
                  </div>
                  <div className="admin-user-badges">
                    <span>{user.entryPaidAt ? "Pagó inscripción" : "Pago pendiente"}</span>
                    <span>{user.isActive ? "Activo" : "Desactivado"}</span>
                    {user.role === "ADMIN" ? <span>Admin</span> : null}
                  </div>
                  <div className="admin-user-actions">
                    <button
                      className="button secondary"
                      disabled={user.isActive && Boolean(user.entryPaidAt)}
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
      </div>
      {message ? <div className="notice">{message}</div> : null}
    </section>
  );
}
