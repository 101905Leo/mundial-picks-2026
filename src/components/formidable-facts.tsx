"use client";

import { useEffect, useMemo, useState } from "react";
import { formidableFacts, type FormidableFactTeam } from "@/lib/formidable-facts";
import { flagForTeam } from "@/lib/team-flags";

type Props = {
  compact?: boolean;
};

const regions = ["Todas", "Sudamerica", "Concacaf", "Europa", "Africa", "Asia", "Oceania"];

type RandomFact = {
  id: string;
  team: FormidableFactTeam;
  fact: string;
};

function allRandomFacts() {
  return formidableFacts.flatMap((team) =>
    team.facts.map((fact, index) => ({
      id: `${team.name}-${index}`,
      team,
      fact,
    })),
  );
}

function shuffledFacts(count: number) {
  return [...allRandomFacts()].sort(() => Math.random() - 0.5).slice(0, count);
}

export function FormidableFacts({ compact = false }: Props) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("Todas");

  const teams = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return formidableFacts.filter((team) => {
      const matchesRegion = region === "Todas" || team.region === region;
      const matchesQuery =
        !normalizedQuery ||
        team.name.toLowerCase().includes(normalizedQuery) ||
        team.group.toLowerCase().includes(normalizedQuery) ||
        team.region.toLowerCase().includes(normalizedQuery);

      return matchesRegion && matchesQuery;
    });
  }, [query, region]);

  const visibleTeams = compact ? teams.slice(0, 6) : teams;

  return (
    <section className={`facts-board ${compact ? "compact" : ""}`}>
      <div className="facts-hero">
        <div>
          <span className="market-kicker">Datos formidables</span>
          <h2>48 selecciones, 144 datos que no conocias</h2>
          <p>
            Curiosidades poco conocidas, estadios historicos y detalles escondidos de cada seleccion que participa en
            el Mundial 2026.
          </p>
        </div>
        <div className="facts-counter">
          <strong>144</strong>
          <span>datos</span>
        </div>
      </div>

      {!compact ? (
        <div className="facts-controls">
          <label className="facts-search" htmlFor="facts-search">
            <span>Buscar seleccion</span>
            <input
              id="facts-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Colombia, Japon, Grupo K..."
              value={query}
            />
          </label>
          <div className="facts-region-tabs" aria-label="Filtrar por region">
            {regions.map((item) => (
              <button
                className={`market-tab ${region === item ? "active" : ""}`}
                key={item}
                onClick={() => setRegion(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="facts-grid">
        {visibleTeams.map((team) => (
          <article className="fact-card" key={team.name}>
            <header>
              <span className="fact-flag">{flagForTeam(team.name)}</span>
              <div>
                <h3>{team.name}</h3>
                <small>
                  {team.group} - {team.region}
                </small>
              </div>
            </header>
            <ol>
              {team.facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ol>
          </article>
        ))}
      </div>

      {!visibleTeams.length ? <div className="empty">No encontramos selecciones con ese filtro.</div> : null}
    </section>
  );
}

type RandomProps = {
  count?: number;
  title?: string;
  compact?: boolean;
};

export function RandomFormidableFacts({
  count = 3,
  title = "Datos formidables al azar",
  compact = false,
}: RandomProps) {
  const fallbackFacts = useMemo(() => allRandomFacts().slice(0, count), [count]);
  const [facts, setFacts] = useState<RandomFact[]>(fallbackFacts);

  function refreshFacts() {
    setFacts(shuffledFacts(count));
  }

  useEffect(() => {
    refreshFacts();
  }, [count]);

  return (
    <section className={`random-facts ${compact ? "compact" : ""}`}>
      <div className="section-title">
        <div>
          <span className="market-kicker">Datos formidables</span>
          <h2>{title}</h2>
        </div>
        <button className="button secondary" onClick={refreshFacts} type="button">
          Ver otros
        </button>
      </div>
      <div className="random-facts-grid">
        {facts.map((item) => (
          <article className="random-fact-card" key={item.id}>
            <header>
              <span className="fact-flag">{flagForTeam(item.team.name)}</span>
              <div>
                <h3>{item.team.name}</h3>
                <small>
                  {item.team.group} - {item.team.region}
                </small>
              </div>
            </header>
            <p>{item.fact}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function FormidableFactsTicker() {
  const tickerFacts = allRandomFacts().slice(0, 36);
  const repeatedFacts = [...tickerFacts, ...tickerFacts];

  return (
    <section className="facts-ticker" aria-label="Datos formidables del Mundial 2026">
      <div className="facts-ticker-label">
        <span>Datos formidables</span>
        <strong>144</strong>
      </div>
      <div className="facts-ticker-window">
        <div className="facts-ticker-track">
          {repeatedFacts.map((item, index) => (
            <article className="ticker-fact" key={`${item.id}-${index}`}>
              <span>{flagForTeam(item.team.name)}</span>
              <strong>{item.team.name}</strong>
              <em>{item.fact}</em>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
