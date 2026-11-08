export function formatTime(ms) {
  const clamped = Math.max(0, Math.floor(ms));
  const min = Math.floor(clamped / 60000);
  const sec = Math.floor(clamped / 1000) % 60;
  const centi = Math.floor(clamped / 10) % 100;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(centi).padStart(2, "0")}`;
}
