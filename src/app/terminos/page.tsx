import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="plans-shell">
      <header className="plans-header">
        <Link className="brand plans-brand" href="/">
          <img className="brand-logo-image" src="/logo-mpa-badge.png" alt="" />
          <span>
            <strong>Mundial Picks Arena</strong>
            <span>Términos del servicio</span>
          </span>
        </Link>
        <Link className="button secondary" href="/">Volver al inicio</Link>
      </header>

      <section className="panel room-legal-notice">
        <span className="market-kicker">Condiciones de uso</span>
        <h1>Términos y condiciones</h1>
        <p>
          Mundial Picks Arena permite crear salas privadas para organizar predicciones deportivas entre grupos.
          El servicio incluye administración de sala, calendario, picks, ranking, chat y herramientas de seguimiento.
        </p>

        <h2>Uso del servicio</h2>
        <p>
          Cada creador de sala es responsable de compartir el código únicamente con las personas de su grupo.
          Los participantes deben usar información real de contacto para poder acceder y recibir soporte.
        </p>

        <h2>Pagos y activación</h2>
        <p>
          Los pagos se procesan mediante Wompi/Nequi. Una sala queda activa cuando el pago sea aprobado o cuando
          el administrador active manualmente una sala empresarial o acordada por soporte.
        </p>

        <h2>Reembolsos y soporte</h2>
        <p>
          Si un pago fue realizado por error o la sala no pudo activarse correctamente, el usuario puede solicitar
          revisión por WhatsApp. Cada caso será revisado según el estado del pago, uso de la sala y soporte recibido.
        </p>

        <h2>Disponibilidad</h2>
        <p>
          El servicio puede depender de proveedores externos como Wompi, WhatsApp, Vercel, base de datos y fuentes
          de resultados deportivos. Mundial Picks Arena puede realizar mantenimientos o ajustes para mejorar la estabilidad.
        </p>

        <h2>Contacto</h2>
        <p>
          Para soporte comercial o técnico, usa los botones de WhatsApp disponibles dentro de la plataforma.
        </p>
      </section>
    </main>
  );
}
