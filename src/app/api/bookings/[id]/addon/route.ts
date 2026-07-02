import { prisma } from "@/lib/db";
import { BOAT_TYPES, boatPrice, BoatId, assignBoatNumbers, parseBoatNumbers, formatBoatNumbers } from "@/lib/boats";
import { BookingStatus } from "@prisma/client";
import { sendAddonConfirmation } from "@/lib/email";

function page(content: string) {
  return new Response(
    `<!DOCTYPE html><html lang="sv"><head><meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{min-height:100vh;display:flex;align-items:center;justify-content:center;
           background:#0a0d14;font-family:system-ui,sans-serif;color:#e2e8f0;padding:20px}
      .card{background:#0e1320;border:1px solid rgba(255,255,255,0.08);border-radius:16px;
            padding:32px 28px;max-width:420px;width:100%}
      .icon{font-size:40px;margin-bottom:14px;text-align:center}
      h1{font-size:20px;font-weight:700;color:#fff;margin-bottom:6px;text-align:center}
      p.sub{font-size:14px;color:#94a3b8;line-height:1.6;margin-bottom:20px;text-align:center}
      .boat-row{display:flex;align-items:center;justify-content:space-between;
                padding:14px 16px;background:#111827;border-radius:10px;margin-bottom:8px;gap:12px}
      .boat-info{flex:1}
      .boat-label{font-size:15px;font-weight:600;color:#fff}
      .boat-price{font-size:12px;color:#60a5fa;margin-top:2px}
      .boat-avail{font-size:11px;color:#4ade80;margin-top:2px}
      .boat-unavail{font-size:11px;color:#ef4444;margin-top:2px}
      .qty-ctrl{display:flex;align-items:center;gap:8px}
      .qty-ctrl button{width:36px;height:36px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);
                       background:rgba(255,255,255,0.06);color:#fff;font-size:20px;cursor:pointer}
      .qty-ctrl button:disabled{opacity:.3;cursor:default}
      .qty-ctrl input{width:44px;height:36px;text-align:center;font-size:16px;font-weight:700;
                      color:#fff;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);
                      border-radius:8px;-moz-appearance:textfield}
      .qty-ctrl input::-webkit-inner-spin-button{-webkit-appearance:none}
      .total{padding:14px 16px;background:rgba(99,102,241,0.1);border-radius:10px;
             margin-bottom:20px;font-size:14px;color:#a5b4fc;text-align:center}
      .total strong{color:#fff;font-size:18px}
      .btn{display:block;width:100%;padding:14px;border-radius:10px;border:none;cursor:pointer;
           font-size:15px;font-weight:700;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff}
      .btn:hover{opacity:.9}
    </style></head><body>${content}</body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function successPage(message: string) {
  return page(`<div class="card">
    <div class="icon">✅</div>
    <h1>Klart!</h1>
    <p class="sub">${message}</p>
  </div>`);
}

function errorPage(message: string) {
  return page(`<div class="card" style="border-color:rgba(220,38,38,0.3)">
    <div class="icon">❌</div>
    <h1 style="color:#f87171">Något gick fel</h1>
    <p class="sub">${message}</p>
  </div>`);
}

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

  const nights = Math.round(
    (booking.endDate.getTime() - booking.startDate.getTime()) / 86400000
  );

  // ── Lägg till båt ────────────────────────────────────────────────────────────
  if (action === "add-boat") {
    // Om confirm-params finns → spara
    const saving = BOAT_TYPES.some(t => searchParams.has(t.id));
    if (saving) {
      // Kolla tillgänglighet (exkludera denna bokning)
      const overlap = await prisma.booking.findMany({
        where: {
          id: { not: booking.id },
          status: BookingStatus.CONFIRMED,
          startDate: { lt: booking.endDate },
          endDate: { gt: booking.startDate },
        },
        select: { boat6hp: true, boat99hp: true, boat20hp: true, boat25hp: true, boatNumbers: true },
      });

      const used = {
        boat6hp:  overlap.reduce((s, b) => s + b.boat6hp,  0),
        boat99hp: overlap.reduce((s, b) => s + b.boat99hp, 0),
        boat20hp: overlap.reduce((s, b) => s + b.boat20hp, 0),
        boat25hp: overlap.reduce((s, b) => s + b.boat25hp, 0),
      };

      const newCounts = {
        boat6hp:  Math.min(parseInt(searchParams.get("boat6hp")  || "0"), 2 - used.boat6hp),
        boat99hp: Math.min(parseInt(searchParams.get("boat99hp") || "0"), 2 - used.boat99hp),
        boat20hp: Math.min(parseInt(searchParams.get("boat20hp") || "0"), 2 - used.boat20hp),
        boat25hp: Math.min(parseInt(searchParams.get("boat25hp") || "0"), 1 - used.boat25hp),
      };

      // Tilldela båtnummer
      const takenNumbers = overlap.flatMap(b => parseBoatNumbers(b.boatNumbers ?? ""));
      const assignedNumbers = assignBoatNumbers(newCounts, takenNumbers);

      await prisma.booking.update({
        where: { id: booking.id },
        data: { ...newCounts, boatNumbers: assignedNumbers.join(",") },
      });

      const lines = BOAT_TYPES
        .filter(t => (newCounts[t.id as BoatId] ?? 0) > 0)
        .map(t => `${newCounts[t.id as BoatId]}× ${t.label} (${boatPrice(t.weekPrice, nights).toLocaleString("sv-SE")} kr)`)
        .join(", ");

      const numStr = formatBoatNumbers(assignedNumbers);

      if (booking.guestEmail) {
        sendAddonConfirmation({
          guestEmail: booking.guestEmail,
          guestName: booking.guestName ?? "Gäst",
          propertyName: booking.property.name,
          startDate: booking.startDate.toISOString(),
          what: numStr,
          detail: lines || "–",
        }).catch(() => {});
      }

      return successPage(`Dina tilldelade båtar: <strong style="color:#60a5fa">${numStr}</strong><br>${lines || ""}<br>Välkommen till ${booking.property.name}!`);
    }

    // Annars → visa formulär
    // Kolla tillgänglighet
    const overlap = await prisma.booking.findMany({
      where: {
        id: { not: booking.id },
        status: BookingStatus.CONFIRMED,
        startDate: { lt: booking.endDate },
        endDate: { gt: booking.startDate },
      },
      select: { boat6hp: true, boat99hp: true, boat20hp: true, boat25hp: true },
    });

    const used = {
      boat6hp:  overlap.reduce((s, b) => s + b.boat6hp,  0),
      boat99hp: overlap.reduce((s, b) => s + b.boat99hp, 0),
      boat20hp: overlap.reduce((s, b) => s + b.boat20hp, 0),
      boat25hp: overlap.reduce((s, b) => s + b.boat25hp, 0),
    };

    const avail = {
      boat6hp:  2 - used.boat6hp,
      boat99hp: 2 - used.boat99hp,
      boat20hp: 2 - used.boat20hp,
      boat25hp: 1 - used.boat25hp,
    };

    const current = {
      boat6hp:  booking.boat6hp,
      boat99hp: booking.boat99hp,
      boat20hp: booking.boat20hp,
      boat25hp: booking.boat25hp,
    };

    const base = `/api/bookings/${params.id}/addon?token=${token}&action=add-boat`;

    const rows = BOAT_TYPES.map(t => {
      const id = t.id as BoatId;
      const max = avail[id] + current[id]; // already booked by this booking doesn't count
      const cur = current[id];
      const price = boatPrice(t.weekPrice, nights);
      const availLabel = max === 0
        ? `<div class="boat-unavail">Fullbokat</div>`
        : `<div class="boat-avail">${max} tillgänglig${max !== 1 ? "a" : ""}</div>`;

      return `<div class="boat-row">
        <div class="boat-info">
          <div class="boat-label">🚤 Motor ${t.label}</div>
          <div class="boat-price">${price.toLocaleString("sv-SE")} kr / ${nights} nätter</div>
          ${availLabel}
        </div>
        <div class="qty-ctrl">
          <button type="button" onclick="dec('${id}')" ${max === 0 ? "disabled" : ""}>−</button>
          <input id="${id}" type="number" value="${cur}" min="0" max="${max}" oninput="upd()" ${max === 0 ? "disabled" : ""}>
          <button type="button" onclick="inc('${id}',${max})" ${max === 0 ? "disabled" : ""}>+</button>
        </div>
      </div>`;
    }).join("");

    return page(`<div class="card">
      <div class="icon">🚤</div>
      <h1>Välj båtar</h1>
      <p class="sub">Bokning på ${booking.property.name} — ${nights} nätter</p>
      ${rows}
      <div class="total" id="total">Välj en båt ovan</div>
      <button class="btn" onclick="submit()">Bekräfta</button>
      <script>
        var base="${base}";
        var prices={boat6hp:${boatPrice(1750,nights)},boat99hp:${boatPrice(2250,nights)},boat20hp:${boatPrice(2750,nights)},boat25hp:${boatPrice(3250,nights)}};
        function val(id){return Math.max(0,+document.getElementById(id).value||0)}
        function dec(id){var el=document.getElementById(id);el.value=Math.max(0,val(id)-1);upd()}
        function inc(id,max){var el=document.getElementById(id);el.value=Math.min(max,val(id)+1);upd()}
        function upd(){
          var tot=0;
          ['boat6hp','boat99hp','boat20hp','boat25hp'].forEach(function(id){tot+=val(id)*prices[id]});
          document.getElementById('total').innerHTML=tot>0?'Totalt: <strong>'+tot.toLocaleString('sv-SE')+' kr</strong>':'Välj en båt ovan';
        }
        function submit(){
          var q=['boat6hp','boat99hp','boat20hp','boat25hp'].map(function(id){return id+'='+val(id)}).join('&');
          window.location.href=base+'&'+q;
        }
      </script>
    </div>`);
  }

  // ── Städning ─────────────────────────────────────────────────────────────────
  if (action === "add-cleaning") {
    if (booking.cleaning) return successPage("Städning är redan beställd — ingen ändring gjordes.");
    await prisma.booking.update({ where: { id: booking.id }, data: { cleaning: true } });
    if (booking.guestEmail) {
      sendAddonConfirmation({
        guestEmail: booking.guestEmail,
        guestName: booking.guestName ?? "Gäst",
        propertyName: booking.property.name,
        startDate: booking.startDate.toISOString(),
        what: "Städning",
        detail: "2 200 kr — betalas vid ankomst eller enligt överenskommelse",
      }).catch(() => {});
    }
    return successPage(`Städning (2 200 kr) har beställts till din bokning på ${booking.property.name}!`);
  }

  if (action === "add-linen") {
    if (booking.bedLinen) return successPage("Lakan är redan beställt — ingen ändring gjordes.");
    await prisma.booking.update({ where: { id: booking.id }, data: { bedLinen: true } });
    if (booking.guestEmail) {
      sendAddonConfirmation({
        guestEmail: booking.guestEmail,
        guestName: booking.guestName ?? "Gäst",
        propertyName: booking.property.name,
        startDate: booking.startDate.toISOString(),
        what: "Lakan",
        detail: "220 kr — betalas vid ankomst eller enligt överenskommelse",
      }).catch(() => {});
    }
    return successPage(`Lakan (220 kr) har beställts till din bokning på ${booking.property.name}!`);
  }

  return errorPage("Okänd åtgärd.");
}
