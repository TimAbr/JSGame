const KEY = "maze-session";
const store = localStorage;

export function loadSession() {
  try {
    const raw = store.getItem(KEY) || sessionStorage.getItem(KEY);
    const parsed = JSON.parse(raw || "null");
    if (!parsed?.playerId || !parsed?.code) return null;
    store.setItem(KEY, JSON.stringify(parsed));
    return { playerId: parsed.playerId, code: parsed.code, name: parsed.name || "" };
  } catch {
    return null;
  }
}

export function saveSession(session) {
  store.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  store.removeItem(KEY);
  sessionStorage.removeItem(KEY);
}

const PLACE_KEY = "maze-place";

export function loadPlace() {
  try {
    const parsed = JSON.parse(store.getItem(PLACE_KEY) || "null");
    const screen = ["home", "create", "browse", "room"].includes(parsed?.screen) ? parsed.screen : "home";
    return { screen, query: String(parsed?.query ?? ""), listed: parsed?.listed !== false };
  } catch {
    return { screen: "home", query: "", listed: true };
  }
}

export function savePlace(place) {
  store.setItem(PLACE_KEY, JSON.stringify(place));
}
