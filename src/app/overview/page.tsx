import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Navbar } from "@/components/Navbar";
import { OverviewCalendar } from "@/components/OverviewCalendar";

export default async function OverviewPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const properties =
    session.user.role === "PARTNER"
      ? await prisma.property.findMany({
          where: { access: { some: { userId: session.user.id } } },
          orderBy: { name: "asc" },
        })
      : await prisma.property.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-full px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white">Översikt</h1>
          <p className="mt-1 text-sm text-gray-500">Alla stugor i samma vy – vecka för vecka.</p>
        </div>
        <OverviewCalendar
          properties={properties.map((p) => ({ id: p.id, name: p.name, color: p.color }))}
        />
      </main>
    </div>
  );
}
