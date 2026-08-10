const ELKS_URL = "https://api.46elks.com/a1/sms";

function getElksAuth(): string | null {
  const user = process.env.ELKS_API_USER;
  const pass = process.env.ELKS_API_PASSWORD;
  if (!user || !pass) return null;
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

export async function sendSms(to: string, message: string): Promise<void> {
  const auth = getElksAuth();
  if (!auth) return;

  const phone = to.startsWith("+") ? to : `+46${to.replace(/^0/, "")}`;

  const body = new URLSearchParams({
    from: "Husbokn",
    to: phone,
    message,
  });

  await fetch(ELKS_URL, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

export async function sendSmsToMany(phones: string[], message: string): Promise<void> {
  await Promise.allSettled(phones.map((p) => sendSms(p, message)));
}
