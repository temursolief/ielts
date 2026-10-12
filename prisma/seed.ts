import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

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
