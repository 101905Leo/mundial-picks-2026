import { officialRanking, officialRankingUpdatedAt, officialRankingUrl } from "@/lib/official-ranking";
import { flagForTeam } from "@/lib/team-flags";

export function OfficialRankingPanel() {
  return (
    <section className="official-ranking-panel">
      <div className="section-title">
        <div>
          <span className="market-kicker">Ranking oficial</span>
          <h2>FIFA/Coca-Cola</h2>
        </div>
        <a className="button secondary" href={officialRankingUrl} rel="noreferrer" target="_blank">
          Ver FIFA
        </a>
      </div>
      <ol className="official-ranking-list">
        {officialRanking.map((entry) => (
          <li key={entry.team}>
            <span>{entry.rank}</span>
            <strong>
              {flagForTeam(entry.team)} {entry.team}
            </strong>
            <em>{entry.points}</em>
          </li>
        ))}
      </ol>
      <p className="official-ranking-note">Última actualización oficial: {officialRankingUpdatedAt}</p>
    </section>
  );
}
