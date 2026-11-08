export function createClockSync() {
  let offset = 0;
  const samples = [];
  return {
    note(serverNow, reset) {
      if (reset) samples.length = 0;
      samples.push(serverNow - Date.now());
      if (samples.length > 8) samples.shift();
      offset = Math.max(...samples);
    },
    offset: () => offset,
  };
}
