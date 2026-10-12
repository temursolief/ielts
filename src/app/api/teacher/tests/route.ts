import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateReadingJson, type ReadingTestJson } from "@/lib/readingJsonSchema";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { data: unknown; publish: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateReadingJson(body.data);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validation failed", errors: validation.errors },
      { status: 422 }
    );
  }

  const data: ReadingTestJson = validation.data;

  // Persist in a single transaction
  const test = await prisma.$transaction(async (tx) => {
    const t = await tx.test.create({
      data: {
        title: data.title,
        skill: "READING",
        status: body.publish ? "PUBLISHED" : "DRAFT",
        durationMin: data.durationMinutes,
        teacherId: session.user.id,
        schemaVer: data.schemaVersion,
        publishedAt: body.publish ? new Date() : null,
      },
    });

    for (const passage of data.passages) {
      const p = await tx.passage.create({
        data: {
          testId: t.id,
          order: passage.order,
          title: passage.title,
          body: passage.body,
        },
      });

      for (let gi = 0; gi < passage.questionGroups.length; gi++) {
        const group = passage.questionGroups[gi];
        const qg = await tx.questionGroup.create({
          data: {
            passageId: p.id,
            order: gi + 1,
            questionType: group.type,
            instructions: group.instructions ?? null,
            options: group.options ?? undefined,
          },
        });

        for (const q of group.questions) {
          const question = await tx.question.create({
            data: {
              groupId: qg.id,
              number: q.number,
              stem: q.stem,
              options: q.options ?? undefined,
              wordLimit: q.wordLimit ?? null,
            },
          });

          await tx.answerKey.create({
            data: {
              questionId: question.id,
              acceptedAnswers: q.correctAnswers,
              caseSensitive: q.caseSensitive ?? false,
              explanation: q.explanation ?? null,
            },
          });
        }
      }
    }

    return t;
  });

  // Log activity
  await prisma.activityEvent.create({
    data: {
      userId: session.user.id,
      type: body.publish ? "TEST_PUBLISHED" : "TEST_CREATED",
      metadata: { testId: test.id, title: test.title },
    },
  });

  return NextResponse.json({ id: test.id }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tests = await prisma.test.findMany({
    where: { teacherId: session.user.id },
    include: {
      _count: { select: { passages: true, attempts: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(tests);
}
