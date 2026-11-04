export function effectiveTime(now, startedAt, bonusMs) {
  return Math.max(0, now - startedAt - bonusMs);
}
