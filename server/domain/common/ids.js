const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const COLORS = ["#e85d4c", "#3d9cf0", "#37b37e", "#f0b429", "#b07cff", "#f27bb2", "#2ec4b6", "#f4845f"];

export function makeCode(rng, taken) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let code = "";
    for (let i = 0; i < 4; i += 1) code += ALPHABET[Math.floor(rng() * ALPHABET.length)];
    if (!taken(code)) return code;
  }
  return ALPHABET[Math.floor(rng() * ALPHABET.length)] + String(Date.now()).slice(-3);
}

export function colorFor(index) {
  return COLORS[index % COLORS.length];
}

export function normalizeName(name) {
  const trimmed = String(name ?? "").trim();
  if (trimmed.length < 1 || trimmed.length > 16) return null;
  return trimmed;
}
