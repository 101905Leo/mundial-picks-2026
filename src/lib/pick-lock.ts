const pickLockMinutesBeforeStart = 5;

export function pickClosesAt(startsAt: Date) {
  return new Date(startsAt.getTime() - pickLockMinutesBeforeStart * 60 * 1000);
}

export function isPickClosed(startsAt: Date, now = new Date()) {
  return pickClosesAt(startsAt) <= now;
}
