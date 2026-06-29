import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Navbar } from "@/components/Navbar";
import { PropertySwitcher } from "@/components/PropertySwitcher";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const properties =
    session.user.role === "PARTNER"
      ? await prisma.property.findMany({
          where: { access: { some: { userId: session.user.id } } },
          orderBy: { sortOrder: "asc" },
        })
      : await prisma.property.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white">Kalender</h1>
          <p className="mt-1 text-sm text-gray-500">Veckovis tillgänglighet per stuga</p>
        </div>
        <PropertySwitcher
          properties={properties.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            color: p.color,
          }))}
        />
      </main>
    </div>
  );
}
