import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const instant = false;

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    const dest = session.user.role === "TEACHER" ? "/teacher" : "/student";
    redirect(dest);
  }
  redirect("/login");
}
