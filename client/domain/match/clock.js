export function createClockSync() {
  let offset = 0;
  let oneWay = 0;
  const samples = [];

  function adopt() {
    const best = samples.reduce((left, right) => (left.rtt <= right.rtt ? left : right));
    offset = best.offset;
    oneWay = Number.isFinite(best.rtt) ? best.rtt / 2 : 0;
  }

  return {
    note(serverNow, reset) {
      if (reset) samples.length = 0;
      if (samples.length) return;
      samples.push({ rtt: Infinity, offset: serverNow - Date.now() });
      adopt();
    },
    noteEcho(serverNow, clientSent, serverRecvAt, reset) {
      if (reset) samples.length = 0;
      const received = Date.now();
      const rtt = received - clientSent - (serverNow - serverRecvAt);
      if (!Number.isFinite(rtt) || rtt < 0 || rtt > 10000) return;
      samples.push({ rtt, offset: (serverRecvAt - clientSent + serverNow - received) / 2 });
      if (samples.length > 8) samples.shift();
      adopt();
    },
    offset: () => offset,
    oneWay: () => oneWay,
  };
}
