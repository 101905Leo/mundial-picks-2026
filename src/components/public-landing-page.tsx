"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { salesWhatsAppUrl } from "@/lib/room-plan-catalog";

const benefits = [
  "Sala privada",
  "Picks por participante",
  "Ranking automático",
  "Chat de sala",
  "Pago Wompi/Nequi desde planes",
  "Fútbol y otros torneos",
];

const infoSteps = [
  {
    title: "Crea una sala",
    text: "Elige un plan, ponle nombre a tu grupo y activa el pago desde Wompi/Nequi.",
  },
  {
    title: "Invita participantes",
    text: "Comparte el código de sala para que familia, amigos o compañeros entren con su WhatsApp.",
  },
  {
    title: "Hagan picks",
    text: "Cada participante predice marcadores, revisa partidos y conserva su acceso con PIN.",
  },
  {
    title: "Sigan el ranking",
    text: "La sala muestra puntos, posiciones y conversación del grupo en un solo lugar.",
  },
];

function normalizeLandingPhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0057")) digits = digits.slice(4);
  if (digits.startsWith("57") && digits.length > 10) digits = digits.slice(2);
  return digits;
}

export function PublicLandingPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  function continueToLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPhone = normalizeLandingPhone(phone);

    if (!normalizedPhone) {
      router.push("/mi-sala");
      return;
    }

    if (!/^3\d{9}$/.test(normalizedPhone)) {
      setMessage("Escribe un WhatsApp colombiano de 10 dígitos. Ejemplo: 300 000 0000.");
      return;
    }

    router.push(`/mi-sala?phone=${encodeURIComponent(normalizedPhone)}`);
  }

  function continueToRegister() {
    const normalizedPhone = normalizeLandingPhone(phone);

    if (normalizedPhone && !/^3\d{9}$/.test(normalizedPhone)) {
      setMessage("Escribe un WhatsApp colombiano de 10 dígitos. Ejemplo: 300 000 0000.");
      return;
    }

    const params = new URLSearchParams({ mode: "register" });
    if (normalizedPhone) params.set("phone", normalizedPhone);
    router.push(`/mi-sala?${params.toString()}`);
  }

  return (
    <main className="public-landing-page">
      <section className="public-landing-hero" aria-labelledby="public-landing-title">
        <div className="public-landing-brand">
          <img className="public-landing-logo" src="/logo-copa-mundial-2026.png" alt="" />
          <span>Mundial Picks</span>
        </div>

        <div className="public-landing-copy">
          <p className="public-landing-kicker">Salas privadas de predicciones</p>
          <h1 id="public-landing-title">Predice partidos, compite con tu grupo y sigue el ranking en vivo</h1>
        </div>

        <form className="public-landing-access" aria-label="Acceso rápido" onSubmit={continueToLogin}>
          <label className="public-landing-phone-label" htmlFor="public-landing-phone">
            WhatsApp
          </label>
          <div className="public-landing-phone-field">
            <span>+57</span>
            <input
              autoComplete="tel-national"
              id="public-landing-phone"
              inputMode="tel"
              maxLength={18}
              onChange={(event) => {
                setPhone(event.target.value);
                setMessage("");
              }}
              placeholder="300 000 0000"
              type="tel"
              value={phone}
            />
          </div>
          <p>Luego completas tu contraseña para entrar con seguridad.</p>
          {message ? <div className="public-landing-message">{message}</div> : null}

          <div className="public-landing-actions">
            <button className="button primary public-landing-main-action" type="submit">
              Continuar
            </button>
          </div>
        </form>

        <section className="public-landing-new-user" aria-label="Registro de participante">
          <span>¿Es tu primera vez?</span>
          <button className="public-landing-register-action" onClick={continueToRegister} type="button">
            Soy nuevo, registrarme
          </button>
        </section>

        <div className="public-landing-secondary-grid" aria-label="Acciones adicionales">
          <Link className="public-landing-action-card" href="/planes">
            <strong>Crear sala</strong>
            <span>Organiza tu grupo privado</span>
          </Link>
          <a className="public-landing-action-card" href={salesWhatsAppUrl("Sala privada")} rel="noreferrer" target="_blank">
            <strong>Chatea con nosotros</strong>
            <span>Te ayudamos por WhatsApp</span>
          </a>
        </div>

        <a className="public-landing-info-link" href="#conoce-la-app">
          Conoce la app
        </a>

        <ul className="public-landing-benefits" aria-label="Beneficios principales">
          {benefits.map((benefit) => (
            <li key={benefit}>{benefit}</li>
          ))}
        </ul>

        <nav className="public-landing-links" aria-label="Accesos de Mundial Picks">
          <Link href="/planes">Ver planes</Link>
          <Link href="/mi-sala">Entrar sin escribir número</Link>
        </nav>
      </section>

      <section className="public-landing-info-section" id="conoce-la-app" aria-labelledby="public-landing-info-title">
        <p className="public-landing-kicker">Cómo funciona</p>
        <h2 id="public-landing-info-title">Una sala simple para jugar predicciones en grupo</h2>
        <div className="public-landing-info-grid">
          {infoSteps.map((step) => (
            <article key={step.title}>
              <strong>{step.title}</strong>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
        <div className="public-landing-info-actions">
          <Link className="button primary" href="/planes">
            Ver planes
          </Link>
          <a className="button secondary" href={salesWhatsAppUrl("Sala privada")} rel="noreferrer" target="_blank">
            Hablar por WhatsApp
          </a>
        </div>
      </section>
    </main>
  );
}
