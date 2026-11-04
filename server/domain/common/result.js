export function ok(state, events = []) {
  return { ok: true, state, events };
}

export function fail(code) {
  return { ok: false, error: code };
}
