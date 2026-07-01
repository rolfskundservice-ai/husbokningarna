import { Resend } from "resend";

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = process.env.RESEND_FROM ?? "Bokningssystem <onboarding@resend.dev>";

function fmt(isoStr: string) {
  return new Date(isoStr).toLocaleDateString("sv-SE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function baseHtml(content: string) {
  return `<!DOCTYPE html><html lang="sv" style="color-scheme:light dark"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
  body,table,td{font-family:system-ui,Arial,sans-serif}
  .badge-green{background:#14532d;color:#4ade80 !important;border:1px solid #166534;display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;margin-right:4px}
  .badge-blue{background:#1e3a5f;color:#60a5fa !important;border:1px solid #1d4ed8;display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;margin-right:4px}
  @media screen and (max-width:600px){
    .outer{padding:0!important}
    .wrap{width:100%!important;border-radius:0!important}
    .hdr{padding:20px 16px 16px!important;background-color:#1a2744!important}
    .bdy{padding:16px!important}
    .hdr-title{color:#ffffff!important;-webkit-text-fill-color:#ffffff!important}
    .hdr-sub{color:#93c5fd!important;-webkit-text-fill-color:#93c5fd!important}
    .hdr-label{color:#60a5fa!important;-webkit-text-fill-color:#60a5fa!important}
  }
  /* Gmail iOS: åsidosätt Gmails auto-konvertering */
  [data-ogsc] .d-bg   { background-color:#0e1320 !important }
  [data-ogsc] .d-hdr  { background-color:#1a2744 !important }
  [data-ogsc] .d-card { background-color:#111827 !important }
  [data-ogsc] .d-addon{ background-color:#13124a !important }
  [data-ogsc] .d-foot { background-color:#060810 !important }
  [data-ogsc] .d-wrap { background-color:#0e1320 !important }
  [data-ogsc] .c-wht  { color:#ffffff !important }
  [data-ogsc] .c-blue { color:#60a5fa !important }
  [data-ogsc] .c-lblue{ color:#93c5fd !important }
  [data-ogsc] .c-gray { color:#94a3b8 !important }
  [data-ogsc] .c-lgray{ color:#4b5563 !important }
  [data-ogsc] .c-green{ color:#4ade80 !important }
  [data-ogsc] .c-red  { color:#f87171 !important }
  [data-ogsc] .c-pale { color:#e2e8f0 !important }
  [data-ogsc] .c-indig{ color:#a5b4fc !important }
  [data-ogsc] .btn-b  { background-color:#2563eb !important; color:#ffffff !important }
  [data-ogsc] .btn-g  { background-color:#059669 !important; color:#ffffff !important }
  [data-ogsc] .btn-p  { background-color:#7c3aed !important; color:#ffffff !important }
</style></head>
<body bgcolor="#0a0d14" style="margin:0;padding:0;background:#0a0d14">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td class="outer" align="center" bgcolor="#0a0d14" style="padding:24px 12px">
<table class="wrap" width="560" cellpadding="0" cellspacing="0" bgcolor="#0e1320" style="border-radius:16px;overflow:hidden">
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
  const r = getResend();
  if (!r) return;

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
    `display:block;padding:15px 16px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:700;text-align:center;color:#ffffff;background:${bg}`;

  const addBtns = [
    !params.numberOfBoats &&
      `<tr><td style="padding:0 0 10px 0"><a href="${url("add-boat")}" class="btn-b" style="${btnStyle("#2563eb")}">🛥 Lägg till båt &nbsp;<span style="font-weight:400;font-size:13px;color:#ffffff">1 750 kr</span></a></td></tr>`,
    !params.cleaning &&
      `<tr><td style="padding:0 0 10px 0"><a href="${url("add-cleaning")}" class="btn-g" style="${btnStyle("#059669")}">🧹 Beställ städning &nbsp;<span style="font-weight:400;font-size:13px;color:#ffffff">2 200 kr</span></a></td></tr>`,
    !params.bedLinen &&
      `<tr><td style="padding:0"><a href="${url("add-linen")}" class="btn-p" style="${btnStyle("#7c3aed")}">🛏 Beställ lakan &nbsp;<span style="font-weight:400;font-size:13px;color:#ffffff">220 kr</span></a></td></tr>`,
  ].filter(Boolean).join("\n");

  const html = baseHtml(`
    <tr><td class="hdr d-hdr" bgcolor="#1a2744" style="padding:28px 28px 22px;background-color:#1a2744;border-radius:16px 16px 0 0">
      <p class="c-blue hdr-label" style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#60a5fa">Bokningsbekräftelse</p>
      <p class="c-wht hdr-title" style="margin:0 0 6px;font-size:32px;font-weight:800;color:#ffffff;line-height:1.1">Välkommen!</p>
      <p class="c-lblue hdr-sub" style="margin:0;font-size:15px;color:#93c5fd">${params.guestName} — ${params.propertyName}</p>
    </td></tr>
    <tr><td class="bdy d-bg" bgcolor="#0e1320" style="padding:24px 28px;background-color:#0e1320">
      <p class="c-gray" style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.6">Vi ser fram emot ditt besök! Här är en sammanfattning av din bokning.</p>

      <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#111827" style="border-radius:10px;margin-bottom:12px">
        <tr><td class="d-card c-gray" style="padding:12px 16px;font-size:13px;color:#94a3b8;border-bottom:1px solid #1e293b;width:42%;background-color:#111827">📍 Stuga</td>
            <td class="d-card c-wht" style="padding:12px 16px;font-size:14px;font-weight:600;color:#ffffff;border-bottom:1px solid #1e293b;background-color:#111827">${params.propertyName}</td></tr>
        <tr><td class="d-card c-gray" style="padding:12px 16px;font-size:13px;color:#94a3b8;border-bottom:1px solid #1e293b;background-color:#111827">📅 Incheckning</td>
            <td class="d-card c-green" style="padding:12px 16px;font-size:14px;font-weight:600;color:#4ade80;border-bottom:1px solid #1e293b;background-color:#111827">${fmt(params.startDate)}</td></tr>
        <tr><td class="d-card c-gray" style="padding:12px 16px;font-size:13px;color:#94a3b8;background-color:#111827">📅 Utcheckning</td>
            <td class="d-card c-red" style="padding:12px 16px;font-size:14px;font-weight:600;color:#f87171;background-color:#111827">${fmt(params.endDate)}</td></tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#111827" style="border-radius:10px;margin-bottom:24px">
        <tr><td class="d-card c-gray" style="padding:11px 16px;font-size:13px;color:#94a3b8;border-bottom:1px solid #1e293b;width:42%;background-color:#111827">👤 Antal personer</td>
            <td class="d-card c-pale" style="padding:11px 16px;font-size:14px;color:#e2e8f0;border-bottom:1px solid #1e293b;background-color:#111827">${params.numberOfPersons ?? "–"}</td></tr>
        <tr><td class="d-card c-gray" style="padding:11px 16px;font-size:13px;color:#94a3b8${params.notes ? ";border-bottom:1px solid #1e293b" : ""};background-color:#111827">🛥 Tillval</td>
            <td class="d-card c-pale" style="padding:11px 16px;font-size:14px;color:#e2e8f0${params.notes ? ";border-bottom:1px solid #1e293b" : ""};background-color:#111827">${extras}</td></tr>
        ${params.notes ? `<tr><td class="d-card c-gray" style="padding:11px 16px;font-size:13px;color:#94a3b8;background-color:#111827">📝 Övrigt</td>
            <td class="d-card c-pale" style="padding:11px 16px;font-size:14px;color:#e2e8f0;background-color:#111827">${params.notes}</td></tr>` : ""}
      </table>

      ${addBtns ? `
      <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#13124a" style="border-radius:10px;border:1px solid #312e81">
        <tr><td class="d-addon" style="padding:18px 20px 10px;background-color:#13124a">
          <p class="c-indig" style="margin:0 0 14px;font-size:11px;font-weight:700;color:#a5b4fc;letter-spacing:.08em;text-transform:uppercase">Vill du lägga till något?</p>
          <table width="100%" cellpadding="0" cellspacing="0">${addBtns}</table>
        </td></tr>
      </table>
      ` : `
      <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#052e16" style="border-radius:10px;border:1px solid #166534">
        <tr><td class="c-green" style="padding:14px;text-align:center;font-size:13px;color:#4ade80">✓ Alla tillval är redan bokade</td></tr>
      </table>
      `}
    </td></tr>
    <tr><td class="d-foot c-lgray" bgcolor="#060810" style="background-color:#060810;padding:16px 28px;text-align:center;font-size:12px;color:#4b5563;border-top:1px solid #1e293b">Har du frågor? Svara på detta mail.</td></tr>
  `);

  await r.emails.send({
    from: FROM,
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
  const r = getResend();
  const ownerEmail = process.env.OWNER_EMAIL;
  if (!r || !ownerEmail) return;

  const extras = [params.cleaning && "Städning", params.bedLinen && "Lakan"]
    .filter(Boolean).join(", ") || "Inga";

  const html = baseHtml(`
    <tr><td class="hdr" bgcolor="#1a2744" style="padding:24px 28px;background:linear-gradient(135deg,#1e3a5f,#1a2744);border-radius:16px 16px 0 0">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#60a5fa">Ny bokning</p>
      <p style="margin:0;font-size:24px;font-weight:700;color:#ffffff">${params.propertyName}</p>
    </td></tr>
    <tr><td class="bdy" bgcolor="#0e1320" style="padding:24px 28px">
      <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#111827" style="border-radius:10px">
        ${[
          ["Gäst", params.guestName ?? "–"],
          ...(params.guestEmail ? [["E-post", params.guestEmail]] : []),
          ["Incheckning", fmt(params.startDate)],
          ["Utcheckning", fmt(params.endDate)],
          ["Antal personer", String(params.numberOfPersons ?? "–")],
          ["Antal båtar", `${params.numberOfBoats ?? 0} st`],
          ["Tillval", extras],
          ...(params.notes ? [["Anteckning", params.notes]] : []),
          ["Bokad av", params.bookedBy],
        ].map(([l, v], i, arr) => `<tr>
          <td style="padding:11px 16px;font-size:13px;color:#94a3b8;width:42%${i < arr.length-1 ? ";border-bottom:1px solid #1e293b" : ""}">${l}</td>
          <td style="padding:11px 16px;font-size:14px;color:#e2e8f0;font-weight:500${i < arr.length-1 ? ";border-bottom:1px solid #1e293b" : ""}">${v}</td>
        </tr>`).join("")}
      </table>
    </td></tr>
    <tr><td bgcolor="#060810" style="padding:14px 28px;text-align:center;font-size:12px;color:#4b5563">Bokningssystem</td></tr>
  `);

  await r.emails.send({
    from: FROM,
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
  const r = getResend();
  const caretakerEmail = process.env.CARETAKER_EMAIL;
  if (!r || !caretakerEmail || checkins.length === 0) return;

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
    <tr><td class="hdr" bgcolor="#1a2744" style="padding:24px 28px;background:linear-gradient(135deg,#1e3a5f,#1a2744);border-radius:16px 16px 0 0">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#60a5fa">Påminnelse</p>
      <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff">Incheckningar ${dateStr}</p>
    </td></tr>
    <tr><td class="bdy" bgcolor="#0e1320" style="padding:24px 28px">
      <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.6">Hej Anton! Här är morgondagens incheckningar. Kontrollera att allt är förberett.</p>
      ${rows}
    </td></tr>
  `);

  await r.emails.send({
    from: FROM,
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
