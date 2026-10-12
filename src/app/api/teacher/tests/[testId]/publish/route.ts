import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  const { testId } = await params;
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const test = await prisma.test.findFirst({
    where: { id: testId, teacherId: session.user.id },
  });

  if (!test) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.test.update({
    where: { id: testId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
