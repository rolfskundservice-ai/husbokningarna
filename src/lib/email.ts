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

function baseHtml(content: string) {
  return `<!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#0a0d14;font-family:system-ui,sans-serif;color:#e2e8f0}
  .wrap{max-width:560px;margin:32px auto;background:#0e1320;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)}
  .body{padding:24px 28px}
  .row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:14px;gap:12px}
  .row .label{color:#94a3b8;flex-shrink:0}
  .row .val{color:#e2e8f0;font-weight:500;text-align:right}
  .badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;margin-right:4px}
  .badge-green{background:#14532d;color:#4ade80;border:1px solid #166534}
  .badge-blue{background:#1e3a5f;color:#60a5fa;border:1px solid #1d4ed8}
  .footer{padding:18px 28px;background:rgba(0,0,0,0.2);font-size:12px;color:#475569;text-align:center}
  @media screen and (max-width:600px){
    .wrap{margin:0!important;border-radius:0!important;width:100%!important}
    .hdr{padding:22px 18px 18px!important}
    .body{padding:18px 16px!important}
    .footer{padding:12px 16px!important}
  }
</style></head><body><div class="wrap">${content}</div></body></html>`;
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
    params.cleaning && `<span class="badge badge-green">✓ Städning</span>`,
    params.bedLinen && `<span class="badge badge-blue">✓ Lakan</span>`,
    (params.numberOfBoats ?? 0) > 0 &&
      `<span class="badge badge-blue">✓ ${params.numberOfBoats} båt${params.numberOfBoats !== 1 ? "ar" : ""}</span>`,
  ].filter(Boolean).join(" ") || "–";

  const btnStyle = (bg: string) =>
    `display:block;padding:15px 12px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:700;text-align:center;color:#ffffff;background:${bg}`;

  const addBtns = [
    !params.numberOfBoats &&
      `<tr><td style="padding:0 0 8px 0"><a href="${url("add-boat")}" style="${btnStyle("#2563eb")}">🛥 Lägg till båt<br><span style="font-size:12px;font-weight:400;color:#ffffffcc">1 750 kr</span></a></td></tr>`,
    !params.cleaning &&
      `<tr><td style="padding:0 0 8px 0"><a href="${url("add-cleaning")}" style="${btnStyle("#059669")}">🧹 Beställ städning<br><span style="font-size:12px;font-weight:400;color:#ffffffcc">2 200 kr</span></a></td></tr>`,
    !params.bedLinen &&
      `<tr><td style="padding:0"><a href="${url("add-linen")}" style="${btnStyle("#7c3aed")}">🛏 Beställ lakan<br><span style="font-size:12px;font-weight:400;color:#ffffffcc">220 kr</span></a></td></tr>`,
  ].filter(Boolean).join("\n");

  const html = baseHtml(`
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td class="hdr" bgcolor="#1a2744" style="padding:28px 28px 22px;background:linear-gradient(135deg,#1e3a5f,#1a2744)">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#60a5fa">Bokningsbekräftelse</p>
        <p style="margin:0 0 6px;font-size:32px;font-weight:800;color:#ffffff;line-height:1.1">Välkommen!</p>
        <p style="margin:0;font-size:15px;color:#93c5fd">${params.guestName} — ${params.propertyName}</p>
      </td>
    </tr></table>
    <div class="body">
      <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.6">Vi ser fram emot ditt besök! Här är en sammanfattning av din bokning.</p>

      <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#111827" style="border-radius:10px;margin-bottom:12px">
        <tr><td style="padding:12px 16px;font-size:13px;color:#94a3b8;border-bottom:1px solid #1e293b;width:42%">📍 Stuga</td>
            <td style="padding:12px 16px;font-size:14px;font-weight:600;color:#ffffff;border-bottom:1px solid #1e293b">${params.propertyName}</td></tr>
        <tr><td style="padding:12px 16px;font-size:13px;color:#94a3b8;border-bottom:1px solid #1e293b">📅 Incheckning</td>
            <td style="padding:12px 16px;font-size:14px;font-weight:600;color:#4ade80;border-bottom:1px solid #1e293b">${fmt(params.startDate)}</td></tr>
        <tr><td style="padding:12px 16px;font-size:13px;color:#94a3b8">📅 Utcheckning</td>
            <td style="padding:12px 16px;font-size:14px;font-weight:600;color:#f87171">${fmt(params.endDate)}</td></tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#111827" style="border-radius:10px;margin-bottom:24px">
        <tr><td style="padding:11px 16px;font-size:13px;color:#94a3b8;border-bottom:1px solid #1e293b;width:42%">👤 Antal personer</td>
            <td style="padding:11px 16px;font-size:14px;color:#e2e8f0;border-bottom:1px solid #1e293b">${params.numberOfPersons ?? "–"}</td></tr>
        <tr><td style="padding:11px 16px;font-size:13px;color:#94a3b8${params.notes ? ";border-bottom:1px solid #1e293b" : ""}">🛥 Tillval</td>
            <td style="padding:11px 16px;font-size:14px;color:#e2e8f0${params.notes ? ";border-bottom:1px solid #1e293b" : ""}">${extras}</td></tr>
        ${params.notes ? `<tr><td style="padding:11px 16px;font-size:13px;color:#94a3b8">📝 Övrigt</td>
            <td style="padding:11px 16px;font-size:14px;color:#e2e8f0">${params.notes}</td></tr>` : ""}
      </table>

      ${addBtns ? `
      <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#13124a" style="border-radius:10px;border:1px solid #312e81">
        <tr><td style="padding:18px 20px 10px">
          <p style="margin:0 0 14px;font-size:11px;font-weight:700;color:#a5b4fc;letter-spacing:.08em;text-transform:uppercase">Vill du lägga till något?</p>
          <table width="100%" cellpadding="0" cellspacing="0">${addBtns}</table>
        </td></tr>
      </table>
      ` : `
      <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#052e16" style="border-radius:10px;border:1px solid #166534">
        <tr><td style="padding:14px;text-align:center;font-size:13px;color:#4ade80">✓ Alla tillval är redan bokade</td></tr>
      </table>
      `}
    </div>
    <div class="footer">Har du frågor? Svara på detta mail.</div>
  `);

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

  const html = baseHtml(`
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td bgcolor="#1a2744" style="padding:24px 28px;background:linear-gradient(135deg,#1e3a5f,#1a2744)">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#60a5fa">Ny bokning</p>
        <p style="margin:0;font-size:24px;font-weight:700;color:#ffffff">${params.propertyName}</p>
      </td>
    </tr></table>
    <div class="body">
      <div class="row"><span class="label">Gäst</span><span class="val">${params.guestName ?? "–"}</span></div>
      ${params.guestEmail ? `<div class="row"><span class="label">E-post</span><span class="val">${params.guestEmail}</span></div>` : ""}
      <div class="row"><span class="label">Incheckning</span><span class="val">${fmt(params.startDate)}</span></div>
      <div class="row"><span class="label">Utcheckning</span><span class="val">${fmt(params.endDate)}</span></div>
      <div class="row"><span class="label">Antal personer</span><span class="val">${params.numberOfPersons ?? "–"}</span></div>
      <div class="row"><span class="label">Antal båtar</span><span class="val">${params.numberOfBoats ?? 0} st</span></div>
      <div class="row"><span class="label">Tillval</span><span class="val">${extras}</span></div>
      ${params.notes ? `<div class="row"><span class="label">Anteckning</span><span class="val">${params.notes}</span></div>` : ""}
      <div class="row"><span class="label">Bokad av</span><span class="val">${params.bookedBy}</span></div>
    </div>
    <div class="footer">Bokningssystem</div>
  `);

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

  const rows = checkins.map(c => `
    <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#111827" style="border-radius:10px;margin-bottom:16px;border-left:4px solid #3b82f6">
      <tr><td colspan="2" style="padding:12px 16px;font-size:15px;font-weight:700;color:#ffffff;border-bottom:1px solid #1e293b">${c.propertyName}</td></tr>
      <tr><td style="padding:10px 16px;font-size:13px;color:#94a3b8;border-bottom:1px solid #1e293b;width:45%">Gäst</td>
          <td style="padding:10px 16px;font-size:14px;color:#e2e8f0;border-bottom:1px solid #1e293b">${c.guestName ?? "–"}</td></tr>
      <tr><td style="padding:10px 16px;font-size:13px;color:#94a3b8;border-bottom:1px solid #1e293b">Utcheckning</td>
          <td style="padding:10px 16px;font-size:14px;color:#e2e8f0;border-bottom:1px solid #1e293b">${fmt(c.endDate)}</td></tr>
      <tr><td style="padding:10px 16px;font-size:13px;color:#94a3b8;border-bottom:1px solid #1e293b">Antal personer</td>
          <td style="padding:10px 16px;font-size:14px;color:#e2e8f0;border-bottom:1px solid #1e293b">${c.numberOfPersons ?? "–"}</td></tr>
      <tr><td style="padding:10px 16px;font-size:13px;color:#94a3b8;border-bottom:1px solid #1e293b">Båtar</td>
          <td style="padding:10px 16px;font-size:14px;color:${(c.numberOfBoats ?? 0) > 0 ? "#60a5fa" : "#94a3b8"};border-bottom:1px solid #1e293b">${c.numberOfBoats ?? 0} st</td></tr>
      <tr><td style="padding:10px 16px;font-size:13px;color:#94a3b8;border-bottom:1px solid #1e293b">Städning</td>
          <td style="padding:10px 16px;font-size:14px;color:${c.cleaning ? "#4ade80" : "#94a3b8"};border-bottom:1px solid #1e293b">${c.cleaning ? "Ja" : "Nej"}</td></tr>
      <tr><td style="padding:10px 16px;font-size:13px;color:#94a3b8${c.notes ? ";border-bottom:1px solid #1e293b" : ""}">Lakan</td>
          <td style="padding:10px 16px;font-size:14px;color:${c.bedLinen ? "#4ade80" : "#94a3b8"}${c.notes ? ";border-bottom:1px solid #1e293b" : ""}">${c.bedLinen ? "Ja" : "Nej"}</td></tr>
      ${c.notes ? `<tr><td style="padding:10px 16px;font-size:13px;color:#94a3b8">Anteckning</td>
          <td style="padding:10px 16px;font-size:14px;color:#e2e8f0">${c.notes}</td></tr>` : ""}
    </table>
  `).join("");

  const html = baseHtml(`
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td bgcolor="#1a2744" style="padding:24px 28px;background:linear-gradient(135deg,#1e3a5f,#1a2744)">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#60a5fa">Påminnelse</p>
        <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff">Incheckningar ${dateStr}</p>
      </td>
    </tr></table>
    <div class="body">
      <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.6">Hej Anton! Här är morgondagens incheckningar. Kontrollera att allt är förberett.</p>
      ${rows}
    </div>
  `);

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
