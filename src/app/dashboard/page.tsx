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
          orderBy: { name: "asc" },
        })
      : await prisma.property.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Kalender</h1>
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
