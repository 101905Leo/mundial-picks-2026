"use client";

import { useEffect, useState } from "react";
import { AdminPanel } from "@/components/admin-panel";
import { AuthPanel } from "@/components/auth-panel";
import { CompetitionPanel } from "@/components/competition-panel";
import { Countdown } from "@/components/countdown";
import { FormidableFacts } from "@/components/formidable-facts";
import { GlobalRankingPanel } from "@/components/global-ranking-panel";
import { LeaguePanel } from "@/components/league-panel";
import { LivePanel } from "@/components/live-panel";
import { MatchCard } from "@/components/match-card";
import { RankingTable } from "@/components/ranking-table";
import { StatisticsPanel } from "@/components/statistics-panel";
import { WorldCupNewsTicker } from "@/components/worldcup-news-panel";
import type { Match, RankingEntry, User } from "@/components/types";

export function MundialPicksApp() {
  const [user, setUser] = useState<User | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [activeView, setActiveView] = useState<
    "picks" | "ranking" | "facts" | "statistics" | "live" | "rooms" | "leagues" | "admin"
  >("rooms");
  const [loading, setLoading] = useState(true);

  async function loadSession() {
    const response = await fetch("/api/auth/me");
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error ?? "No se pudo consultar la sesión");
    }
    setUser(data.user);
    return data.user as User | null;
  }

  async function loadData(viewer: User | null = user) {
    const canViewGlobalRanking = Boolean(viewer);
    const [matchesResponse, rankingResponse] = await Promise.allSettled([
      fetch("/api/matches"),
      canViewGlobalRanking ? fetch("/api/rankings") : Promise.resolve(null),
    ]);

    if (matchesResponse.status === "fulfilled" && matchesResponse.value.ok) {
      const matchesData = await matchesResponse.value.json();
      setMatches(matchesData.matches ?? []);
    } else {
      setMatches([]);
    }

    if (rankingResponse.status === "fulfilled" && rankingResponse.value?.ok) {
      const rankingData = await rankingResponse.value.json();
      setRanking(rankingData.ranking ?? []);
    } else {
      setRanking([]);
    }
  }

  async function loadAdminMatches() {
    const response = await fetch("/api/matches?includeHidden=true");
    const data = await response.json();
    setMatches(data.matches);
  }

  useEffect(() => {
    async function boot() {
      try {
        const sessionUser = await loadSession();
        if (sessionUser) setActiveView("rooms");
        await loadData(sessionUser);
      } catch (error) {
        console.error("Initial app load failed", error);
        setUser(null);
        setMatches([]);
        setRanking([]);
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, []);

  useEffect(() => {
    async function refreshSessionStatus() {
      if (document.visibilityState === "visible") {
        try {
          await loadSession();
        } catch (error) {
          console.warn("Session refresh failed", error);
        }
      }
    }

    const interval = window.setInterval(refreshSessionStatus, 60000);
    window.addEventListener("focus", refreshSessionStatus);
    document.addEventListener("visibilitychange", refreshSessionStatus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshSessionStatus);
      document.removeEventListener("visibilitychange", refreshSessionStatus);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    let refreshing = false;
    async function refreshVisibleData() {
      if (document.visibilityState !== "visible" || refreshing) return;
      refreshing = true;
      try {
        await loadData(user);
      } finally {
        refreshing = false;
      }
    }

    const interval = window.setInterval(refreshVisibleData, 15000);
    return () => window.clearInterval(interval);
  }, [user?.id]);

  async function refresh() {
    const sessionUser = await loadSession();
    await loadData(sessionUser);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setActiveView("rooms");
    await loadData(null);
  }

  const groupCounts = matches.reduce<Record<string, number>>((counts, match) => {
    const groupName = match.group || "Sin grupo";
    counts[groupName] = (counts[groupName] || 0) + 1;
    return counts;
  }, {});

  const lockedMatches = matches.filter((match) => new Date(match.startsAt) <= new Date() || match.status === "FINISHED");
  const openMatches = matches.length - lockedMatches.length;
  const upcomingMatches = matches.slice(0, 3);
  const canViewGlobalRanking = Boolean(user);
  const canPredict = Boolean(user && (user.role === "ADMIN" || user.hasLeagueAccess));
  const pickDisabledMessage =
    user && !user.hasLeagueAccess
      ? "Entra a una sala con código para guardar picks."
      : "Tu acceso de sala permite guardar picks.";
  const matchesByDate = matches.reduce<Array<{ key: string; label: string; matches: Match[] }>>((days, match) => {
    const startsAt = new Date(match.startsAt);
    const key = startsAt.toISOString().slice(0, 10);
    const label = startsAt.toLocaleDateString("es", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const existingDay = days.find((day) => day.key === key);

    if (existingDay) {
      existingDay.matches.push(match);
    } else {
      days.push({ key, label, matches: [match] });
    }

    return days;
  }, []);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo-image" src="/logo-copa-mundial-2026.png" alt="Copa Mundial de la FIFA 2026™" />
          <span>
            <strong>Copa Mundial de la FIFA 2026™</strong>
            <span>11 jun 2026 - 19 jul 2026</span>
          </span>
        </div>
        <Countdown matches={matches} compact />
        <div className="top-actions">
          <a className="button secondary" href="/planes">Planes</a>
          {user ? <span className="user-chip">{user.name}</span> : null}
          {user ? (
            <button className="button danger" onClick={logout}>
              Salir
            </button>
          ) : null}
        </div>
      </header>

      <section className="hero-band">
        <div className="hero-content">
          <div className="hero-title-group">
            <img className="hero-logo-image" src="/logo-copa-mundial-2026.png" alt="Copa Mundial de la FIFA 2026™" />
            <h1>Copa Mundial de la FIFA 2026™</h1>
          </div>
        </div>
      </section>

      <WorldCupNewsTicker />

      <div className="container">
        {loading ? (
          <div className="panel">Cargando Copa Mundial de la FIFA 2026™...</div>
        ) : (
          <>
            {!user ? (
              <section className="landing-grid">
                <div className="landing-main">
                  <section className="landing-card landing-intro">
                    <span className="market-kicker">Salas privadas de quiniela</span>
                    <h2>Crea tu sala, invita a tu grupo y administra un ranking independiente.</h2>
                    <div className="landing-stats">
                      <div>
                        <strong>4</strong>
                        <span>Planes de sala</span>
                      </div>
                      <div>
                        <strong>100</strong>
                        <span>Participantes</span>
                      </div>
                      <div>
                        <strong>104</strong>
                        <span>Partidos</span>
                      </div>
                      <div>
                        <strong>48</strong>
                        <span>Selecciones</span>
                      </div>
                    </div>
                    <div className="landing-cta-row">
                      <a className="button primary" href="#registro">Registrarme gratis</a>
                      <a className="button secondary" href="/planes">Ver planes</a>
                    </div>
                  </section>

                  <section className="landing-card room-sales-points">
                    <article><strong>Crea tu sala privada</strong><span>Un espacio exclusivo para tu grupo.</span></article>
                    <article><strong>Organiza tu quiniela</strong><span>Configura reglas y participantes.</span></article>
                    <article><strong>Reta a tus amigos</strong><span>Comparte el código por WhatsApp.</span></article>
                    <article><strong>Administra tu ranking</strong><span>Consulta puntos, rachas y exactos.</span></article>
                  </section>

                  <section className="landing-card">
                    <div className="section-title">
                      <h2>Próximos partidos</h2>
                      <span className="muted">{openMatches} abiertos</span>
                    </div>
                    <div className="landing-match-list">
                      {upcomingMatches.length ? (
                        upcomingMatches.map((match) => (
                          <article className="landing-match" key={match.id}>
                            <span>{new Date(match.startsAt).toLocaleDateString("es", { day: "2-digit", month: "short" })}</span>
                            <strong>
                              {match.homeTeam} vs {match.awayTeam}
                            </strong>
                            <small>{match.group || match.venue || "Copa Mundial"}</small>
                          </article>
                        ))
                      ) : (
                        <div className="empty">Los partidos aparecerán cuando el admin los publique.</div>
                      )}
                    </div>
                  </section>

                  <section className="landing-card public-room-promo">
                    <div>
                      <span className="market-kicker">Alquila una sala para tu grupo</span>
                      <h2>Tu quiniela, tus participantes y tus reglas</h2>
                      <p>
                        Invita amigos o compañeros de trabajo, administra el cupo y consulta un ranking privado.
                      </p>
                    </div>
                    <div className="landing-cta-row">
                      <a className="button primary" href="/planes">Crear sala privada</a>
                      <a className="button secondary" href="https://goallive.online" rel="noreferrer" target="_blank">Ver partidos</a>
                    </div>
                  </section>

                  <section className="landing-card room-legal-notice">
                    Mundial Picks solo proporciona la plataforma tecnológica para crear y administrar salas privadas.
                    Los premios, pagos, acuerdos o beneficios ofrecidos dentro de cada sala son responsabilidad exclusiva
                    del creador o administrador de la sala.
                  </section>

                  <section className="landing-card">
                    <div className="section-title">
                      <h2>Sistema de puntos</h2>
                    </div>
                    <p className="score-explainer">
                      Cada partido suma según qué tan cerca quede tu predicción del resultado real. Solo puedes guardar
                      picks hasta 5 minutos antes del inicio.
                    </p>
                    <p className="score-note">
                      En partidos definidos por penales, cuenta el marcador antes de la tanda de penales.
                    </p>
                    <div className="score-rules">
                      <article>
                        <strong>5</strong>
                        <h3>Marcador exacto</h3>
                        <p>Acertaste los goles de ambos equipos.</p>
                        <small>Ejemplo: predices 2-1 y termina 2-1.</small>
                      </article>
                      <article>
                        <strong>3</strong>
                        <h3>Ganador correcto</h3>
                        <p>Acertaste quién gana o si empatan, aunque el marcador sea diferente.</p>
                        <small>Ejemplo: predices 2-0 y termina 1-0.</small>
                      </article>
                      <article>
                        <strong>2</strong>
                        <h3>Diferencia correcta</h3>
                        <p>Acertaste la diferencia de goles, pero no el ganador exacto por regla anterior.</p>
                        <small>Ejemplo: predices 3-1 y termina 2-0.</small>
                      </article>
                      <article>
                        <strong>1</strong>
                        <h3>Participación</h3>
                        <p>Guardaste tu pick antes del cierre, aunque no aciertes resultado.</p>
                        <small>Ejemplo: predices 1-1 y termina 3-0.</small>
                      </article>
                    </div>
                  </section>
                </div>

                <aside className="landing-side" id="registro">
                  <AuthPanel
                    onAuth={async (sessionUser, options) => {
                      setUser(sessionUser);
                      if (options?.joinedLeague) setActiveView("rooms");
                      await loadData(sessionUser);
                    }}
                  />
                  <section className="landing-card mobile-note">
                    <div className="section-title">
                      <h2>Úsala en tu celular</h2>
                    </div>
                    <p>
                      Abre <strong>mundialpicks.online</strong> desde Safari o Chrome. Puedes registrarte, iniciar
                      sesión, guardar tus picks y revisar el ranking desde el teléfono.
                    </p>
                    <div className="mobile-note-steps">
                      <span>iPhone: Compartir → Agregar a pantalla de inicio</span>
                      <span>Android: Menú ⋮ → Agregar a pantalla principal</span>
                    </div>
                  </section>
                </aside>
              </section>
            ) : null}

            {user ? (
              <nav className="tabs" aria-label="Secciones principales">
                <button
                  className={`tab ${activeView === "rooms" ? "active" : ""}`}
                  onClick={() => setActiveView("rooms")}
                >
                  Mi sala
                </button>
                <button
                  className={`tab ${activeView === "leagues" ? "active" : ""}`}
                  onClick={() => setActiveView("leagues")}
                >
                  Ligas
                </button>
                {user?.role === "ADMIN" ? (
                  <button
                    className={`tab ${activeView === "admin" ? "active" : ""}`}
                    onClick={async () => {
                      setActiveView("admin");
                      await loadAdminMatches();
                    }}
                  >
                    Admin
                  </button>
                ) : null}
              </nav>
            ) : null}

            {user && activeView === "picks" ? (
              <div className="sportsbook-layout">
                <aside className="sports-sidebar">
                  <div className="sidebar-block">
                    <h3>Fútbol</h3>
                    <button className="league-link active">Mundo</button>
                    <button className="league-link">Copa Mundial</button>
                    <button className="league-link">Calendario</button>
                  </div>
                  <div className="sidebar-block">
                    <h3>Grupos</h3>
                    {Object.entries(groupCounts).map(([groupName, count]) => (
                      <button className="league-link" key={groupName}>
                        <span>{groupName}</span>
                        <strong>{count}</strong>
                      </button>
                    ))}
                  </div>
                </aside>

                <section className="market-board">
                  <div className="market-header">
                    <div>
                      <span className="market-kicker">Mundo</span>
                      <h2>Copa Mundial de la FIFA 2026™</h2>
                    </div>
                    <div className="market-stats">
                      <span>{matches.length} partidos</span>
                      <span>{openMatches} abiertos</span>
                    </div>
                  </div>
                  <div className="market-columns" aria-hidden="true">
                    <span>Partido y tu marcador</span>
                    <span>Resultado real</span>
                    <span>Puntos</span>
                  </div>
                  <div className="market-list">
                    {matches.length ? (
                      matchesByDate.map((day) => (
                        <section className="match-day" key={day.key}>
                          <header className="match-day-header">
                            <strong>{day.label}</strong>
                            <span>{day.matches.length} partidos</span>
                          </header>
                          {day.matches.map((match) => (
                            <MatchCard
                              key={match.id}
                              match={match}
                              signedIn={Boolean(user)}
                              canPredict={canPredict}
                              disabledMessage={pickDisabledMessage}
                              onSaved={refresh}
                            />
                          ))}
                        </section>
                      ))
                    ) : (
                      <div className="empty">
                        No hay partidos publicados todavia. Ve a Admin y usa Publicar por partido para mostrar los
                        partidos que quieras.
                      </div>
                    )}
                  </div>
                </section>

                <aside className="ranking-sidebar">
                  <div className="section-title">
                    <h2>Ranking global</h2>
                  </div>
                  {canViewGlobalRanking ? (
                    <RankingTable ranking={ranking} />
                  ) : (
                    <div className="empty">Inicia sesión para consultar el ranking global.</div>
                  )}
                </aside>
              </div>
            ) : null}

            {user && canViewGlobalRanking && activeView === "ranking" ? (
              <GlobalRankingPanel ranking={ranking} user={user} onOpenPicks={() => setActiveView("picks")} />
            ) : null}

            {user && activeView === "rooms" ? (
              <LeaguePanel user={user} />
            ) : null}

            {user && activeView === "leagues" ? <CompetitionPanel user={user} /> : null}

            {user && activeView === "facts" ? <FormidableFacts /> : null}

            {user && activeView === "statistics" ? <StatisticsPanel /> : null}

            {user && activeView === "live" ? (
              <LivePanel matches={matches} />
            ) : null}

            {activeView === "admin" && user?.role === "ADMIN" ? (
              <AdminPanel matches={matches} onChanged={loadAdminMatches} />
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
