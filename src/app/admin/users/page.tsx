import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Navbar } from "@/components/Navbar";
import { AdminUserList } from "@/components/AdminUserList";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const [users, properties] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, email: true, role: true, phone: true, createdAt: true,
        customPricing: true, suppressGuestEmails: true,
        propertyAccess: { select: { propertyId: true } },
      },
    }),
    prisma.property.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white">Hantera användare</h1>
          <p className="mt-1 text-sm text-gray-500">
            Lägg till, redigera roller och återställ lösenord för alla konton.
          </p>
        </div>
        <AdminUserList
          users={users.map((u) => ({
            ...u,
            createdAt: u.createdAt.toISOString(),
            propertyIds: u.propertyAccess.map((a) => a.propertyId),
            customPricing: u.customPricing as Record<string, number> | null,
            suppressGuestEmails: u.suppressGuestEmails,
          }))}
          properties={properties}
          currentUserId={session.user.id}
        />
      </main>
    </div>
  );
}
