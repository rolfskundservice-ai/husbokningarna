import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function page(content: string) {
  return new Response(
    `<!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{min-height:100vh;display:flex;align-items:center;justify-content:center;
           background:#0a0d14;font-family:system-ui,sans-serif;color:#e2e8f0;padding:20px}
      .card{background:#0e1320;border:1px solid rgba(255,255,255,0.08);border-radius:16px;
            padding:36px 40px;text-align:center;max-width:380px;width:100%}
      .icon{font-size:44px;margin-bottom:16px}
      h1{font-size:20px;font-weight:700;color:#fff;margin-bottom:8px}
      p{font-size:14px;color:#94a3b8;line-height:1.6;margin-bottom:24px}
      .stepper{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:28px}
      .stepper button{width:44px;height:44px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);
                      background:rgba(255,255,255,0.06);color:#fff;font-size:22px;cursor:pointer;
                      display:flex;align-items:center;justify-content:center}
      .stepper button:hover{background:rgba(255,255,255,0.12)}
      #qty{width:64px;height:44px;text-align:center;font-size:20px;font-weight:700;color:#fff;
           background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);
           border-radius:10px;-moz-appearance:textfield}
      #qty::-webkit-inner-spin-button{-webkit-appearance:none}
      .btn{display:block;width:100%;padding:14px;border-radius:10px;border:none;cursor:pointer;
           font-size:15px;font-weight:600;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff}
      .btn:hover{opacity:.9}
      .badge-green{display:inline-block;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600;
                   background:rgba(34,197,94,0.15);color:#4ade80;border:1px solid rgba(34,197,94,0.3)}
    </style></head><body>${content}</body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function successPage(message: string) {
  return page(`<div class="card">
    <div class="icon">✅</div>
    <h1>Klart!</h1>
    <p>${message}</p>
  </div>`);
}

function errorPage(message: string) {
  return page(`<div class="card" style="border-color:rgba(220,38,38,0.3)">
    <div class="icon">❌</div>
    <h1 style="color:#f87171">Något gick fel</h1>
    <p>${message}</p>
  </div>`);
}

// GET — visa formulär eller hantera enkla åtgärder
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const action = searchParams.get("action");

  if (!token || !action) return errorPage("Ogiltig länk.");

  const booking = await prisma.booking.findFirst({
    where: { id: params.id, addonToken: token },
    include: { property: { select: { name: true } } },
  });
  if (!booking) return errorPage("Bokningen hittades inte eller länken är ogiltig.");

  // Välj antal båtar — visa formulär
  if (action === "add-boat") {
    const current = booking.numberOfBoats ?? 0;
    const startVal = Math.max(1, current + (current > 0 ? 0 : 1));
    return page(`<div class="card">
      <div class="icon">🛥</div>
      <h1>Lägg till båt</h1>
      <p>Hur många båtar vill du ha till din bokning på <strong style="color:#fff">${booking.property.name}</strong>?
      ${current > 0 ? `<br><br>Du har redan <span class="badge-green">${current} båt${current !== 1 ? "ar" : ""}</span> bokade.` : ""}
      </p>
      <form method="POST" action="/api/bookings/${params.id}/addon">
        <input type="hidden" name="token" value="${token}">
        <input type="hidden" name="action" value="add-boat">
        <div class="stepper">
          <button type="button" onclick="dec()">−</button>
          <input id="qty" name="qty" type="number" min="1" max="10" value="${startVal}" oninput="upd()">
          <button type="button" onclick="inc()">+</button>
        </div>
        <p id="price" style="font-size:13px;color:#60a5fa;margin-bottom:20px">${startVal} båt${startVal !== 1 ? "ar" : ""} = <strong>${startVal * 1750} kr</strong></p>
        <button type="submit" class="btn">Bekräfta bokning</button>
      </form>
      <script>
        function v(){return Math.max(1,Math.min(10,+document.getElementById('qty').value||1))}
        function dec(){document.getElementById('qty').value=Math.max(1,v()-1);upd()}
        function inc(){document.getElementById('qty').value=Math.min(10,v()+1);upd()}
        function upd(){var n=v();document.getElementById('price').innerHTML=n+' båt'+(n!==1?'ar':'')+' = <strong>'+n*1750+' kr</strong>'}
      </script>
    </div>`);
  }

  // Städning
  if (action === "add-cleaning") {
    if (booking.cleaning) return successPage("Städning är redan beställd — ingen ändring gjordes.");
    await prisma.booking.update({ where: { id: booking.id }, data: { cleaning: true } });
    return successPage(`Städning (2 200 kr) har beställts till din bokning på ${booking.property.name}!`);
  }

  if (action === "add-linen") {
    if (booking.bedLinen) return successPage("Lakan är redan beställt — ingen ändring gjordes.");
    await prisma.booking.update({ where: { id: booking.id }, data: { bedLinen: true } });
    return successPage(`Lakan (220 kr) har beställts till din bokning på ${booking.property.name}!`);
  }

  return errorPage("Okänd åtgärd.");
}

// POST — ta emot antal båtar från formuläret
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const formData = await req.formData();
  const token = formData.get("token") as string;
  const action = formData.get("action") as string;
  const qty = parseInt(formData.get("qty") as string, 10);

  if (!token || action !== "add-boat" || isNaN(qty) || qty < 1) {
    return errorPage("Ogiltig förfrågan.");
  }

  const booking = await prisma.booking.findFirst({
    where: { id: params.id, addonToken: token },
    include: { property: { select: { name: true } } },
  });
  if (!booking) return errorPage("Bokningen hittades inte eller länken är ogiltig.");

  await prisma.booking.update({ where: { id: booking.id }, data: { numberOfBoats: qty } });

  return successPage(`${qty} båt${qty !== 1 ? "ar" : ""} har lagts till i din bokning på ${booking.property.name}. Vi ses snart!`);
}
