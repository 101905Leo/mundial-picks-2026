import Link from "next/link";
import { roomPlanCatalog, salesWhatsAppUrl } from "@/lib/room-plan-catalog";

function formatPrice(priceCop: number | null) {
  if (priceCop === null) return "Cotización";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(priceCop);
}

export function PlansPage() {
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
      </header>

      <section className="plans-intro">
        <span className="market-kicker">Alquila una sala para tu grupo</span>
        <h1>Organiza tus picks y administra tu propio ranking</h1>
        <p>Crea una sala privada, invita a tus amigos o compañeros y define las reglas internas de tu grupo.</p>
      </section>

      <section className="plans-grid">
        {roomPlanCatalog.map((plan) => (
          <article className={`plan-card ${plan.slug === "sala-pro" ? "featured" : ""}`} key={plan.slug}>
            <div>
              <div className="plan-card-topline">
                <span className="market-kicker">{plan.durationDays} días</span>
                {plan.slug === "sala-pro" ? <span className="plan-badge">Recomendado</span> : null}
              </div>
              <h2>{plan.name}</h2>
              <strong className="plan-price">{formatPrice(plan.priceCop)}</strong>
              <p>{plan.participantLimit ? `Hasta ${plan.participantLimit} participantes` : "Participantes según necesidad"}</p>
            </div>
            <ul>
              {plan.benefits.map((benefit) => <li key={benefit}>{benefit}</li>)}
            </ul>
            <a className="button primary" href={salesWhatsAppUrl(plan.name)} rel="noreferrer" target="_blank">
              Solicitar sala por WhatsApp
            </a>
          </article>
        ))}
      </section>

      <section className="panel room-legal-notice plans-legal">
        Mundial Picks solo proporciona la plataforma tecnológica para crear y administrar salas privadas. Los premios,
        pagos, acuerdos o beneficios ofrecidos dentro de cada sala son responsabilidad exclusiva del creador o
        administrador de la sala.
      </section>
    </main>
  );
}
