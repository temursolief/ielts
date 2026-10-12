import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";

export const instant = false;

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-[#FAFBF8]">
      <Sidebar role="STUDENT" userName={session.user.name} />
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}
