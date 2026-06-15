import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Navbar } from "@/components/Navbar";
import { AdminPropertyList } from "@/components/AdminPropertyList";

export default async function AdminPropertiesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const properties = await prisma.property.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white">Hantera stugor</h1>
          <p className="mt-1 text-sm text-gray-500">
            Lägg till Airbnb-kalenderlänk (iCal export) per stuga för automatisk synk.
          </p>
        </div>
        <AdminPropertyList
          properties={properties.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            color: p.color,
            airbnbIcalUrl: p.airbnbIcalUrl,
            lastSyncedAt: p.lastSyncedAt?.toISOString() ?? null,
          }))}
        />
      </main>
    </div>
  );
}
