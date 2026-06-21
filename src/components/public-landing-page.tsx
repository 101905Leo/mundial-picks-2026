import Link from "next/link";

const benefits = [
  "Sala privada",
  "Picks por participante",
  "Ranking automático",
  "Chat de sala",
  "Pago Wompi/Nequi desde planes",
  "Fútbol y otros torneos",
];

export function PublicLandingPage() {
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

        <div className="public-landing-access" aria-label="Acceso rápido">
          <label className="public-landing-phone-label" htmlFor="public-landing-phone">
            Celular
          </label>
          <div className="public-landing-phone-field">
            <span>+57</span>
            <input
              id="public-landing-phone"
              inputMode="tel"
              maxLength={13}
              placeholder="300 000 0000"
              type="tel"
            />
          </div>
          <p>El acceso real se completa con tu contraseña en la siguiente pantalla.</p>

          <div className="public-landing-actions">
            <Link className="button primary public-landing-main-action" href="/mi-sala">
              Entrar
            </Link>
            <Link className="button secondary public-landing-secondary-action" href="/planes">
              Crear sala
            </Link>
          </div>
        </div>

        <ul className="public-landing-benefits" aria-label="Beneficios principales">
          {benefits.map((benefit) => (
            <li key={benefit}>{benefit}</li>
          ))}
        </ul>

        <nav className="public-landing-links" aria-label="Accesos de Mundial Picks">
          <Link href="/planes">¿No tienes cuenta? Crea una sala</Link>
          <Link href="/planes">Ver planes</Link>
          <Link href="/mi-sala">Entrar a mi sala</Link>
        </nav>
      </section>
    </main>
  );
}
