import { prisma } from "@/lib/db";
import { BookingStatus } from "@prisma/client";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (token) {
    await prisma.booking.deleteMany({
      where: { id: params.id, addonToken: token, status: BookingStatus.PENDING },
    });
  }

  const base = process.env.NEXTAUTH_URL ?? "https://husbokningarnas.vercel.app";
  return new Response(null, { status: 302, headers: { Location: `${base}/dashboard` } });
}
