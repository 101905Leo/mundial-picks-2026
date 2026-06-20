const ACTIVE_ROOM_PAYMENT_STATUSES = new Set(["APPROVED", "TRIAL", "MANUAL"]);

export const ROOM_PENDING_PAYMENT_ERROR = "La sala está pendiente de pago";
export const ROOM_PENDING_PAYMENT_STATUS = 402;

export function isRoomActivated(room: { paidAt: Date | string | null; paymentStatus: string | null }) {
  return Boolean(room.paidAt) || ACTIVE_ROOM_PAYMENT_STATUSES.has(String(room.paymentStatus ?? "").toUpperCase());
}
