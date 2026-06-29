import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

// GET /api/properties
// Returnerar properties användaren har åtkomst till.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });

  let properties;
  if (session.user.role === "PARTNER") {
    properties = await prisma.property.findMany({
      where: { access: { some: { userId: session.user.id } } },
      orderBy: { sortOrder: "asc" },
    });
  } else {
    // ADMIN och OWNER ser alla
    properties = await prisma.property.findMany({ orderBy: { sortOrder: "asc" } });
  }

  return NextResponse.json(properties);
}

const createPropertySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
  airbnbIcalUrl: z.string().url().optional().or(z.literal("")),
});

// POST /api/properties  (endast ADMIN)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Endast admin kan lägga till stugor" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createPropertySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const property = await prisma.property.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      color: parsed.data.color || "#2563eb",
      airbnbIcalUrl: parsed.data.airbnbIcalUrl || null,
    },
  });

  return NextResponse.json(property, { status: 201 });
}
