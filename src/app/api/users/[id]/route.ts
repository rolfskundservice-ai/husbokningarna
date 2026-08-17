import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

const customPricingSchema = z.object({
  basePrice: z.number().optional(),
  boatPrice: z.number().optional(),
  cleaningPrice: z.number().optional(),
  linenPrice: z.number().optional(),
}).nullable().optional();

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.nativeEnum(Role).optional(),
  password: z.string().min(6).optional(),
  phone: z.string().optional(),
  propertyIds: z.array(z.string()).optional(),
  customPricing: customPricingSchema,
  suppressGuestEmails: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Ej behörig" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, role, password, phone, propertyIds, customPricing, suppressGuestEmails } = parsed.data;
  const data: Record<string, unknown> = {};
  if (name) data.name = name;
  if (role) data.role = role;
  if (password) data.passwordHash = await bcrypt.hash(password, 12);
  if (phone !== undefined) data.phone = phone || null;
  if (customPricing !== undefined) data.customPricing = customPricing;
  if (suppressGuestEmails !== undefined) data.suppressGuestEmails = suppressGuestEmails;

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, email: true, role: true, phone: true, createdAt: true, customPricing: true, suppressGuestEmails: true },
  });

  if (propertyIds !== undefined) {
    await prisma.propertyAccess.deleteMany({ where: { userId: params.id } });
    if (propertyIds.length > 0) {
      await prisma.propertyAccess.createMany({
        data: propertyIds.map((propertyId) => ({ userId: params.id, propertyId })),
        skipDuplicates: true,
      });
    }
  }

  return NextResponse.json(user);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Ej behörig" }, { status: 403 });
  }

  if (params.id === session.user.id) {
    return NextResponse.json({ error: "Du kan inte ta bort ditt eget konto" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
