export type MatchStatusText = "SCHEDULED" | "LIVE" | "FINISHED";
export type RoomStatusText = "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CLOSED";

export function matchStatusLabel(status: MatchStatusText) {
  if (status === "LIVE") return "En vivo";
  if (status === "FINISHED") return "Finalizado";
  return "Abierto";
}

export function roomStatusLabel(status?: RoomStatusText | null) {
  if (status === "EXPIRED") return "Vencida";
  if (status === "SUSPENDED") return "Suspendida";
  if (status === "CLOSED") return "Cerrada";
  return "Activa";
}
