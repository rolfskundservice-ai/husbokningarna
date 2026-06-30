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
  .wrap{max-width:560px;margin:40px auto;background:#0e1320;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08)}
  .header{background:linear-gradient(135deg,#1e3a5f,#1a1f3a);padding:32px 32px 24px;border-bottom:1px solid rgba(255,255,255,0.07)}
  .logo{font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#60a5fa;margin-bottom:8px}
  .title{font-size:22px;font-weight:700;color:#fff;margin:0}
  .body{padding:28px 32px}
  .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:14px}
  .row .label{color:#94a3b8}
  .row .val{color:#e2e8f0;font-weight:500;text-align:right}
  .badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;margin-right:4px}
  .badge-green{background:rgba(34,197,94,0.15);color:#4ade80;border:1px solid rgba(34,197,94,0.3)}
  .badge-blue{background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3)}
  .btn-row{margin:24px 0 8px;display:flex;gap:12px;flex-wrap:wrap}
  .btn{display:inline-block;padding:13px 22px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600;text-align:center}
  .btn-primary{background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff}
  .btn-secondary{background:rgba(255,255,255,0.07);color:#cbd5e1;border:1px solid rgba(255,255,255,0.1)}
  .btn-green{background:linear-gradient(135deg,#059669,#0d9488);color:#fff}
  .note{margin-top:20px;padding:14px;background:rgba(255,255,255,0.03);border-radius:8px;border-left:3px solid #3b82f6;font-size:13px;color:#94a3b8;line-height:1.5}
  .footer{padding:20px 32px;background:rgba(0,0,0,0.2);font-size:12px;color:#475569;text-align:center}
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

  const addBtns = [
    !params.numberOfBoats &&
      `<a href="${url("add-boat")}" class="btn btn-primary">+ Lägg till båt</a>`,
    !params.cleaning &&
      `<a href="${url("add-cleaning")}" class="btn btn-green">+ Beställ städning</a>`,
    !params.bedLinen &&
      `<a href="${url("add-linen")}" class="btn btn-secondary">+ Beställ lakan</a>`,
  ].filter(Boolean).join("\n");

  const html = baseHtml(`
    <div class="header">
      <div class="logo">Bokningsbekräftelse</div>
      <div class="title" style="font-size:28px;color:#ffffff">Välkommen!</div>
      <div style="margin-top:6px;font-size:15px;color:#93c5fd">${params.guestName} — ${params.propertyName}</div>
    </div>
    <div class="body">
      <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.6">
        Vi ser fram emot ditt besök! Här är en sammanfattning av din bokning.
      </p>

      <div style="background:rgba(59,130,246,0.08);border-radius:12px;padding:4px 0;margin-bottom:24px">
        <div class="row" style="padding:12px 16px"><span class="label">📍 Stuga</span><span class="val" style="color:#fff;font-size:15px">${params.propertyName}</span></div>
        <div class="row" style="padding:12px 16px"><span class="label">📅 Incheckning</span><span class="val" style="color:#4ade80">${fmt(params.startDate)}</span></div>
        <div class="row" style="padding:12px 16px;border:none"><span class="label">📅 Utcheckning</span><span class="val" style="color:#f87171">${fmt(params.endDate)}</span></div>
      </div>

      <div style="background:rgba(255,255,255,0.03);border-radius:12px;padding:4px 0;margin-bottom:24px">
        <div class="row" style="padding:10px 16px"><span class="label">👤 Antal personer</span><span class="val">${params.numberOfPersons ?? "–"}</span></div>
        <div class="row" style="padding:10px 16px;border:none"><span class="label">🛥 Tillval</span><span class="val">${extras}</span></div>
        ${params.notes ? `<div class="row" style="padding:10px 16px;border:none"><span class="label">📝 Övrigt</span><span class="val">${params.notes}</span></div>` : ""}
      </div>

      ${addBtns ? `
      <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:12px;padding:20px">
        <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#a5b4fc;letter-spacing:.05em;text-transform:uppercase">Vill du lägga till något?</p>
        <div class="btn-row" style="margin:0">${addBtns}</div>
        <p style="margin:14px 0 0;font-size:12px;color:#64748b;line-height:1.5">Klicka på en knapp — ändringen syns direkt i systemet och bekräftas omedelbart.</p>
      </div>
      ` : `
      <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:16px;text-align:center">
        <p style="margin:0;font-size:13px;color:#4ade80">✓ Alla tillval är redan bokade</p>
      </div>
      `}
    </div>
    <div class="footer">${params.propertyName} • Har du frågor? Svara på detta mail.</div>
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
