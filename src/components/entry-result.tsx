"use client";

import { useEffect, useState } from "react";

export function EntryResult() {
  const [message, setMessage] = useState("Confirmando pago...");

  useEffect(() => {
    async function confirmEntry() {
      const transactionId = new URLSearchParams(window.location.search).get("id");

      if (!transactionId) {
        setMessage("Wompi no envió el id de la transacción.");
        return;
      }

      const response = await fetch("/api/entry/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "No se pudo confirmar el pago.");
        return;
      }

      const approvedMessage =
        data.paymentType === "room"
          ? "Sala activada. Redirigiendo..."
          : "Inscripción activa. Redirigiendo...";
      setMessage(data.status === "APPROVED" ? approvedMessage : `Estado de pago: ${data.status}`);

      if (data.status === "APPROVED") {
        window.setTimeout(() => {
          window.location.href = "/mi-sala";
        }, 900);
      }
    }

    confirmEntry();
  }, []);

  return (
    <main className="payment-page">
      <section className="panel payment-result">
        <img className="brand-logo-image" src="/logo-copa-mundial-2026.png" alt="Copa Mundial de la FIFA 2026™" />
        <h1>Pago</h1>
        <p className="muted">{message}</p>
        <a className="button primary" href="/">
          Volver
        </a>
      </section>
    </main>
  );
}
