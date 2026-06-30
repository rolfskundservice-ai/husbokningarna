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
  body{margin:0;padding:0;background:#0a0d14;font-family:system-ui,sans-serif}
  .wrap{max-width:560px;margin:32px auto;border-radius:16px;overflow:hidden}
  .badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;margin-right:4px}
  .badge-green{background:#14532d;color:#4ade80;border:1px solid #166534}
  .badge-blue{background:#1e3a5f;color:#60a5fa;border:1px solid #1d4ed8}
  @media screen and (max-width:600px){
    .wrap{margin:0!important;border-radius:0!important}
    .mob-pad{padding:18px 16px!important}
    .mob-hide{display:none!important}
  }
</style></head><body bgcolor="#0a0d14">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px" class="mob-pad">
<table class="wrap" width="560" cellpadding="0" cellspacing="0" bgcolor="#0e1320" style="border:1px solid #1e293b;border-radius:16px">
${content}
</table>
</td></tr></table>
</body></html>`;
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
    `display:block;padding:15px 12px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:700;text-align:center;color:#ffffff;background:${bg};letter-spacing:.01em`;

  const addBtns = [
    !params.numberOfBoats &&
      `<tr><td class="addon-td" style="padding:0 0 8px 0"><a class="addon-btn" href="${url("add-boat")}" style="${btnStyle("linear-gradient(135deg,#2563eb,#7c3aed)")}">🛥 Lägg till båt &nbsp;<span style="font-size:11px;font-weight:400;opacity:.8">1 750 kr</span></a></td></tr>`,
    !params.cleaning &&
      `<tr><td class="addon-td" style="padding:0 0 8px 0"><a class="addon-btn" href="${url("add-cleaning")}" style="${btnStyle("linear-gradient(135deg,#059669,#0d9488)")}">🧹 Beställ städning &nbsp;<span style="font-size:11px;font-weight:400;opacity:.8">2 200 kr</span></a></td></tr>`,
    !params.bedLinen &&
      `<tr><td class="addon-td" style="padding:0"><a class="addon-btn" href="${url("add-linen")}" style="${btnStyle("linear-gradient(135deg,#7c3aed,#a855f7)")}">🛏 Beställ lakan &nbsp;<span style="font-size:11px;font-weight:400;opacity:.8">220 kr</span></a></td></tr>`,
  ].filter(Boolean).join("\n");

  const tdLabel = `padding:12px 16px;font-size:13px;color:#94a3b8!important;border-bottom:1px solid #1e293b;width:42%`;
  const tdVal   = `padding:12px 16px;font-size:14px;font-weight:600;border-bottom:1px solid #1e293b`;

  const html = baseHtml(`
    <tr><td bgcolor="#1a2744" style="background:linear-gradient(135deg,#1e3a5f,#1a2744);padding:28px 28px 22px;border-radius:16px 16px 0 0">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#60a5fa!important">Bokningsbekräftelse</p>
      <p style="margin:0 0 6px;font-size:32px;font-weight:800;color:#ffffff!important;line-height:1">Välkommen!</p>
      <p style="margin:0;font-size:15px;color:#93c5fd!important">${params.guestName} — ${params.propertyName}</p>
    </td></tr>
    <tr><td bgcolor="#0e1320" style="padding:24px 28px" class="mob-pad">
      <p style="margin:0 0 20px;font-size:14px;color:#94a3b8!important;line-height:1.6">Vi ser fram emot ditt besök! Här är en sammanfattning av din bokning.</p>

      <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#111827" style="border-radius:10px;overflow:hidden;margin-bottom:16px">
        <tr>
          <td style="${tdLabel}"><span style="color:#94a3b8!important">📍 Stuga</span></td>
          <td style="${tdVal};color:#ffffff!important">${params.propertyName}</td>
        </tr><tr>
          <td style="${tdLabel}"><span style="color:#94a3b8!important">📅 Incheckning</span></td>
          <td style="${tdVal};color:#4ade80!important">${fmt(params.startDate)}</td>
        </tr><tr>
          <td style="padding:12px 16px;font-size:13px;color:#94a3b8!important"><span style="color:#94a3b8!important">📅 Utcheckning</span></td>
          <td style="padding:12px 16px;font-size:14px;font-weight:600;color:#f87171!important">${fmt(params.endDate)}</td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#111827" style="border-radius:10px;overflow:hidden;margin-bottom:24px">
        <tr>
          <td style="${tdLabel}"><span style="color:#94a3b8!important">👤 Antal personer</span></td>
          <td style="${tdVal};color:#e2e8f0!important">${params.numberOfPersons ?? "–"}</td>
        </tr><tr>
          <td style="padding:12px 16px;font-size:13px;color:#94a3b8!important${params.notes ? ";border-bottom:1px solid #1e293b" : ""}"><span style="color:#94a3b8!important">🛥 Tillval</span></td>
          <td style="padding:12px 16px;font-size:14px;color:#e2e8f0!important${params.notes ? ";border-bottom:1px solid #1e293b" : ""}">${extras}</td>
        </tr>${params.notes ? `<tr>
          <td style="padding:12px 16px;font-size:13px;color:#94a3b8!important"><span style="color:#94a3b8!important">📝 Övrigt</span></td>
          <td style="padding:12px 16px;font-size:14px;color:#e2e8f0!important">${params.notes}</td>
        </tr>` : ""}
      </table>

      ${addBtns ? `
      <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#13124a" style="border-radius:10px;overflow:hidden;border:1px solid #312e81">
        <tr><td style="padding:16px 20px 10px">
          <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#a5b4fc!important;letter-spacing:.08em;text-transform:uppercase">Vill du lägga till något?</p>
          <table width="100%" cellpadding="0" cellspacing="0">${addBtns}</table>
          <p style="margin:10px 0 0;font-size:12px;color:#64748b!important;line-height:1.5">Klicka på en knapp — ändringen syns direkt och bekräftas omedelbart.</p>
        </td></tr>
      </table>
      ` : `
      <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#052e16" style="border-radius:10px;border:1px solid #166534">
        <tr><td style="padding:14px;text-align:center;font-size:13px;color:#4ade80!important">✓ Alla tillval är redan bokade</td></tr>
      </table>
      `}
    </td></tr>
    <tr><td bgcolor="#060810" style="padding:16px 28px;text-align:center;font-size:12px;color:#475569!important;border-radius:0 0 16px 16px">
      Har du frågor? Svara på detta mail.
    </td></tr>
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
    <div class="header">
      <div class="logo">Ny bokning</div>
      <div class="title">${params.propertyName}</div>
    </div>
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
    <div class="footer">Bokningssystem — Automatisk avisering</div>
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
    <div style="margin-bottom:20px;padding:16px;background:rgba(255,255,255,0.03);border-radius:10px;border-left:3px solid #3b82f6">
      <div style="font-size:15px;font-weight:700;color:#fff;margin-bottom:10px">${c.propertyName}</div>
      <div class="row"><span class="label">Gäst</span><span class="val">${c.guestName ?? "–"}</span></div>
      <div class="row"><span class="label">Utcheckning</span><span class="val">${fmt(c.endDate)}</span></div>
      <div class="row"><span class="label">Antal personer</span><span class="val">${c.numberOfPersons ?? "–"}</span></div>
      <div class="row"><span class="label">Båtar att förbereda</span>
        <span class="val" style="color:${(c.numberOfBoats ?? 0) > 0 ? "#60a5fa" : "#94a3b8"}">${c.numberOfBoats ?? 0} st</span></div>
      <div class="row"><span class="label">Städning</span>
        <span class="val">${c.cleaning ? '<span class="badge badge-green">Ja</span>' : '<span style="color:#64748b">Nej</span>'}</span></div>
      <div class="row"><span class="label">Lakan</span>
        <span class="val">${c.bedLinen ? '<span class="badge badge-blue">Ja</span>' : '<span style="color:#64748b">Nej</span>'}</span></div>
      ${c.notes ? `<div class="row"><span class="label">Anteckning</span><span class="val">${c.notes}</span></div>` : ""}
    </div>
  `).join("");

  const html = baseHtml(`
    <div class="header">
      <div class="logo">Påminnelse inför imorgon</div>
      <div class="title">Incheckningar ${dateStr}</div>
    </div>
    <div class="body">
      <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.6">
        Hej Anton! Här är en sammanställning av morgondagens incheckningar. Kontrollera att allt är förberett.
      </p>
      ${rows}
    </div>
    <div class="footer">Bokningssystem — Automatisk daglig påminnelse</div>
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
