"use client";

import { useEffect, useState } from "react";
import { AdminPanel } from "@/components/admin-panel";
import { AuthPanel } from "@/components/auth-panel";
import { Countdown } from "@/components/countdown";
import { EntryPanel } from "@/components/entry-panel";
import { LeaguePanel } from "@/components/league-panel";
import { LivePanel } from "@/components/live-panel";
import { MatchCard } from "@/components/match-card";
import { RankingTable } from "@/components/ranking-table";
import type { Match, RankingEntry, User } from "@/components/types";

export function MundialPicksApp() {
  const [user, setUser] = useState<User | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [activeView, setActiveView] = useState<"picks" | "live" | "leagues" | "admin">("picks");
  const [loading, setLoading] = useState(true);

  async function loadSession() {
    const response = await fetch("/api/auth/me");
    const data = await response.json();
    setUser(data.user);
  }

  async function loadData() {
    const [matchesResponse, rankingResponse] = await Promise.all([fetch("/api/matches"), fetch("/api/rankings")]);
    const [matchesData, rankingData] = await Promise.all([matchesResponse.json(), rankingResponse.json()]);
    setMatches(matchesData.matches);
    setRanking(rankingData.ranking);
  }

  async function loadAdminMatches() {
    const response = await fetch("/api/matches?includeHidden=true");
    const data = await response.json();
    setMatches(data.matches);
  }

  useEffect(() => {
    async function boot() {
      await loadSession();
      await loadData();
      setLoading(false);
    }
    boot();
  }, []);

  useEffect(() => {
    async function refreshSessionStatus() {
      if (document.visibilityState === "visible") {
        await loadSession();
      }
    }

    const interval = window.setInterval(refreshSessionStatus, 15000);
    window.addEventListener("focus", refreshSessionStatus);
    document.addEventListener("visibilitychange", refreshSessionStatus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshSessionStatus);
      document.removeEventListener("visibilitychange", refreshSessionStatus);
    };
  }, []);

  async function refresh() {
    await loadSession();
    await loadData();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setActiveView("picks");
    await refresh();
  }

  const groupCounts = matches.reduce<Record<string, number>>((counts, match) => {
    const groupName = match.group || "Sin grupo";
    counts[groupName] = (counts[groupName] || 0) + 1;
    return counts;
  }, {});

  const lockedMatches = matches.filter((match) => new Date(match.startsAt) <= new Date() || match.status === "FINISHED");
  const openMatches = matches.length - lockedMatches.length;
  const upcomingMatches = matches.slice(0, 3);
  const rankingPreview = ranking.slice(0, 5);
  const canPredict = Boolean(user && (user.role === "ADMIN" || user.entryPaidAt));
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
          {user ? <span className="user-chip">{user.name}</span> : null}
          {user ? <EntryPanel user={user} /> : null}
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

      <div className="container">
        {loading ? (
          <div className="panel">Cargando Copa Mundial de la FIFA 2026™...</div>
        ) : (
          <>
            {!user ? (
              <section className="landing-grid">
                <div className="landing-main">
                  <section className="landing-card landing-intro">
                    <span className="market-kicker">Quiniela oficial de amigos</span>
                    <h2>Predice, suma puntos y pelea el ranking desde el primer partido.</h2>
                    <div className="landing-stats">
                      <div className="prize-stat">
                        <strong>$1M</strong>
                        <span>Premio</span>
                      </div>
                      <div>
                        <strong>$50K</strong>
                        <span>Inscripción</span>
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

                <aside className="landing-side">
                  <AuthPanel
                    onAuth={async (sessionUser) => {
                      setUser(sessionUser);
                      await refresh();
                    }}
                  />
                  <section className="landing-card ranking-preview-card">
                    <div className="section-title">
                      <h2>Ranking global</h2>
                    </div>
                    {rankingPreview.length ? (
                      <ol className="ranking-preview">
                        {rankingPreview.map((entry, index) => (
                          <li key={entry.id}>
                            <span>{index + 1}</span>
                            <strong>{entry.name}</strong>
                            <em>{entry.points} pts</em>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div className="empty">Todavía no hay puntos registrados.</div>
                    )}
                  </section>
                </aside>
              </section>
            ) : null}

            {user ? (
              <nav className="tabs" aria-label="Secciones principales">
                <button
                  className={`tab ${activeView === "picks" ? "active" : ""}`}
                  onClick={async () => {
                    setActiveView("picks");
                    await loadData();
                  }}
                >
                  Picks
                </button>
                <button
                  className={`tab ${activeView === "live" ? "active" : ""}`}
                  onClick={async () => {
                    setActiveView("live");
                    await loadData();
                  }}
                >
                  En vivo
                </button>
                <button
                  className={`tab ${activeView === "leagues" ? "active" : ""}`}
                  onClick={async () => {
                    setActiveView("leagues");
                    await loadData();
                  }}
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
                  <RankingTable ranking={ranking} />
                </aside>
              </div>
            ) : null}

            {user && activeView === "leagues" ? (
              <LeaguePanel signedIn={Boolean(user)} />
            ) : null}

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
