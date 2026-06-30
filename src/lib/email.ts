import nodemailer from "nodemailer";

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function fmt(isoStr: string) {
  return new Date(isoStr).toLocaleDateString("sv-SE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

// Rad i info-tabell
function row(label: string, value: string, valColor = "#e2e8f0", last = false) {
  const border = last ? "" : "border-bottom:1px solid #1e293b;";
  return `<tr>
    <td style="${border}padding:11px 16px;font-size:13px;color:#8899aa;width:42%">${label}</td>
    <td style="${border}padding:11px 16px;font-size:14px;font-weight:600;color:${valColor}">${value}</td>
  </tr>`;
}

// ── 1. Bekräftelsemail till GÄST ─────────────────────────────────────────────

export async function sendGuestConfirmation(params: {
  guestEmail: string;
  guestName: string;
  propertyName: string;
  startDate: string;
  endDate: string;
  numberOfPersons: number | null;
  numberOfBoats: number | null;
  cleaning: boolean;
  bedLinen: boolean;
  notes: string | null;
  bookingId: string;
  addonToken: string;
}) {
  const t = getTransporter();
  if (!t) return;

  const base = process.env.NEXTAUTH_URL ?? "";
  const url = (action: string) =>
    `${base}/api/bookings/${params.bookingId}/addon?token=${params.addonToken}&action=${action}`;

  const extras = [
    params.cleaning && "✓ Städning",
    params.bedLinen && "✓ Lakan",
    (params.numberOfBoats ?? 0) > 0 && `✓ ${params.numberOfBoats} båt${params.numberOfBoats !== 1 ? "ar" : ""}`,
  ].filter(Boolean).join("  ·  ") || "–";

  const btn = (href: string, bg: string, text: string, sub: string) =>
    `<tr><td style="padding:0 0 10px 0">
      <a href="${href}" style="display:block;padding:14px 16px;background:${bg};border-radius:10px;text-decoration:none;font-family:system-ui,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-align:center">
        ${text}<br><span style="font-size:12px;font-weight:400;color:#ffffffcc">${sub}</span>
      </a>
    </td></tr>`;

  const addBtns = [
    !params.numberOfBoats && btn(url("add-boat"), "#2563eb", "🛥 Lägg till båt", "1 750 kr"),
    !params.cleaning     && btn(url("add-cleaning"), "#059669", "🧹 Beställ städning", "2 200 kr"),
    !params.bedLinen     && btn(url("add-linen"), "#7c3aed", "🛏 Beställ lakan", "220 kr"),
  ].filter(Boolean).join("");

  const html = `<!DOCTYPE html>
<html lang="sv"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:0;background:#0f1117}@media screen and (max-width:600px){.wrap{width:100%!important}.pad{padding:20px 16px!important}}</style>
</head>
<body bgcolor="#0f1117">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table class="wrap" width="560" cellpadding="0" cellspacing="0" bgcolor="#0e1320" style="border-radius:16px;overflow:hidden;border:1px solid #1e293b">

  <!-- HEADER -->
  <tr><td bgcolor="#1a2744" style="padding:28px 32px 24px">
    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#60a5fa;font-family:system-ui,sans-serif">Bokningsbekräftelse</p>
    <p style="margin:0 0 6px;font-size:34px;font-weight:800;color:#ffffff;line-height:1.1;font-family:system-ui,sans-serif">Välkommen!</p>
    <p style="margin:0;font-size:15px;color:#93c5fd;font-family:system-ui,sans-serif">${params.guestName} — ${params.propertyName}</p>
  </td></tr>

  <!-- BODY -->
  <tr><td class="pad" style="padding:24px 32px" bgcolor="#0e1320">
    <p style="margin:0 0 20px;font-size:14px;color:#8899aa;line-height:1.6;font-family:system-ui,sans-serif">Vi ser fram emot ditt besök! Här är en sammanfattning av din bokning.</p>

    <!-- Datum-tabell -->
    <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#111827" style="border-radius:10px;margin-bottom:12px">
      ${row("📍 Stuga", params.propertyName, "#ffffff")}
      ${row("📅 Incheckning", fmt(params.startDate), "#4ade80")}
      ${row("📅 Utcheckning", fmt(params.endDate), "#f87171", true)}
    </table>

    <!-- Detalj-tabell -->
    <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#111827" style="border-radius:10px;margin-bottom:24px">
      ${row("👤 Antal personer", String(params.numberOfPersons ?? "–"), "#e2e8f0")}
      ${row("🛥 Tillval", extras, "#e2e8f0", !params.notes)}
      ${params.notes ? row("📝 Övrigt", params.notes, "#e2e8f0", true) : ""}
    </table>

    ${addBtns ? `
    <!-- Tillval-knappar -->
    <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#13124a" style="border-radius:10px;border:1px solid #312e81;margin-bottom:0">
      <tr><td style="padding:18px 20px 8px">
        <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:#a5b4fc;letter-spacing:.1em;text-transform:uppercase;font-family:system-ui,sans-serif">Vill du lägga till något?</p>
        <table width="100%" cellpadding="0" cellspacing="0">${addBtns}</table>
      </td></tr>
    </table>
    ` : `
    <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#052e16" style="border-radius:10px;border:1px solid #166534">
      <tr><td style="padding:14px;text-align:center;font-size:13px;color:#4ade80;font-family:system-ui,sans-serif">✓ Alla tillval är redan bokade</td></tr>
    </table>
    `}
  </td></tr>

  <!-- FOOTER -->
  <tr><td bgcolor="#060810" style="padding:16px 32px;text-align:center;font-size:12px;color:#4b5563;font-family:system-ui,sans-serif;border-top:1px solid #1e293b">
    Har du frågor? Svara på detta mail.
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  await t.sendMail({
    from: `"Bokningssystem" <${process.env.SMTP_USER}>`,
    to: params.guestEmail,
    subject: `Bokningsbekräftelse — ${params.propertyName} ${fmt(params.startDate)}`,
    html,
  });
}

// ── 2. Avisering till ÄGARE ──────────────────────────────────────────────────

export async function sendOwnerNotification(params: {
  propertyName: string;
  startDate: string;
  endDate: string;
  guestName: string | null;
  guestEmail: string | null;
  numberOfPersons: number | null;
  numberOfBoats: number | null;
  cleaning: boolean;
  bedLinen: boolean;
  notes: string | null;
  bookedBy: string;
}) {
  const t = getTransporter();
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!t || !ownerEmail) return;

  const extras = [params.cleaning && "Städning", params.bedLinen && "Lakan"]
    .filter(Boolean).join(", ") || "Inga";

  const simpleRow = (label: string, value: string, last = false) => row(label, value, "#e2e8f0", last);

  const html = `<!DOCTYPE html>
<html lang="sv"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:0;background:#0f1117}</style>
</head>
<body bgcolor="#0f1117">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table width="560" cellpadding="0" cellspacing="0" bgcolor="#0e1320" style="border-radius:16px;overflow:hidden;border:1px solid #1e293b">
  <tr><td bgcolor="#1a2744" style="padding:24px 32px">
    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#60a5fa;font-family:system-ui,sans-serif">Ny bokning</p>
    <p style="margin:0;font-size:24px;font-weight:700;color:#ffffff;font-family:system-ui,sans-serif">${params.propertyName}</p>
  </td></tr>
  <tr><td style="padding:24px 32px" bgcolor="#0e1320">
    <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#111827" style="border-radius:10px">
      ${simpleRow("Gäst", params.guestName ?? "–")}
      ${params.guestEmail ? simpleRow("E-post", params.guestEmail) : ""}
      ${simpleRow("Incheckning", fmt(params.startDate))}
      ${simpleRow("Utcheckning", fmt(params.endDate))}
      ${simpleRow("Antal personer", String(params.numberOfPersons ?? "–"))}
      ${simpleRow("Antal båtar", `${params.numberOfBoats ?? 0} st`)}
      ${simpleRow("Tillval", extras)}
      ${params.notes ? simpleRow("Anteckning", params.notes) : ""}
      ${simpleRow("Bokad av", params.bookedBy, true)}
    </table>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  await t.sendMail({
    from: `"Bokningssystem" <${process.env.SMTP_USER}>`,
    to: ownerEmail,
    subject: `Ny bokning: ${params.propertyName} — ${params.guestName ?? "okänd gäst"}`,
    html,
  });
}

// ── 3. Daglig påminnelse till ANTON ─────────────────────────────────────────

export async function sendCaretakerReminder(checkins: Array<{
  propertyName: string;
  startDate: string;
  endDate: string;
  guestName: string | null;
  numberOfPersons: number | null;
  numberOfBoats: number | null;
  cleaning: boolean;
  bedLinen: boolean;
  notes: string | null;
}>) {
  const t = getTransporter();
  const caretakerEmail = process.env.CARETAKER_EMAIL;
  if (!t || !caretakerEmail || checkins.length === 0) return;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toLocaleDateString("sv-SE", {
    weekday: "long", day: "numeric", month: "long",
  });

  const checkinRows = checkins.map(c => `
    <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#111827" style="border-radius:10px;margin-bottom:16px;border-left:4px solid #3b82f6">
      <tr><td colspan="2" style="padding:12px 16px 8px;font-size:15px;font-weight:700;color:#ffffff;font-family:system-ui,sans-serif;border-bottom:1px solid #1e293b">${c.propertyName}</td></tr>
      ${row("Gäst", c.guestName ?? "–")}
      ${row("Utcheckning", fmt(c.endDate))}
      ${row("Antal personer", String(c.numberOfPersons ?? "–"))}
      ${row("Båtar", `${c.numberOfBoats ?? 0} st`, (c.numberOfBoats ?? 0) > 0 ? "#60a5fa" : "#8899aa")}
      ${row("Städning", c.cleaning ? "Ja" : "Nej", c.cleaning ? "#4ade80" : "#8899aa")}
      ${row("Lakan", c.bedLinen ? "Ja" : "Nej", c.bedLinen ? "#4ade80" : "#8899aa", !c.notes)}
      ${c.notes ? row("Anteckning", c.notes, "#e2e8f0", true) : ""}
    </table>
  `).join("");

  const html = `<!DOCTYPE html>
<html lang="sv"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:0;background:#0f1117}</style>
</head>
<body bgcolor="#0f1117">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
<table width="560" cellpadding="0" cellspacing="0" bgcolor="#0e1320" style="border-radius:16px;overflow:hidden;border:1px solid #1e293b">
  <tr><td bgcolor="#1a2744" style="padding:24px 32px">
    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#60a5fa;font-family:system-ui,sans-serif">Påminnelse</p>
    <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;font-family:system-ui,sans-serif">Incheckningar ${dateStr}</p>
  </td></tr>
  <tr><td style="padding:24px 32px" bgcolor="#0e1320">
    <p style="margin:0 0 20px;font-size:14px;color:#8899aa;line-height:1.6;font-family:system-ui,sans-serif">Hej Anton! Här är morgondagens incheckningar. Kontrollera att allt är förberett.</p>
    ${checkinRows}
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  await t.sendMail({
    from: `"Bokningssystem" <${process.env.SMTP_USER}>`,
    to: caretakerEmail,
    subject: `Incheckningar imorgon ${dateStr} — ${checkins.length} stuga${checkins.length !== 1 ? "r" : ""}`,
    html,
  });
}

// Bakåtkompatibilitet
export async function sendBookingNotification(_params: {
  propertyName: string; weekLabel: string; guestName: string | null;
  bookedBy: string; notes: string | null;
}) {}
