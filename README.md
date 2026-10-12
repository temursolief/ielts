# IELTS Practice Platform

Full-stack IELTS preparation platform for teachers and students. Phase 1: Reading practice, dashboards, analytics.

## Stack

- **Frontend/Backend**: Next.js 16 + TypeScript + Tailwind CSS v4
- **Database**: PostgreSQL + Prisma ORM v5
- **Auth**: NextAuth v5 (credentials, JWT)

## Setup

### Prerequisites

- Node.js 20+
- PostgreSQL running locally

### Install

```bash
npm install
DATABASE_URL="postgresql://..." npx prisma generate
```

### Configure

```bash
cp .env.example .env.local
# Edit DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
```

Generate `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

### Database

```bash
npm run db:migrate    # Run migrations
npm run db:seed       # Seed demo data
```

Demo accounts:
| Role | Email | Password |
|---|---|---|
| Teacher | `teacher@ielts.demo` | `teacher123` |
| Student | `ali@ielts.demo` | `student123` |
| Student | `fatima@ielts.demo` | `student123` |
| Student | `john@ielts.demo` | `student123` |

### Run

```bash
npm run dev
```

→ [http://localhost:3000](http://localhost:3000)

---

## Reading Test JSON Format

Schema version: `1.0`. Import via teacher dashboard → Reading Tests → Import test.

```json
{
  "schemaVersion": "1.0",
  "title": "IELTS Academic Reading Practice Test 1",
  "durationMinutes": 60,
  "passages": [
    {
      "order": 1,
      "title": "Passage Title",
      "body": "Full passage text here...",
      "questionGroups": [
        {
          "type": "TRUE_FALSE_NOT_GIVEN",
          "instructions": "Do the following statements agree with the information...",
          "questions": [
            {
              "number": 1,
              "stem": "Statement to evaluate.",
              "correctAnswers": ["TRUE"]
            }
          ]
        },
        {
          "type": "MATCHING_HEADINGS",
          "instructions": "Match each paragraph with a heading.",
          "options": ["The origins of...", "A new approach to...", "Criticisms of..."],
          "questions": [
            {
              "number": 2,
              "stem": "Paragraph A",
              "correctAnswers": ["The origins of..."]
            }
          ]
        }
      ]
    }
  ]
}
```

### Supported question types

| Type | Notes |
|---|---|
| `MULTIPLE_CHOICE_SINGLE` | Options at group or question level |
| `MULTIPLE_CHOICE_MULTI` | Options at group or question level |
| `TRUE_FALSE_NOT_GIVEN` | Buttons: TRUE / FALSE / NOT GIVEN |
| `YES_NO_NOT_GIVEN` | Buttons: YES / NO / NOT GIVEN |
| `MATCHING_HEADINGS` | Requires group-level `options` array |
| `MATCHING_INFORMATION` | Requires group-level `options` array |
| `MATCHING_FEATURES` | Requires group-level `options` array |
| `MATCHING_SENTENCE_ENDINGS` | Requires group-level `options` array |
| `SENTENCE_COMPLETION` | Optional `wordLimit` per question |
| `SUMMARY_COMPLETION` | Optional `wordLimit` per question |
| `NOTE_COMPLETION` | Optional `wordLimit` per question |
| `TABLE_COMPLETION` | Optional `wordLimit` per question |
| `FLOWCHART_COMPLETION` | Optional `wordLimit` per question |
| `DIAGRAM_LABEL` | Optional `wordLimit` per question |
| `SHORT_ANSWER` | Optional `wordLimit` per question |

---

## Anti-Cheating

Tab switching during exam → immediate termination:

1. Detected via `visibilitychange` browser API
2. `POST /api/student/attempts/[id]/terminate` called immediately
3. Server grades saved answers, marks attempt `TERMINATED_VIOLATION`
4. Attempt locked — cannot resume by refresh or URL manipulation
5. Teacher can reset via test management page
6. Partial raw score displayed (not presented as IELTS band)

---

## Architecture Notes

### Future modules

**Listening**: Extend `TestSkill` enum, add audio URL/timing fields to `Passage`, reuse `QuestionGroup`/`Question`/`AnswerKey` pattern. No structural changes needed to core scoring or analytics.

**Writing/Speaking AI assessment** (not activated in Phase 1):
```
AssessmentResult {
  attemptId, skillType, criterionScores (JSON),
  overallBand, feedbackJson, modelId, modelVersion,
  teacherOverride, teacherOverrideAt
}
```
Connect to OpenAI or specialized IELTS assessment API. All AI scores must be labeled as estimates.

### Key design decisions

| Decision | Reason |
|---|---|
| Server-side deadline enforcement | Client clocks can be manipulated |
| Answer keys never sent to client | Security — fetched only during scoring |
| `BandConfig` table for band conversion | Configurable per test type without code changes |
| Activity events as append-only log | Heatmaps + analytics from real data |
| JWT sessions | Stateless, no session table needed |
| `instant = false` on layouts | Next.js 16 pattern for auth-gated pages |

---

## Known limitations (Phase 1)

- No student self-registration (teacher seeds/creates accounts)
- Listening, Writing, Speaking not built
- No AI assessment
- Email/push notifications not implemented
- No bulk CSV student import
- No admin panel
