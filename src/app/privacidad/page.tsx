import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="plans-shell">
      <header className="plans-header">
        <Link className="brand plans-brand" href="/">
          <img className="brand-logo-image" src="/logo-mpa-badge.png" alt="" />
          <span>
            <strong>Mundial Picks Arena</strong>
            <span>Política de privacidad</span>
          </span>
        </Link>
        <Link className="button secondary" href="/">Volver al inicio</Link>
      </header>

      <section className="panel room-legal-notice">
        <span className="market-kicker">Datos personales</span>
        <h1>Política de privacidad</h1>
        <p>
          Mundial Picks Arena recopila la información necesaria para crear cuentas, administrar salas, procesar pagos,
          mostrar rankings y brindar soporte.
        </p>

        <h2>Datos que podemos tratar</h2>
        <p>
          Podemos tratar nombre, número de WhatsApp, PIN cifrado, salas creadas, membresías, picks, mensajes de chat,
          historial de pagos, estado de activación y datos técnicos necesarios para operar la plataforma.
        </p>

        <h2>Uso de la información</h2>
        <p>
          Usamos los datos para permitir el acceso a salas privadas, guardar predicciones, calcular rankings,
          gestionar pagos, enviar avisos operativos y atender solicitudes de soporte.
        </p>

        <h2>Pagos</h2>
        <p>
          Los pagos son procesados por Wompi. Mundial Picks Arena no almacena datos sensibles de tarjetas o métodos de pago.
          Solo guarda referencias, estados y montos necesarios para confirmar la activación del servicio.
        </p>

        <h2>WhatsApp</h2>
        <p>
          Podemos usar WhatsApp para soporte, avisos operativos, pruebas controladas y comunicaciones relacionadas
          con salas, pagos o administración del servicio.
        </p>

        <h2>Conservación y seguridad</h2>
        <p>
          La información se conserva mientras sea necesaria para operar la cuenta, la sala y el soporte. Se usan
          cookies de sesión seguras y PIN cifrado para proteger el acceso.
        </p>

        <h2>Contacto</h2>
        <p>
          Para solicitar revisión, actualización o eliminación de información, contacta al soporte por WhatsApp.
        </p>
      </section>
    </main>
  );
}
