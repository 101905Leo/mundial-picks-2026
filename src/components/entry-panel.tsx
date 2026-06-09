"use client";

import { useState } from "react";
import type { User } from "@/components/types";

type Props = {
  user: User;
};

const entryPrice = "$50.000";

export function EntryPanel({ user }: Props) {
  const [message, setMessage] = useState("");
  const isActive = user.role === "ADMIN" || Boolean(user.entryPaidAt);

  async function startEntryPayment() {
    setMessage("Preparando inscripción...");
    const response = await fetch("/api/entry/create-checkout", { method: "POST" });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo iniciar la inscripción");
      return;
    }

    window.location.href = data.checkoutUrl;
  }

  return (
    <section className={`entry-panel ${isActive ? "active" : ""}`}>
      <div>
        <span className="market-kicker">Inscripción</span>
        <strong>{isActive ? "Activa" : entryPrice}</strong>
      </div>
      {!isActive ? (
        <button className="button primary" onClick={startEntryPayment}>
          Pagar inscripción
        </button>
      ) : null}
      {message ? <span className="muted">{message}</span> : null}
    </section>
  );
}
