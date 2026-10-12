import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { scoreAttempt } from "../src/lib/scoring/scoreAttempt";

const prisma = new PrismaClient();

// Deterministic PRNG so reseeds produce stable-looking demo data.
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const TF_VALUES = ["TRUE", "FALSE", "NOT GIVEN"];

type SeedQuestion = {
  id: string;
  number: number;
  questionType: string;
  options: unknown;
  wordLimit: number | null;
  answerKey: { acceptedAnswers: unknown } | null;
};

function decoyAnswer(q: SeedQuestion): string {
  const correct = (q.answerKey?.acceptedAnswers as string[] | undefined)?.[0] ?? "";
  if (q.questionType === "TRUE_FALSE_NOT_GIVEN" || q.questionType === "YES_NO_NOT_GIVEN") {
    const pool = q.questionType === "YES_NO_NOT_GIVEN" ? ["YES", "NO", "NOT GIVEN"] : TF_VALUES;
    return pool.find((v) => v !== correct) ?? pool[0];
  }
  if (q.questionType === "MULTIPLE_CHOICE_SINGLE") {
    const opts = (q.options as string[] | null) ?? [];
    return opts.find((o) => o !== correct && !correct.includes(o)) ?? opts[0] ?? "wrong";
  }
  return "unknown";
}

/**
 * Creates a TestAttempt with simulated answers, scores it with the real
 * scoring engine, then backdates the attempt + its activity event so the
 * dashboards show a believable history instead of everything "today".
 */
async function simulateAttempt(opts: {
  studentId: string;
  testId: string;
  questions: SeedQuestion[];
  durationSec: number;
  correctFraction: number;
  daysAgo: number;
  finalStatus: "SUBMITTED" | "TERMINATED_VIOLATION" | "TIME_EXPIRED";
  seed: number;
}) {
  const { studentId, testId, questions, durationSec, correctFraction, daysAgo, finalStatus, seed } = opts;
  const rand = mulberry32(seed);

  const startedAt = new Date();
  startedAt.setDate(startedAt.getDate() - daysAgo);
  const minutesTaken = Math.round(durationSec / 60 * (0.3 + rand() * 0.5));
  const submittedAt = new Date(startedAt.getTime() + minutesTaken * 60 * 1000);

  const attempt = await prisma.testAttempt.create({
    data: {
      testId,
      studentId,
      status: "IN_PROGRESS",
      startedAt,
      timeLimitSec: durationSec,
      serverDeadline: new Date(startedAt.getTime() + durationSec * 1000),
      totalQuestions: questions.length,
    },
  });

  const correctCount = Math.round(questions.length * correctFraction);
  const order = shuffle(questions.map((_, i) => i), rand);
  const correctIdx = new Set(order.slice(0, correctCount));

  await prisma.studentAnswer.createMany({
    data: questions.map((q, i) => ({
      attemptId: attempt.id,
      questionId: q.id,
      answer: correctIdx.has(i)
        ? ((q.answerKey?.acceptedAnswers as string[] | undefined)?.[0] ?? "")
        : decoyAnswer(q),
    })),
  });

  await scoreAttempt(attempt.id, finalStatus);

  if (finalStatus === "TERMINATED_VIOLATION") {
    await prisma.attemptViolation.create({
      data: { attemptId: attempt.id, type: "TAB_SWITCH", occurredAt: submittedAt },
    });
  }

  // Backdate the attempt + the activity event scoreAttempt() just logged.
  await prisma.testAttempt.update({
    where: { id: attempt.id },
    data: { createdAt: startedAt, submittedAt },
  });
  const latestEvent = await prisma.activityEvent.findFirst({
    where: { userId: studentId, type: "ATTEMPT_COMPLETED" },
    orderBy: { date: "desc" },
  });
  if (latestEvent) {
    await prisma.activityEvent.update({
      where: { id: latestEvent.id },
      data: { date: submittedAt },
    });
  }

  return attempt;
}

