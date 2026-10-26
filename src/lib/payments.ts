/** Helpers for Czech "QR platba" (SPAYD) payloads and bank transfer details. */

/**
 * Variabilní symbol z ID objednávky (10 číslic). Stejný výpočet je v databázi
 * (public.shop_vs) – objednávku tak jde v bance spárovat podle VS.
 */
export function variableSymbol(id: string) {
  const hex = id.replace(/-/g, "").slice(0, 12);
  const n = parseInt(hex, 16) % 10_000_000_000;
  return String(n).padStart(10, "0");
}

/** Číslo účtu z českého IBANu (CZkk BBBB PPPPPP CCCCCCCCCC → předčíslí-číslo/kód banky). */
export function czAccountFromIban(iban?: string | null) {
  const v = (iban || "").replace(/\s+/g, "").toUpperCase();
  if (!/^CZ\d{22}$/.test(v)) return null;
  const bank = v.slice(4, 8);
  const prefix = v.slice(8, 14).replace(/^0+/, "");
  const number = v.slice(14).replace(/^0+/, "");
  return `${prefix ? prefix + "-" : ""}${number}/${bank}`;
}

/** Build a SPAYD string readable by Czech banking apps (QR platba). */
export function spayd(opts: {
  iban?: string | null;
  amount: number;
  currency?: string;
  message?: string;
  recipient?: string | null;
  vs?: string | null;
}) {
  const iban = (opts.iban || "").replace(/\s+/g, "").toUpperCase();
  if (!iban) return null;
  const parts = [
    "SPD*1.0",
    `ACC:${iban}`,
    `AM:${opts.amount.toFixed(2)}`,
    `CC:${(opts.currency || "CZK").toUpperCase()}`,
  ];
  if (opts.recipient) parts.push(`RN:${sanitize(opts.recipient)}`);
  if (opts.vs) parts.push(`X-VS:${opts.vs.replace(/\D/g, "").slice(0, 10)}`);
  if (opts.message) parts.push(`MSG:${sanitize(opts.message)}`);
  return parts.join("*");
}

function sanitize(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[*]/g, " ")
    .slice(0, 60)
    .toUpperCase();
}
