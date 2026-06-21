"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const benefits = [
  "Sala privada",
  "Picks por participante",
  "Ranking automático",
  "Chat de sala",
  "Pago Wompi/Nequi desde planes",
  "Fútbol y otros torneos",
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
            <Link className="button secondary public-landing-secondary-action" href="/planes">
              Crear sala
            </Link>
          </div>
        </form>

        <ul className="public-landing-benefits" aria-label="Beneficios principales">
          {benefits.map((benefit) => (
            <li key={benefit}>{benefit}</li>
          ))}
        </ul>

        <nav className="public-landing-links" aria-label="Accesos de Mundial Picks">
          <Link href="/planes">¿No tienes cuenta? Crea una sala</Link>
          <Link href="/planes">Ver planes</Link>
          <Link href="/mi-sala">Entrar sin escribir número</Link>
        </nav>
      </section>
    </main>
  );
}
