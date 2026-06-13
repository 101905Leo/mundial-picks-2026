"use client";

import { useEffect, useMemo, useState } from "react";
import type { Match } from "@/components/types";

type Props = {
  matches: Match[];
  compact?: boolean;
};

function remainingTime(targetDate: Date, now: Date) {
  const total = Math.max(0, targetDate.getTime() - now.getTime());
  const days = Math.floor(total / 86_400_000);
  const hours = Math.floor((total % 86_400_000) / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1_000);

  return { days, hours, minutes, seconds, total };
}

export function Countdown({ matches, compact = false }: Props) {
  const [now, setNow] = useState(() => new Date());
  const nextMatch = useMemo(() => {
    const upcoming = matches
      .filter((match) => new Date(match.startsAt).getTime() > now.getTime())
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

    return upcoming[0] ?? null;
  }, [matches, now]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!nextMatch) {
    return null;
  }

  const targetDate = new Date(nextMatch.startsAt);
  const time = remainingTime(targetDate, now);

  return (
    <div className={`countdown-panel ${compact ? "compact" : ""}`}>
      <div className="countdown-next-match">
        <span>Próximo partido</span>
        <strong>{nextMatch.homeTeam} vs {nextMatch.awayTeam}</strong>
      </div>
      <div className="countdown-grid" aria-label="Tiempo restante">
        <span>
          <strong>{time.days}</strong>
          Dias
        </span>
        <span>
          <strong>{String(time.hours).padStart(2, "0")}</strong>
          Horas
        </span>
        <span>
          <strong>{String(time.minutes).padStart(2, "0")}</strong>
          Min
        </span>
        <span>
          <strong>{String(time.seconds).padStart(2, "0")}</strong>
          Seg
        </span>
      </div>
    </div>
  );
}
