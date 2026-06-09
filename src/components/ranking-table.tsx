import type { RankingEntry } from "@/components/types";

type Props = {
  ranking: RankingEntry[];
};

export function RankingTable({ ranking }: Props) {
  if (!ranking.length) {
    return <div className="empty">Todavia no hay puntos registrados.</div>;
  }

  return (
    <table className="ranking">
      <thead>
        <tr>
          <th>#</th>
          <th>Jugador</th>
          <th>Picks</th>
          <th>Puntos</th>
        </tr>
      </thead>
      <tbody>
        {ranking.map((entry, index) => (
          <tr key={entry.id}>
            <td>{index + 1}</td>
            <td>{entry.name}</td>
            <td>{entry.predictions}</td>
            <td>
              <strong>{entry.points}</strong>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
