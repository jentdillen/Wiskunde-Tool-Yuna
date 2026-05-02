const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "0123456789";

/** Format like ABC-123 (no confusing I/O). */
export function generateSessionCode(): string {
  let letters = "";
  for (let i = 0; i < 3; i++) {
    letters += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  }
  let digits = "";
  for (let i = 0; i < 3; i++) {
    digits += DIGITS[Math.floor(Math.random() * DIGITS.length)];
  }
  return `${letters}-${digits}`;
}

export function normalizeSessionCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}
