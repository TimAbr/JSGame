export function validateEntry(name, code) {
  const clean = String(name ?? "").trim();
  if (clean.length < 1 || clean.length > 16) return "Имя от 1 до 16 символов";
  if (code != null) {
    const room = String(code).trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(room)) return "Код комнаты — 4 символа";
    return null;
  }
  return null;
}
