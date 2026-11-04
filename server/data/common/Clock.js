export function createClock() {
  return { now: () => Date.now() };
}
