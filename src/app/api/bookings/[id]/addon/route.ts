import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const ACTIONS: Record<string, object> = {
  "add-boat":     { numberOfBoats: 1 },
  "add-cleaning": { cleaning: true },
  "add-linen":    { bedLinen: true },
};

function successHtml(message: string) {
  return new Response(
    `<!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
           background:#0a0d14;font-family:system-ui,sans-serif;color:#e2e8f0}
      .card{background:#0e1320;border:1px solid rgba(255,255,255,0.08);border-radius:16px;
            padding:40px 48px;text-align:center;max-width:400px}
      .icon{font-size:48px;margin-bottom:16px}
      h1{margin:0 0 8px;font-size:22px;color:#fff}
      p{margin:0;color:#94a3b8;font-size:14px;line-height:1.6}
    </style></head><body>
    <div class="card">
      <div class="icon">✅</div>
      <h1>Klart!</h1>
      <p>${message}</p>
    </div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function errorHtml(message: string) {
  return new Response(
    `<!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8">
    <style>
      body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
           background:#0a0d14;font-family:system-ui,sans-serif;color:#e2e8f0}
      .card{background:#0e1320;border:1px solid rgba(220,38,38,0.3);border-radius:16px;
            padding:40px 48px;text-align:center;max-width:400px}
      .icon{font-size:48px;margin-bottom:16px}
      h1{margin:0 0 8px;font-size:22px;color:#f87171}
      p{margin:0;color:#94a3b8;font-size:14px}
    </style></head><body>
    <div class="card">
      <div class="icon">❌</div>
      <h1>Något gick fel</h1>
      <p>${message}</p>
    </div></body></html>`,
    { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const action = searchParams.get("action");

  if (!token || !action || !ACTIONS[action]) {
    return errorHtml("Ogiltig länk.");
  }

  const booking = await prisma.booking.findFirst({
    where: { id: params.id, addonToken: token },
    include: { property: { select: { name: true } } },
  });

  if (!booking) return errorHtml("Bokningen hittades inte eller länken är ogiltig.");

  const update = ACTIONS[action];

  // Förhindra dubbletter
  if (action === "add-boat" && (booking.numberOfBoats ?? 0) > 0)
    return successHtml("Du har redan en båt bokad — ingen ändring gjordes.");
  if (action === "add-cleaning" && booking.cleaning)
    return successHtml("Städning är redan beställd — ingen ändring gjordes.");
  if (action === "add-linen" && booking.bedLinen)
    return successHtml("Lakan är redan beställt — ingen ändring gjordes.");

  await prisma.booking.update({ where: { id: booking.id }, data: update });

  const labels: Record<string, string> = {
    "add-boat":     "Båt har lagts till i din bokning.",
    "add-cleaning": "Städning har beställts till din bokning.",
    "add-linen":    "Lakan har beställts till din bokning.",
  };

  return successHtml(`${labels[action]} Vi ses på ${booking.property.name}!`);
}
