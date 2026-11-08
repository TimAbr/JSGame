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
    note(serverNow) {
      if (samples.length) return;
      samples.push({ rtt: Infinity, offset: serverNow - Date.now() });
      adopt();
    },
    noteEcho(serverNow, clientSent, serverRecvAt) {
      const received = Date.now();
      const rtt = received - clientSent - (serverNow - serverRecvAt);
      if (!Number.isFinite(rtt) || rtt < 0 || rtt > 10000) return;
      samples.push({ rtt, offset: (serverRecvAt - clientSent + serverNow - received) / 2 });
      if (samples.length > 8) samples.shift();
      adopt();
    },
    reset() {
      samples.length = 0;
      offset = 0;
      oneWay = 0;
    },
    offset: () => offset,
    oneWay: () => oneWay,
  };
}
