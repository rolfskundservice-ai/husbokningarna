import nodemailer from "nodemailer";

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendBookingNotification({
  propertyName,
  weekLabel,
  guestName,
  bookedBy,
  notes,
}: {
  propertyName: string;
  weekLabel: string;
  guestName: string | null;
  bookedBy: string;
  notes: string | null;
}) {
  const { SMTP_TO, SMTP_FROM } = process.env;
  const transporter = getTransporter();
  if (!transporter || !SMTP_TO) return;

  const guest = guestName ? ` för **${guestName}**` : "";
  const noteStr = notes ? `\n\nAnteckning: ${notes}` : "";

  await transporter.sendMail({
    from: SMTP_FROM ?? SMTP_TO,
    to: SMTP_TO,
    subject: `Ny bokning: ${propertyName} – ${weekLabel}`,
    text: `${bookedBy} har bokat ${weekLabel} på ${propertyName}${guest}.${noteStr}`,
    html: `
      <p><strong>${bookedBy}</strong> har bokat <strong>${weekLabel}</strong> på <strong>${propertyName}</strong>${guest.replace(/\*\*/g, "")}.</p>
      ${notes ? `<p>Anteckning: ${notes}</p>` : ""}
    `,
  });
}
