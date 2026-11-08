const KEY = "maze-session";
const PLACE_KEY = "maze-place";

export function loadSession() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (!parsed?.playerId || !parsed?.code) return null;
    return { playerId: parsed.playerId, code: parsed.code, name: parsed.name || "" };
  } catch {
    return null;
  }
}

export function saveSession(session) {
  sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  sessionStorage.removeItem(KEY);
  localStorage.removeItem(KEY);
}

export function loadPlace() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(PLACE_KEY) || "null");
    const screen = ["home", "create", "browse", "room"].includes(parsed?.screen) ? parsed.screen : "home";
    return { screen, query: String(parsed?.query ?? ""), listed: parsed?.listed !== false };
  } catch {
    return { screen: "home", query: "", listed: true };
  }
}

export function savePlace(place) {
  sessionStorage.setItem(PLACE_KEY, JSON.stringify(place));
}
