"use client";

import { useEffect, useState } from "react";
import type { User } from "@/components/types";

type Props = {
  user: User;
};

const entryPrice = "$50.000";

type PaymentInfo = {
  priceCop: number;
  method: string;
  holder: string;
  account: string;
  note: string;
};

export function EntryPanel({ user }: Props) {
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);
  const isActive = user.role === "ADMIN" || Boolean(user.entryPaidAt);

  useEffect(() => {
    async function loadPaymentInfo() {
      const response = await fetch("/api/entry/payment-info");
      const data = await response.json();
      setPaymentInfo(data);
    }

    if (!isActive) {
      loadPaymentInfo();
    }
  }, [isActive]);

  return (
    <section className={`entry-panel ${isActive ? "active" : ""}`}>
      <div>
        <span className="market-kicker">Inscripción</span>
        <strong>{isActive ? "Activa" : entryPrice}</strong>
      </div>
      {!isActive ? (
        <div className="entry-actions">
          <button className="button secondary" onClick={() => setShowPaymentInfo((visible) => !visible)} type="button">
            Cuenta de pago
          </button>
        </div>
      ) : null}
      {!isActive && showPaymentInfo ? (
        <div className="manual-payment-card">
          <span>{paymentInfo?.method || "Transferencia manual"}</span>
          <strong>{paymentInfo?.account || "Cuenta pendiente por configurar"}</strong>
          {paymentInfo?.holder ? <small>Titular: {paymentInfo.holder}</small> : null}
          <small>{paymentInfo?.note || "Envía el comprobante al administrador para activar tu inscripción."}</small>
        </div>
      ) : null}
    </section>
  );
}
