const competitions = [
  {
    name: "Copa Mundial de la FIFA 2026™",
    region: "Mundial",
    status: "Activa",
    description: "La competición principal disponible actualmente en Mundial Picks.",
  },
  {
    name: "Liga Colombiana",
    region: "Colombia",
    status: "Próximamente",
    description: "Pronósticos, calendario y salas para el fútbol profesional colombiano.",
  },
  {
    name: "Liga Española",
    region: "España",
    status: "Próximamente",
    description: "Una quiniela independiente para cada jornada de la temporada.",
  },
  {
    name: "Champions League",
    region: "Europa",
    status: "Próximamente",
    description: "Fase de liga y eliminatorias en una competición separada.",
  },
];

export function CompetitionPanel() {
  return (
    <section className="competition-page">
      <div className="panel competition-header">
        <div>
          <span className="market-kicker">Competiciones</span>
          <h2>Ligas disponibles</h2>
          <p>Cada liga tendrá su propio calendario, picks, estadísticas y ranking.</p>
        </div>
      </div>
      <div className="competition-grid">
        {competitions.map((competition) => (
          <article className="panel competition-card" key={competition.name}>
            <span>{competition.region}</span>
            <h3>{competition.name}</h3>
            <p>{competition.description}</p>
            <strong className={competition.status === "Activa" ? "competition-active" : ""}>{competition.status}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
