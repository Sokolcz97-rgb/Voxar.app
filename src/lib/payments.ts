/** Helpers for PayPal links and Czech "QR platba" (SPAYD) payloads. */

export function paypalLink(opts: {
  paypalMe?: string | null;
  paypalEmail?: string | null;
  amount: number;
  currency?: string;
  note?: string;
}) {
  const currency = opts.currency || "CZK";
  const me = (opts.paypalMe || "").trim().replace(/^https?:\/\/(www\.)?paypal\.me\//i, "").replace(/^@/, "");
  if (me) {
    return `https://www.paypal.com/paypalme/${encodeURIComponent(me)}/${opts.amount}${currency}`;
  }
  const email = (opts.paypalEmail || "").trim();
  if (!email) return null;
  const params = new URLSearchParams({
    cmd: "_donations",
    business: email,
    currency_code: currency,
    amount: String(opts.amount),
    item_name: opts.note || "Podpora projektu",
  });
  return `https://www.paypal.com/cgi-bin/webscr?${params.toString()}`;
}

/** Build a SPAYD string readable by Czech banking apps (QR platba). */
export function spayd(opts: {
  iban?: string | null;
  amount: number;
  currency?: string;
  message?: string;
  recipient?: string | null;
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
