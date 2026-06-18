"use client";

import { useEffect, useState } from "react";
import { AdminPanel } from "@/components/admin-panel";
import { AuthPanel } from "@/components/auth-panel";
import { Countdown } from "@/components/countdown";
import { FormidableFacts } from "@/components/formidable-facts";
import { GlobalRankingPanel } from "@/components/global-ranking-panel";
import { LeaguePanel } from "@/components/league-panel";
import { MatchCard } from "@/components/match-card";
import { RankingTable } from "@/components/ranking-table";
import { WorldCupNewsTicker } from "@/components/worldcup-news-panel";
import type { Match, RankingEntry, User } from "@/components/types";
import { roomPlanCatalog, salesWhatsAppUrl } from "@/lib/room-plan-catalog";

export function MundialPicksApp() {
  const [user, setUser] = useState<User | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [activeView, setActiveView] = useState<
    "picks" | "ranking" | "facts" | "rooms" | "admin"
  >("rooms");
  const [publicAuthMode, setPublicAuthMode] = useState<"login" | "register">("login");
  const [roomMenuRequest, setRoomMenuRequest] = useState(0);
  const [publicMoreOpen, setPublicMoreOpen] = useState(false);
  const [publicTouchStart, setPublicTouchStart] = useState<number | null>(null);
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
    const matchesUrl = viewer?.role === "ADMIN" ? "/api/matches?includeHidden=true" : "/api/matches";
    const [matchesResponse, rankingResponse] = await Promise.allSettled([
      fetch(matchesUrl),
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
        if (sessionUser) setActiveView(sessionUser.role === "ADMIN" ? "admin" : "rooms");
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
    if (sessionUser?.role === "ADMIN" && activeView !== "admin" && activeView !== "rooms") {
      setActiveView("admin");
    }
    await loadData(sessionUser);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setActiveView("rooms");
    await loadData(null);
  }

  function openPublicAccess(mode: "login" | "register") {
    setPublicAuthMode(mode);
    setPublicMoreOpen(false);
    window.requestAnimationFrame(() => {
      document.getElementById("acceso")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function openPublicSection(sectionId: string) {
    setPublicMoreOpen(false);
    window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handlePublicTouchEnd(y: number) {
    if (publicTouchStart === null) return;
    if (publicTouchStart - y > 42) setPublicMoreOpen(true);
    setPublicTouchStart(null);
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
  const canPredict = Boolean(user && user.role !== "ADMIN" && user.hasLeagueAccess);
  const pickDisabledMessage =
    user?.role === "ADMIN"
      ? "Modo espectador: puedes administrar salas, pero no guardar picks propios."
      : user && !user.hasLeagueAccess
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

  const isActionView = Boolean(user);

  return (
    <main className={`app-shell ${isActionView ? "action-view" : ""}`}>
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo-image" src="/logo-copa-mundial-2026.png" alt="Copa Mundial de la FIFA 2026™" />
          <span>
            <strong>Mundial Picks 2026</strong>
            <span>11 jun 2026 - 19 jul 2026</span>
          </span>
        </div>
        <Countdown matches={matches} compact />
        <div className="top-actions">
          {user ? <span className="user-chip">{user.name}</span> : null}
          {user?.role === "ADMIN" ? (
            <button className="button danger" onClick={logout}>
              Salir
            </button>
          ) : null}
        </div>
      </header>

      <section
        className="hero-band"
        onTouchStart={!user ? (event) => setPublicTouchStart(event.touches[0]?.clientY ?? null) : undefined}
        onTouchEnd={!user ? (event) => handlePublicTouchEnd(event.changedTouches[0]?.clientY ?? 0) : undefined}
      >
        <div className="hero-content">
          <div className="hero-title-group">
            <img className="hero-logo-image" src="/logo-copa-mundial-2026.png" alt="Copa Mundial de la FIFA 2026™" />
            <div>
              <h1>{!user ? "Tu liga privada del Mundial." : "Copa Mundial de la FIFA 2026™"}</h1>
              {!user ? (
                <>
                  <p>Crea una quiniela, invita a tus amigos y compite en un ranking en vivo.</p>
                  <div className="hero-actions">
                    <button className="button primary" onClick={() => openPublicAccess("register")} type="button">
                      Crear mi liga
                    </button>
                    <button className="button secondary" onClick={() => openPublicAccess("register")} type="button">
                      Ingresar con código
                    </button>
                  </div>
                  <button className="landing-swipe-hint" onClick={() => setPublicMoreOpen(true)} type="button">
                    ↑ Desliza para ver más
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {user ? <WorldCupNewsTicker /> : null}

      <div className="container">
        {loading ? (
          <div className="panel">Cargando Copa Mundial de la FIFA 2026™...</div>
        ) : (
          <>
            {!user ? (
              <section className="public-landing">
                <section className="landing-card landing-showcase" id="showcase">
                  <div className="landing-showcase-copy">
                    <span className="market-kicker">Vive el Mundial con tu grupo</span>
                    <h2>Todo tu grupo compitiendo en una sola sala.</h2>
                    <p>Crea una liga privada, comparte el código y deja que el ranking se actualice solo.</p>
                    <button className="button primary" onClick={() => openPublicAccess("register")} type="button">
                      Crear mi liga
                    </button>
                  </div>
                  <div className="landing-app-mockup" aria-hidden="true">
                    <div className="mockup-top">
                      <span>Partido destacado</span>
                      <strong>COL 2 - 1 BRA</strong>
                    </div>
                    <div className="mockup-ranking">
                      <span>🏆 Ana · 18 pts</span>
                      <span>2. Carlos · 15 pts</span>
                      <span>3. Luis · 13 pts</span>
                    </div>
                    <div className="mockup-picks">
                      <span>Picks de amigos</span>
                      <strong>1-0 · 2-1 · 1-1</strong>
                    </div>
                    <div className="mockup-code">Código MP26</div>
                  </div>
                </section>

                <section className="landing-card landing-code-panel" id="acceso">
                  <div>
                    <span className="market-kicker">¿Ya tienes código?</span>
                    <h2>Ingresa a tu sala y empieza a jugar.</h2>
                    <p>Haz tus pronósticos, revisa tu posición en el ranking y sigue los resultados de tu grupo.</p>
                  </div>
                  <AuthPanel
                    initialMode={publicAuthMode}
                    onAuth={async (sessionUser, options) => {
                      setUser(sessionUser);
                      setActiveView(sessionUser.role === "ADMIN" ? "admin" : "rooms");
                      await loadData(sessionUser);
                    }}
                  />
                </section>

                <section className="landing-card landing-private-panel" id="crear-sala">
                  <div>
                    <span className="market-kicker">Crea tu liga privada</span>
                    <h2>Una sala para jugar con tu grupo.</h2>
                    <p>Crea una sala, comparte el código y deja que tus amigos hagan sus picks.</p>
                  </div>
                  <button className="button primary" onClick={() => openPublicAccess("register")} type="button">
                    Crear liga
                  </button>
                </section>

                <section className="landing-card landing-steps" id="como-funciona">
                  <div className="section-title compact-title">
                    <span className="market-kicker">Cómo funciona</span>
                    <h2>Cuatro pasos para jugar</h2>
                  </div>
                  <div className="landing-step-grid">
                    <article><strong>1</strong><span>Crea tu sala</span></article>
                    <article><strong>2</strong><span>Comparte el código</span></article>
                    <article><strong>3</strong><span>Cada jugador hace sus pronósticos</span></article>
                    <article><strong>4</strong><span>El ranking se actualiza con los resultados</span></article>
                  </div>
                </section>

                <section className="landing-card landing-score-card" id="reglas">
                  <div className="section-title compact-title">
                    <span className="market-kicker">Reglas resumidas</span>
                    <h2>Sistema de puntos</h2>
                  </div>
                  <div className="score-rules compact-score-rules">
                    <article><strong>5</strong><h3>Marcador exacto</h3><small>Ej: queda 2-1 y pronosticaste 2-1.</small></article>
                    <article><strong>3</strong><h3>Ganador correcto</h3><small>Ej: gana Colombia y elegiste victoria local.</small></article>
                    <article><strong>2</strong><h3>Diferencia correcta</h3><small>Ej: gana por 2 goles y acertaste esa diferencia.</small></article>
                    <article><strong>1</strong><h3>Participación</h3><small>Ej: hiciste pick, aunque no acertaste.</small></article>
                    <article><strong>0</strong><h3>Sin pronóstico</h3><small>Ej: no guardaste pick antes del inicio.</small></article>
                  </div>
                  <p className="score-note">
                    En partidos definidos por penales, los puntos se calculan con el marcador antes de la tanda de penales.
                  </p>
                </section>

                <section className="landing-card landing-plans" id="planes">
                  <div className="section-title compact-title">
                    <span className="market-kicker">Planes</span>
                    <h2>Elige el tamaño de tu sala.</h2>
                  </div>
                  <p className="score-explainer">
                    Organiza tu quiniela privada del Mundial 2026 con código, ranking, chat y resultados.
                  </p>
                  <div className="landing-benefits">
                    <span>Sala privada con código</span>
                    <span>Ranking automático</span>
                    <span>Resultados y puntos</span>
                    <span>Chat de sala</span>
                    <span>Administración sencilla</span>
                  </div>
                  <div className="landing-plan-strip">
                    {roomPlanCatalog.map((plan) => (
                      <article key={plan.slug}>
                        <strong>{plan.name}</strong>
                        <span>{plan.participantLimit ? `Hasta ${plan.participantLimit}` : "Personalizada"}</span>
                      </article>
                    ))}
                  </div>
                  <a className="button primary" href="/planes">Ver planes</a>
                </section>

                <section id="noticias">
                  <WorldCupNewsTicker />
                </section>

                <footer className="landing-footer">
                  <span>Desarrollado por Mundial Picks 2026</span>
                  <a href={salesWhatsAppUrl("Sala Básica")} rel="noreferrer" target="_blank">Contacto</a>
                </footer>

                <a className="floating-contact" href={salesWhatsAppUrl("Sala Básica")} rel="noreferrer" target="_blank">
                  Chatear
                </a>
              </section>
            ) : null}

            {!user && publicMoreOpen ? (
              <div className="room-sheet-shell public-more-shell" role="dialog" aria-modal="true" aria-label="Ver mas">
                <button className="room-sheet-backdrop" onClick={() => setPublicMoreOpen(false)} type="button" aria-label="Cerrar menu" />
                <section className="room-sheet-panel public-more-panel">
                  <div className="room-chat-handle" aria-hidden="true" />
                  <header className="room-sheet-header">
                    <div>
                      <span className="market-kicker">Explorar</span>
                      <h3>Ver más</h3>
                      <p>Elige una sección y seguimos abajo en la página.</p>
                    </div>
                    <button className="room-chat-close" onClick={() => setPublicMoreOpen(false)} type="button" aria-label="Cerrar menu">
                      ×
                    </button>
                  </header>
                  <div className="public-more-actions">
                    <button onClick={() => openPublicSection("como-funciona")} type="button">Cómo funciona</button>
                    <button onClick={() => openPublicSection("reglas")} type="button">Reglas</button>
                    <button onClick={() => openPublicSection("planes")} type="button">Planes</button>
                    <button onClick={() => openPublicSection("noticias")} type="button">Noticias</button>
                  </div>
                </section>
              </div>
            ) : null}

            {user ? (
              <nav className="tabs" aria-label="Secciones principales">
                {user.role === "ADMIN" ? (
                  <>
                    <button
                      className={`tab ${activeView === "admin" ? "active" : ""}`}
                      onClick={async () => {
                        setActiveView("admin");
                        window.history.pushState(null, "", "/");
                        await loadAdminMatches();
                      }}
                    >
                      Panel administrador
                    </button>
                  </>
                ) : (
                  <button
                    className={`tab ${activeView === "rooms" ? "active" : ""}`}
                    onClick={() => {
                      setActiveView("rooms");
                      setRoomMenuRequest((current) => current + 1);
                    }}
                  >
                    Salas
                  </button>
                )}
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
              <LeaguePanel user={user} onLogout={logout} roomMenuRequest={roomMenuRequest} />
            ) : null}

            {user && activeView === "facts" ? <FormidableFacts /> : null}

            {user?.role === "ADMIN" && activeView === "admin" ? (
              <AdminPanel
                initialView="overview"
                matches={matches}
                onChanged={loadAdminMatches}
                user={user}
              />
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
