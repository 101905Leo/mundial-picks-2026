"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { roomPlanCatalog, salesWhatsAppUrl, type RoomPlanCatalogItem } from "@/lib/room-plan-catalog";

type CreatorSignupForm = {
  name: string;
  phone: string;
  pin: string;
};

const emptyCreatorSignupForm: CreatorSignupForm = {
  name: "",
  phone: "",
  pin: "",
};

function formatPrice(priceCop: number | null) {
  if (priceCop === null) return "Cotización";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(priceCop);
}

export function PlansPage() {
  const [roomNames, setRoomNames] = useState<Record<string, string>>({});
  const [creatorForms, setCreatorForms] = useState<Record<string, CreatorSignupForm>>({});
  const [signupPlanSlug, setSignupPlanSlug] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  function creatorForm(planSlug: string) {
    return creatorForms[planSlug] ?? emptyCreatorSignupForm;
  }

  function updateCreatorForm(planSlug: string, field: keyof CreatorSignupForm, value: string) {
    setCreatorForms((current) => ({
      ...current,
      [planSlug]: {
        ...(current[planSlug] ?? emptyCreatorSignupForm),
        [field]: value,
      },
    }));
  }

  async function startRoomCheckout(event: FormEvent<HTMLFormElement>, plan: RoomPlanCatalogItem) {
    event.preventDefault();
    if (!plan.participantLimit) return;

    const roomName = (roomNames[plan.slug] ?? "").trim();
    if (roomName.length < 3) {
      setMessage("Escribe un nombre de sala de mínimo 3 caracteres.");
      return;
    }

    setPendingPlan(plan.slug);
    setMessage("Creando sala y preparando pago...");

    try {
      if (signupPlanSlug === plan.slug) {
        const signup = creatorForm(plan.slug);
        const name = signup.name.trim();
        const phone = signup.phone.trim();
        const pin = signup.pin.trim();

        if (name.length < 2) {
          setMessage("Escribe tu nombre para crear la sala.");
          return;
        }

        if (!phone) {
          setMessage("Escribe tu WhatsApp para crear la sala.");
          return;
        }

        if (!/^\d{4}$/.test(pin)) {
          setMessage("El PIN debe tener exactamente 4 números.");
          return;
        }

        const registerResponse = await fetch("/api/auth/register", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            phone,
            password: pin,
            registrationPurpose: "CREATE_ROOM",
          }),
        });
        const registerData = await registerResponse.json().catch(() => ({}));

        if (!registerResponse.ok) {
          setMessage(registerData.error ?? "No se pudo registrar el creador de la sala.");
          return;
        }

        setSignupPlanSlug(null);
      }

      const response = await fetch("/api/leagues", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomName,
          maxParticipants: plan.participantLimit,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        setSignupPlanSlug(plan.slug);
        setMessage("Crea tu acceso aquí mismo para continuar con el pago de la sala.");
        return;
      }

      if (!response.ok) {
        setMessage(data.error ?? "No se pudo crear la sala ni abrir Wompi.");
        return;
      }

      if (!data.checkout?.checkoutUrl) {
        setMessage("La sala se creó, pero no recibimos el enlace de pago. Usa WhatsApp como alternativa.");
        return;
      }

      window.location.href = data.checkout.checkoutUrl;
    } catch {
      setMessage("No se pudo conectar con el checkout. Intenta de nuevo o usa WhatsApp como alternativa.");
    } finally {
      setPendingPlan(null);
    }
  }

  return (
    <main className="plans-shell">
      <header className="plans-header">
        <Link className="brand plans-brand" href="/">
          <img className="brand-logo-image" src="/logo-copa-mundial-2026.png" alt="" />
          <span>
            <strong>Mundial Picks</strong>
            <span>Salas privadas de picks</span>
          </span>
        </Link>
        <Link className="button secondary" href="/">Volver al inicio</Link>
        <Link className="button secondary" href="/mi-sala">Entrar a la app</Link>
      </header>

      <section className="plans-intro">
        <span className="market-kicker">Alquila una sala para tu grupo</span>
        <h1>Organiza predicciones de fútbol y otros torneos</h1>
        <p>Crea una sala privada, invita a tu grupo y administra picks, resultados y ranking desde un solo lugar.</p>
      </section>

      <section className="plans-grid">
        {roomPlanCatalog.map((plan) => (
          <article className={`plan-card ${plan.slug === "sala-pro" ? "featured" : ""}`} key={plan.slug}>
            <div>
              <div className="plan-card-topline">
                <span className="market-kicker">{plan.participantLimit ? "Sala privada" : "Plan personalizado"}</span>
                {plan.slug === "sala-pro" ? <span className="plan-badge">Recomendado</span> : null}
              </div>
              <h2>{plan.name}</h2>
              <strong className="plan-price">{formatPrice(plan.priceCop)}</strong>
              <p>{plan.participantLimit ? `Hasta ${plan.participantLimit} participantes` : "Participantes según necesidad"}</p>
            </div>
            <ul>
              {plan.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}
            </ul>
            {plan.participantLimit ? (
              <form className="form" onSubmit={(event) => startRoomCheckout(event, plan)}>
                {signupPlanSlug === plan.slug ? (
                  <>
                    <div className="notice">
                      Crea tu acceso de administrador. Luego se abrirá Wompi/Nequi para activar la sala.
                    </div>
                    <div className="form-row">
                      <label htmlFor={`creator-name-${plan.slug}`}>Tu nombre</label>
                      <input
                        id={`creator-name-${plan.slug}`}
                        maxLength={80}
                        minLength={2}
                        onChange={(event) => updateCreatorForm(plan.slug, "name", event.target.value)}
                        required
                        value={creatorForm(plan.slug).name}
                      />
                    </div>
                    <div className="form-row">
                      <label htmlFor={`creator-phone-${plan.slug}`}>WhatsApp</label>
                      <input
                        autoComplete="tel-national"
                        id={`creator-phone-${plan.slug}`}
                        inputMode="tel"
                        maxLength={18}
                        onChange={(event) => updateCreatorForm(plan.slug, "phone", event.target.value)}
                        placeholder="300 000 0000"
                        required
                        type="tel"
                        value={creatorForm(plan.slug).phone}
                      />
                    </div>
                    <div className="form-row">
                      <label htmlFor={`creator-pin-${plan.slug}`}>PIN de 4 números</label>
                      <input
                        autoComplete="new-password"
                        id={`creator-pin-${plan.slug}`}
                        inputMode="numeric"
                        maxLength={4}
                        onChange={(event) =>
                          updateCreatorForm(plan.slug, "pin", event.target.value.replace(/\D/g, "").slice(0, 4))
                        }
                        pattern="\d{4}"
                        required
                        type="password"
                        value={creatorForm(plan.slug).pin}
                      />
                    </div>
                  </>
                ) : null}
                <div className="form-row">
                  <label htmlFor={`room-name-${plan.slug}`}>Nombre de la sala</label>
                  <input
                    id={`room-name-${plan.slug}`}
                    maxLength={80}
                    minLength={3}
                    onChange={(event) =>
                      setRoomNames((current) => ({ ...current, [plan.slug]: event.target.value }))
                    }
                    required
                    value={roomNames[plan.slug] ?? ""}
                  />
                </div>
                <button className="button primary" disabled={pendingPlan !== null} type="submit">
                  {pendingPlan === plan.slug
                    ? "Abriendo Wompi..."
                    : signupPlanSlug === plan.slug
                      ? "Registrarme y pagar con Wompi/Nequi"
                      : "Crear y pagar con Wompi/Nequi"}
                </button>
                <a className="button secondary" href={salesWhatsAppUrl(plan.name)} rel="noreferrer" target="_blank">
                  Ayuda por WhatsApp
                </a>
              </form>
            ) : (
              <a className="button primary" href={salesWhatsAppUrl(plan.name)} rel="noreferrer" target="_blank">
                Solicitar sala por WhatsApp
              </a>
            )}
          </article>
        ))}
      </section>

      {message ? <div className="notice">{message}</div> : null}

      <section className="panel room-legal-notice plans-legal">
        Mundial Picks solo proporciona la plataforma tecnológica para crear y administrar salas privadas. Los premios,
        pagos, acuerdos o beneficios ofrecidos dentro de cada sala son responsabilidad exclusiva del creador o
        administrador de la sala.
      </section>
    </main>
  );
}
