"use client";

import { useEffect, useState } from "react";

type NewsItem = {
  title: string;
  link: string;
  source: string;
  publishedAt: string | null;
};

type Props = {
  compact?: boolean;
};

function formatDate(value: string | null) {
  if (!value) return "Reciente";

  return new Date(value).toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
  });
}

export function WorldCupNewsPanel({ compact = false }: Props) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadNews() {
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/news");
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudieron cargar noticias");
      setItems([]);
      setLoading(false);
      return;
    }

    setItems(data.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadNews();
  }, []);

  const visibleItems = compact ? items.slice(0, 3) : items.slice(0, 6);

  return (
    <section className={`news-panel ${compact ? "compact" : ""}`}>
      <div className="section-title">
        <div>
          <span className="market-kicker">Noticias Mundial 2026</span>
          <h2>Actualidad relevante</h2>
        </div>
        <button className="button secondary" onClick={loadNews} type="button">
          Actualizar
        </button>
      </div>

      {loading ? <div className="empty">Cargando noticias...</div> : null}
      {message ? <div className="notice">{message}</div> : null}

      {!loading && !message ? (
        <div className="news-list">
          {visibleItems.map((item) => (
            <a className="news-item" href={item.link} key={`${item.title}-${item.publishedAt}`} rel="noreferrer" target="_blank">
              <span>{formatDate(item.publishedAt)}</span>
              <strong>{item.title}</strong>
              <small>{item.source}</small>
            </a>
          ))}
          {!visibleItems.length ? <div className="empty">No hay noticias disponibles en este momento.</div> : null}
        </div>
      ) : null}
    </section>
  );
}