async function main() {
  console.log("Seeding database…");

  // Create teacher
  const teacher = await prisma.user.upsert({
    where: { email: "teacher@ielts.demo" },
    update: {},
    create: {
      email: "teacher@ielts.demo",
      name: "Sarah Mitchell",
      passwordHash: await bcrypt.hash("teacher123", 10),
      role: "TEACHER",
    },
  });

  // Create students
  const studentData = [
    { email: "ali@ielts.demo", name: "Ali Karimov" },
    { email: "fatima@ielts.demo", name: "Fatima Rashidova" },
    { email: "john@ielts.demo", name: "John Davies" },
  ];

  const students = await Promise.all(
    studentData.map((s) =>
      prisma.user.upsert({
        where: { email: s.email },
        update: {},
        create: {
          email: s.email,
          name: s.name,
          passwordHash: bcrypt.hashSync("student123", 10),
          role: "STUDENT",
        },
      })
    )
  );

  // Teacher-student relationships
  await Promise.all(
    students.map((s) =>
      prisma.teacherStudent.upsert({
        where: {
          teacherId_studentId: { teacherId: teacher.id, studentId: s.id },
        },
        update: {},
        create: { teacherId: teacher.id, studentId: s.id },
      })
    )
  );

  // Create a sample reading test
  const test = await prisma.test.create({
    data: {
      title: "IELTS Academic Reading Practice Test 1",
      skill: "READING",
      status: "PUBLISHED",
      durationMin: 60,
      teacherId: teacher.id,
      publishedAt: new Date(),
      passages: {
        create: [
          {
            order: 1,
            title: "The Origins of Urban Agriculture",
            body: `Urban agriculture, the practice of cultivating, processing, and distributing food in or around urban areas, is not a modern invention. Historical records indicate that cities in ancient Mesopotamia maintained gardens within their walls, partly for practical food production and partly for aesthetic and religious purposes.

The concept gained renewed prominence during the industrial revolution, when rapid urbanisation led to overcrowded cities with limited food security. In response, city governments and charitable organisations established allotment gardens, providing small plots of land to working-class families. By the late nineteenth century, allotment schemes had spread across Europe and North America.

Modern urban agriculture has evolved significantly from these origins. Today it encompasses a diverse range of practices: rooftop gardens, vertical farms, community plots, aquaponics facilities, and even indoor microgreens operations. Advances in LED lighting, hydroponic systems, and data-driven growing techniques have made food production viable in spaces previously considered unsuitable.

Despite its benefits — reducing food miles, supporting biodiversity, building community cohesion — urban agriculture faces substantial challenges. Land availability remains the most persistent obstacle. In high-density cities, open land is costly and competition from developers is fierce. Policy frameworks often lag behind practice, leaving urban farmers in legal grey areas regarding water usage, zoning, and commercial activities.

Proponents argue that urban agriculture can play a meaningful role in building more resilient food systems, particularly as climate change disrupts traditional agricultural regions. Critics, however, caution against overstating its potential — current estimates suggest urban food production could supply only a small fraction of a city's caloric needs.`,
            questionGroups: {
              create: [
                {
                  order: 1,
                  questionType: "TRUE_FALSE_NOT_GIVEN",
                  instructions:
                    "Do the following statements agree with the information given in the passage? In boxes 1–5 on your answer sheet, write TRUE if the statement agrees with the information, FALSE if the statement contradicts the information, NOT GIVEN if there is no information on this.",
                  questions: {
                    create: [
                      {
                        number: 1,
                        stem: "Urban agriculture was first practised in ancient Mesopotamia.",
                        answerKey: {
                          create: {
                            acceptedAnswers: ["TRUE"],
                            caseSensitive: false,
                          },
                        },
                      },
                      {
                        number: 2,
                        stem: "Allotment gardens were introduced exclusively in Europe during the industrial revolution.",
                        answerKey: {
                          create: {
                            acceptedAnswers: ["FALSE"],
                            caseSensitive: false,
                          },
                        },
                      },
                      {
                        number: 3,
                        stem: "Modern urban farms generate more profit than traditional farms.",
                        answerKey: {
                          create: {
                            acceptedAnswers: ["NOT GIVEN"],
                            caseSensitive: false,
                          },
                        },
                      },
                      {
                        number: 4,
                        stem: "Land availability is the most persistent challenge for urban agriculture.",
                        answerKey: {
                          create: {
                            acceptedAnswers: ["TRUE"],
                            caseSensitive: false,
                          },
                        },
                      },
                      {
                        number: 5,
                        stem: "Urban agriculture can fully supply the caloric needs of a modern city.",
                        answerKey: {
                          create: {
                            acceptedAnswers: ["FALSE"],
                            caseSensitive: false,
                          },
                        },
                      },
                    ],
                  },
                },
                {
                  order: 2,
                  questionType: "SENTENCE_COMPLETION",
                  instructions:
                    "Complete the sentences below. Choose NO MORE THAN TWO WORDS from the passage for each answer.",
                  questions: {
                    create: [
                      {
                        number: 6,
                        stem: "Ancient Mesopotamian cities maintained gardens partly for _______ and religious purposes.",
                        wordLimit: 2,
                        answerKey: {
                          create: {
                            acceptedAnswers: ["aesthetic"],
                            caseSensitive: false,
                          },
                        },
                      },
                      {
                        number: 7,
                        stem: "Modern urban agriculture makes food production viable in spaces previously considered _______.",
                        wordLimit: 2,
                        answerKey: {
                          create: {
                            acceptedAnswers: ["unsuitable"],
                            caseSensitive: false,
                          },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            order: 2,
            title: "The Psychology of Decision Fatigue",
            body: `Every decision we make, regardless of its apparent size, draws upon the same limited cognitive resource. When this resource is depleted, the quality of our subsequent decisions deteriorates — a phenomenon researchers have termed decision fatigue.

The concept gained widespread attention following a 2011 study by social psychologist Roy Baumeister and colleagues. Their analysis of more than a thousand parole hearings revealed a striking pattern: prisoners appearing before the board early in the morning were granted parole approximately 65% of the time. As the day progressed, this proportion dropped significantly, approaching zero before lunch breaks and recovering briefly when the judges had eaten and rested.

Subsequent research has explored the neural mechanisms behind this phenomenon. Neuroimaging studies suggest that when the prefrontal cortex — responsible for higher-order reasoning — is fatigued, decision-making shifts toward more impulsive, heuristic-driven responses. The brain, in effect, defaults to simpler cognitive pathways to conserve energy.

The implications for everyday life are significant. Studies in retail environments have shown that consumers presented with too many choices are less likely to make a purchase and report lower satisfaction with their selections. Similarly, research into medical practice has found that doctors are more likely to prescribe the default treatment option toward the end of a long clinical session.

Strategies to mitigate decision fatigue include reducing the number of decisions made each day, establishing routines for recurring choices, making important decisions early in the day when cognitive resources are fresh, and ensuring adequate nutrition and rest. Some public figures and executives have adopted uniform daily clothing as a practical measure to eliminate trivial morning decisions.`,
            questionGroups: {
              create: [
                {
                  order: 1,
                  questionType: "MULTIPLE_CHOICE_SINGLE",
                  instructions:
                    "Choose the correct letter, A, B, C or D.",
                  options: ["A", "B", "C", "D"],
                  questions: {
                    create: [
                      {
                        number: 8,
                        stem: "According to the passage, what did the parole hearing study reveal?",
                        options: [
                          "A  Judges granted parole more frequently in the afternoon",
                          "B  The time of day had no effect on parole decisions",
                          "C  Parole rates were highest in the morning and declined through the day",
                          "D  Prisoners were treated unfairly regardless of time",
                        ],
                        answerKey: {
                          create: {
                            acceptedAnswers: [
                              "C",
                              "C  Parole rates were highest in the morning and declined through the day",
                            ],
                            caseSensitive: false,
                          },
                        },
                      },
                      {
                        number: 9,
                        stem: "The term 'decision fatigue' refers to:",
                        options: [
                          "A  physical tiredness from making physical decisions",
                          "B  the deterioration in decision quality as cognitive resources deplete",
                          "C  the refusal to make important decisions",
                          "D  a medical condition related to stress",
                        ],
                        answerKey: {
                          create: {
                            acceptedAnswers: [
                              "B",
                              "B  the deterioration in decision quality as cognitive resources deplete",
                            ],
                            caseSensitive: false,
                          },
                        },
                      },
                    ],
                  },
                },
                {
                  order: 2,
                  questionType: "SHORT_ANSWER",
                  instructions:
                    "Answer the following questions using NO MORE THAN THREE WORDS from the passage.",
                  questions: {
                    create: [
                      {
                        number: 10,
                        stem: "Which part of the brain is responsible for higher-order reasoning?",
                        wordLimit: 3,
                        answerKey: {
                          create: {
                            acceptedAnswers: [
                              "prefrontal cortex",
                              "the prefrontal cortex",
                            ],
                            caseSensitive: false,
                          },
                        },
                      },
                      {
                        number: 11,
                        stem: "What do some executives wear each day to reduce morning decisions?",
                        wordLimit: 3,
                        answerKey: {
                          create: {
                            acceptedAnswers: [
                              "uniform daily clothing",
                              "uniform clothing",
                            ],
                            caseSensitive: false,
                          },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  });

  // Assign to all students
  await Promise.all(
    students.map((s) =>
      prisma.assignment.create({
        data: {
          testId: test.id,
          teacherId: teacher.id,
          studentId: s.id,
        },
      })
    )
  );

  // --- Second, full-length (40-question) reading test ---------------------
  // estimateBand() only returns a band for 40-question tests, so this test
  // is what makes band estimates show up anywhere in the demo data.
  function tfGroup(startNum: number, items: { stem: string; answer: string }[]) {
    return {
      order: 1,
      questionType: "TRUE_FALSE_NOT_GIVEN" as const,
      instructions:
        "Do the following statements agree with the information given in the passage? Write TRUE, FALSE, or NOT GIVEN.",
      questions: {
        create: items.map((it, i) => ({
          number: startNum + i,
          stem: it.stem,
          answerKey: { create: { acceptedAnswers: [it.answer], caseSensitive: false } },
        })),
      },
    };
  }
  function saGroup(startNum: number, items: { stem: string; answers: string[]; wordLimit: number }[]) {
    return {
      order: 2,
      questionType: "SHORT_ANSWER" as const,
      instructions: "Answer the questions using words from the passage.",
      questions: {
        create: items.map((it, i) => ({
          number: startNum + i,
          stem: it.stem,
          wordLimit: it.wordLimit,
          answerKey: { create: { acceptedAnswers: it.answers, caseSensitive: false } },
        })),
      },
    };
  }
  function mcGroup(startNum: number, items: { stem: string; options: string[]; correctIndex: number }[]) {
    return {
      order: 3,
      questionType: "MULTIPLE_CHOICE_SINGLE" as const,
      instructions: "Choose the correct letter, A, B, C or D.",
      options: ["A", "B", "C", "D"],
      questions: {
        create: items.map((it, i) => ({
          number: startNum + i,
          stem: it.stem,
          options: it.options,
          answerKey: {
            create: {
              acceptedAnswers: [
                "ABCD"[it.correctIndex],
                it.options[it.correctIndex],
              ],
              caseSensitive: false,
            },
          },
        })),
      },
    };
  }

  const test2 = await prisma.test.create({
    data: {
      title: "IELTS Academic Reading Practice Test 2",
      skill: "READING",
      status: "PUBLISHED",
      durationMin: 60,
      teacherId: teacher.id,
      publishedAt: new Date(),
      passages: {
        create: [
          {
            order: 1,
            title: "The Decline of Coral Reefs",
            body: `Coral reefs, often called the rainforests of the sea, support roughly a quarter of all marine species despite covering less than one percent of the ocean floor. These ecosystems form over thousands of years as colonies of tiny animals called polyps secrete calcium carbonate skeletons, gradually building intricate limestone structures.

Rising sea temperatures pose the most immediate threat to reef survival. When water becomes too warm, corals expel the symbiotic algae living within their tissues, a process known as bleaching. Without these algae, which supply the coral with both nutrients and colour, the coral turns white and, if conditions do not improve within weeks, often dies.

Ocean acidification compounds the problem. As the sea absorbs increasing amounts of atmospheric carbon dioxide, its pH gradually falls, making it harder for corals to build their calcium carbonate skeletons. Scientists estimate that under current emission trajectories, more than ninety percent of the world's reefs could experience severe bleaching events annually by mid-century.

Conservation efforts now focus on identifying heat-resistant coral strains and establishing marine protected areas where fishing and coastal development are restricted. Some researchers are also experimenting with selective breeding programmes intended to produce corals better able to withstand warmer, more acidic waters.`,
            questionGroups: {
              create: [
                tfGroup(1, [
                  { stem: "Coral reefs cover a large proportion of the ocean floor.", answer: "FALSE" },
                  { stem: "Bleaching occurs when corals expel algae living in their tissues.", answer: "TRUE" },
                  { stem: "Ocean acidification makes it easier for corals to build their skeletons.", answer: "FALSE" },
                  { stem: "All scientists agree that selective breeding will save coral reefs.", answer: "NOT GIVEN" },
                ]),
                saGroup(5, [
                  { stem: "What do polyps secrete to build reef structures?", answers: ["calcium carbonate"], wordLimit: 2 },
                  { stem: "What colour do corals turn after bleaching?", answers: ["white"], wordLimit: 1 },
                  { stem: "What is falling in the ocean due to rising CO2 absorption?", answers: ["pH", "the pH"], wordLimit: 2 },
                ]),
                mcGroup(8, [
                  {
                    stem: "According to the passage, what percentage of marine species do reefs support?",
                    options: ["A  One percent", "B  Ten percent", "C  Twenty-five percent", "D  Fifty percent"],
                    correctIndex: 2,
                  },
                  {
                    stem: "What is described as the most immediate threat to reefs?",
                    options: ["A  Overfishing", "B  Rising sea temperatures", "C  Plastic pollution", "D  Tourism"],
                    correctIndex: 1,
                  },
                  {
                    stem: "By when could over 90% of reefs face severe annual bleaching under current trends?",
                    options: ["A  By 2030", "B  By mid-century", "C  By 2200", "D  Never"],
                    correctIndex: 1,
                  },
                ]),
              ],
            },
          },
          {
            order: 2,
            title: "Cognitive Benefits of Bilingualism",
            body: `Research into bilingualism has moved far beyond simple comparisons of vocabulary size. Cognitive scientists are now more interested in how managing two language systems affects executive function — the mental processes that allow us to plan, switch attention, and inhibit irrelevant information.

Bilingual speakers must constantly suppress one language while using the other, a form of ongoing mental exercise some researchers compare to interval training for the brain. Several studies have found that bilingual children outperform monolingual peers on tasks requiring selective attention and cognitive flexibility, although the size of this advantage remains debated among specialists.

Perhaps the most striking findings come from research on ageing. Longitudinal studies following bilingual and monolingual adults suggest that lifelong bilingualism may delay the onset of dementia symptoms by several years, even though it does not prevent the underlying neurodegeneration. Researchers attribute this to 'cognitive reserve', a buffer built up through years of complex mental processing.

Critics caution that many of these studies rely on small sample sizes and fail to control adequately for socioeconomic factors, education levels, and immigration status, all of which can independently influence cognitive outcomes.`,
            questionGroups: {
              create: [
                tfGroup(11, [
                  { stem: "Researchers today focus mainly on vocabulary differences between bilinguals and monolinguals.", answer: "FALSE" },
                  { stem: "Bilingual speakers must suppress one language while speaking the other.", answer: "TRUE" },
                  { stem: "All researchers agree on the exact size of bilingual children's cognitive advantage.", answer: "FALSE" },
                  { stem: "Bilingualism has been shown to prevent the underlying neurodegeneration associated with dementia.", answer: "FALSE" },
                ]),
                saGroup(15, [
                  { stem: "What term do researchers use for the mental buffer built up by bilingualism?", answers: ["cognitive reserve"], wordLimit: 2 },
                  { stem: "What type of training do researchers compare bilingual language-switching to?", answers: ["interval training"], wordLimit: 2 },
                  { stem: "Besides education and immigration status, what do critics say studies fail to control for?", answers: ["socioeconomic factors"], wordLimit: 2 },
                ]),
                mcGroup(18, [
                  {
                    stem: "What do bilingual speakers compare to interval training?",
                    options: ["A  Learning vocabulary", "B  Switching between languages", "C  Reading comprehension", "D  Writing essays"],
                    correctIndex: 1,
                  },
                  {
                    stem: "According to the passage, longitudinal studies suggest lifelong bilingualism may:",
                    options: ["A  Prevent dementia entirely", "B  Delay onset of dementia symptoms", "C  Have no effect on ageing", "D  Cause earlier cognitive decline"],
                    correctIndex: 1,
                  },
                  {
                    stem: "What do critics say many studies fail to do?",
                    options: ["A  Use any human subjects", "B  Measure vocabulary accurately", "C  Control adequately for socioeconomic factors", "D  Publish their results"],
                    correctIndex: 2,
                  },
                ]),
              ],
            },
          },
          {
            order: 3,
            title: "The History of the Printing Press",
            body: `Although moveable type printing is often associated with Johannes Gutenberg's mid-fifteenth-century press in Mainz, earlier forms of the technology existed in East Asia centuries before. Korean craftsmen were casting metal type by the early 1200s, and woodblock printing had been used in China since at least the ninth century.

Gutenberg's innovation lay not in the basic concept of moveable type but in combining it with an oil-based ink, a wooden screw press adapted from wine presses, and a reliable method for casting large quantities of uniform metal letters quickly. This combination made mass production of text commercially viable in Europe for the first time.

The consequences were profound. Within fifty years of Gutenberg's first printed Bible, presses had spread to more than two hundred European cities, and millions of books had been produced — more than all European scribes had copied by hand in the previous thousand years combined. This explosion of printed material is widely credited with accelerating the Reformation, standardising vernacular languages, and laying groundwork for the later Scientific Revolution.`,
            questionGroups: {
              create: [
                tfGroup(21, [
                  { stem: "Gutenberg was the first person in the world to use moveable type.", answer: "FALSE" },
                  { stem: "Korean craftsmen were casting metal type before Gutenberg's press.", answer: "TRUE" },
                  { stem: "Gutenberg invented oil-based ink specifically for his press.", answer: "NOT GIVEN" },
                  { stem: "More books were printed in the fifty years after Gutenberg than scribes had copied in the previous thousand years.", answer: "TRUE" },
                ]),
                saGroup(25, [
                  { stem: "What type of press did Gutenberg adapt his design from?", answers: ["wine presses", "wine press"], wordLimit: 2 },
                  { stem: "In which German city was Gutenberg's press located?", answers: ["Mainz"], wordLimit: 1 },
                  { stem: "Since which century had China used woodblock printing?", answers: ["ninth century", "the ninth century"], wordLimit: 3 },
                ]),
                mcGroup(28, [
                  {
                    stem: "By the early 1200s, what were Korean craftsmen casting?",
                    options: ["A  Wooden blocks", "B  Metal type", "C  Stone tablets", "D  Paper moulds"],
                    correctIndex: 1,
                  },
                  {
                    stem: "What is credited with accelerating the Reformation?",
                    options: ["A  The wine industry", "B  The explosion of printed material", "C  Korean woodblock printing", "D  Handwritten manuscripts"],
                    correctIndex: 1,
                  },
                  {
                    stem: "How many European cities had presses within fifty years of Gutenberg's Bible?",
                    options: ["A  Fifty", "B  A hundred", "C  More than two hundred", "D  A thousand"],
                    correctIndex: 2,
                  },
                ]),
              ],
            },
          },
          {
            order: 4,
            title: "Octopus Cognition and Camouflage",
            body: `Octopuses possess the largest nervous system of any invertebrate, yet unlike vertebrate brains, roughly two-thirds of their neurons are distributed throughout their eight arms rather than concentrated in a central brain. This unusual architecture allows each arm to process sensory information and execute coordinated movements with a surprising degree of independence.

Laboratory studies have demonstrated that octopuses can learn to navigate mazes, open screw-top jars to retrieve food, and even recognise individual human caretakers by sight, despite having no social contact with other octopuses during development. Their camouflage abilities are equally remarkable: specialised skin cells called chromatophores allow an octopus to change colour and texture within a fraction of a second, matching surrounding rock or coral with striking precision.

Because octopuses are solitary and typically live only one to two years, researchers have long puzzled over how such sophisticated intelligence evolved without the social learning pressures usually associated with complex cognition in mammals and birds. Some scientists now argue that predation pressure alone may be sufficient to drive the evolution of advanced problem-solving abilities.`,
            questionGroups: {
              create: [
                tfGroup(31, [
                  { stem: "Most of an octopus's neurons are located in its central brain.", answer: "FALSE" },
                  { stem: "Octopuses can recognise individual human caretakers by sight.", answer: "TRUE" },
                  { stem: "Octopuses typically live for ten to twenty years.", answer: "FALSE" },
                  { stem: "Scientists have definitively proven why octopus intelligence evolved.", answer: "NOT GIVEN" },
                ]),
                saGroup(35, [
                  { stem: "What are the skin cells called that allow an octopus to change colour?", answers: ["chromatophores"], wordLimit: 1 },
                  { stem: "How many arms does an octopus have?", answers: ["eight"], wordLimit: 1 },
                  { stem: "What pressure might alone drive advanced problem-solving, according to some scientists?", answers: ["predation pressure"], wordLimit: 2 },
                ]),
                mcGroup(38, [
                  {
                    stem: "What fraction of an octopus's neurons are found in its arms?",
                    options: ["A  One-third", "B  Half", "C  Two-thirds", "D  All"],
                    correctIndex: 2,
                  },
                  {
                    stem: "What can octopuses do in laboratory studies, according to the passage?",
                    options: ["A  Build tools", "B  Open screw-top jars", "C  Communicate with sounds", "D  Swim in groups"],
                    correctIndex: 1,
                  },
                  {
                    stem: "What is unusual about how octopus intelligence evolved, according to researchers?",
                    options: ["A  It required a large social group", "B  It occurred without typical social learning pressures", "C  It evolved only in captivity", "D  It is identical to mammalian intelligence"],
                    correctIndex: 1,
                  },
                ]),
              ],
            },
          },
        ],
      },
    },
  });

  await Promise.all(
    students.map((s) =>
      prisma.assignment.create({
        data: { testId: test2.id, teacherId: teacher.id, studentId: s.id },
      })
    )
  );

  // --- Simulated attempt history for demo dashboards -----------------------
  const [ali, fatima, john] = students;

  const test1Questions = await prisma.question.findMany({
    where: { group: { passage: { testId: test.id } } },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      options: true,
      wordLimit: true,
      answerKey: { select: { acceptedAnswers: true } },
      group: { select: { questionType: true } },
    },
  });
  const test2Questions = await prisma.question.findMany({
    where: { group: { passage: { testId: test2.id } } },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      options: true,
      wordLimit: true,
      answerKey: { select: { acceptedAnswers: true } },
      group: { select: { questionType: true } },
    },
  });
  const flatten = (qs: typeof test1Questions): SeedQuestion[] =>
    qs.map((q) => ({
      id: q.id,
      number: q.number,
      questionType: q.group.questionType,
      options: q.options,
      wordLimit: q.wordLimit,
      answerKey: q.answerKey,
    }));

  // Test 1 (11 Qs, no band) — one submitted attempt each
  await simulateAttempt({
    studentId: ali.id, testId: test.id, questions: flatten(test1Questions),
    durationSec: test.durationMin * 60, correctFraction: 0.82, daysAgo: 21,
    finalStatus: "SUBMITTED", seed: 101,
  });
  await simulateAttempt({
    studentId: fatima.id, testId: test.id, questions: flatten(test1Questions),
    durationSec: test.durationMin * 60, correctFraction: 0.64, daysAgo: 18,
    finalStatus: "SUBMITTED", seed: 102,
  });

  // John's first attempt at test 1 was cut short by a tab-switch violation.
  await simulateAttempt({
    studentId: john.id, testId: test.id, questions: flatten(test1Questions),
    durationSec: test.durationMin * 60, correctFraction: 0.4, daysAgo: 25,
    finalStatus: "TERMINATED_VIOLATION", seed: 103,
  });
  // He retook it a few days later and finished cleanly.
  await simulateAttempt({
    studentId: john.id, testId: test.id, questions: flatten(test1Questions),
    durationSec: test.durationMin * 60, correctFraction: 0.73, daysAgo: 20,
    finalStatus: "SUBMITTED", seed: 104,
  });

  // Test 2 (40 Qs, band estimate applies) — spread across a wider score range
  await simulateAttempt({
    studentId: ali.id, testId: test2.id, questions: flatten(test2Questions),
    durationSec: test2.durationMin * 60, correctFraction: 0.85, daysAgo: 9,
    finalStatus: "SUBMITTED", seed: 201,
  });
  await simulateAttempt({
    studentId: fatima.id, testId: test2.id, questions: flatten(test2Questions),
    durationSec: test2.durationMin * 60, correctFraction: 0.55, daysAgo: 6,
    finalStatus: "SUBMITTED", seed: 202,
  });
  await simulateAttempt({
    studentId: john.id, testId: test2.id, questions: flatten(test2Questions),
    durationSec: test2.durationMin * 60, correctFraction: 0.68, daysAgo: 4,
    finalStatus: "SUBMITTED", seed: 203,
  });

  // Fatima is mid-way through a retake right now — shows up as "in progress".
  const retake = await prisma.testAttempt.create({
    data: {
      testId: test2.id,
      studentId: fatima.id,
      status: "IN_PROGRESS",
      startedAt: new Date(),
      timeLimitSec: test2.durationMin * 60,
      serverDeadline: new Date(Date.now() + test2.durationMin * 60 * 1000),
      totalQuestions: test2Questions.length,
    },
  });
  const t2 = flatten(test2Questions);
  await prisma.studentAnswer.createMany({
    data: t2.slice(0, 14).map((q) => ({
      attemptId: retake.id,
      questionId: q.id,
      answer: (q.answerKey?.acceptedAnswers as string[] | undefined)?.[0] ?? "",
    })),
  });

  // --- Broader activity history (logins) for the heatmaps ------------------
  const activityRand = mulberry32(777);
  const activityRows: { userId: string; type: string; date: Date }[] = [];
  for (const s of students) {
    for (let d = 0; d < 70; d++) {
      if (activityRand() > 0.55) continue; // skip most days
      const count = 1 + Math.floor(activityRand() * 3);
      for (let c = 0; c < count; c++) {
        const date = new Date();
        date.setDate(date.getDate() - d);
        date.setHours(8 + Math.floor(activityRand() * 12));
        activityRows.push({ userId: s.id, type: "LOGIN", date });
      }
    }
  }
  await prisma.activityEvent.createMany({ data: activityRows });

  // Seed band config
  const bandTable: [number, number][] = [
    [40, 9.0], [39, 9.0], [38, 8.5], [37, 8.5], [36, 8.0], [35, 8.0],
    [34, 7.5], [33, 7.5], [32, 7.0], [31, 7.0], [30, 7.0],
    [29, 6.5], [28, 6.5], [27, 6.5],
    [26, 6.0], [25, 6.0], [24, 6.0], [23, 6.0],
    [22, 5.5], [21, 5.5], [20, 5.5], [19, 5.5],
    [18, 5.0], [17, 5.0], [16, 5.0], [15, 5.0],
    [14, 4.5], [13, 4.5],
    [12, 4.0], [11, 4.0], [10, 4.0],
    [9, 3.5], [8, 3.5],
    [7, 3.0], [6, 3.0],
    [5, 2.5], [4, 2.5],
    [3, 2.0], [2, 2.0],
    [1, 1.0], [0, 0.0],
  ];

  for (const [score, band] of bandTable) {
    await prisma.bandConfig.upsert({
      where: { skill_rawScore: { skill: "READING", rawScore: score } },
      update: { band },
      create: { skill: "READING", rawScore: score, band },
    });
  }

  console.log("✓ Seed complete");
  console.log("  Teacher:  teacher@ielts.demo / teacher123");
  console.log("  Students: ali@ielts.demo / student123");
  console.log("            fatima@ielts.demo / student123");
  console.log("            john@ielts.demo / student123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
