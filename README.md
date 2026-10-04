# AI Interview Prep Kit

A full-stack web application that turns a job description into a personalised interview preparation kit. Paste a job description, provide the company website, and specify how many days you have — the app crawls the company site, researches their interview process, and generates a structured prep kit.

## Tech Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Frontend | Next.js 15 + Tailwind CSS | Preferred stack. Server components for initial load, client components for interactivity. |
| Backend | Node.js + Express | Preferred stack. Clean separation of concerns, easy to test. |
| Database | MongoDB + Mongoose | Flexible schema for kit structures, easy to query. |
| LLM | Ollama (local, llama3.2:1b) | Runs locally, no API key, no rate limits, no token caps. Free tier friendly. |
| Language | TypeScript | Type safety across the full stack. |

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Ollama with `llama3.2:1b` pulled (`ollama pull llama3.2:1b`) — runs locally, no API key

### Project Structure

```
interview-prep-kit/
├── frontend/          # Next.js app
│   ├── app/           # Pages and routes
│   └── lib/           # API client, auth, types
├── backend/           # Express server
│   ├── src/
│   │   ├── routes/    # API routes
│   │   ├── services/  # Business logic (+ colocated vitest tests)
│   │   ├── models/    # MongoDB models
│   │   ├── middleware/# Auth middleware
│   │   ├── types/     # Shared types
│   │   ├── config/    # Env-based config
│   │   └── batch/     # Batch evaluation entry point
│   └── cases.example.json
├── .env.example
└── package.json       # Root workspace config
```

### Installation

```bash
# Clone and install
git clone <repo-url>
cd interview-prep-kit
npm install

# Configure environment
cp .env.example .env
# Edit .env with your MongoDB URI

# Run development servers
npm run dev
```

The frontend runs on `http://localhost:3000`, the backend on `http://localhost:4000`.

### Batch Entry Point

```bash
npm run evaluate -- --input cases.json --output kits.json
```

Reads an array of cases from a JSON file, runs the full pipeline on each, and writes results to the output file. See [Batch Processing](#batch-processing) for details.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (Next.js)                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Auth     │ │ Kit List │ │ Builder  │ │ Practice  │  │
│  │ Pages    │ │ Page     │ │ Page     │ │ Mode      │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │ /api/* (proxied)
┌──────────────────────┴──────────────────────────────────┐
│  Backend (Express)                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Auth     │ │ Kit      │ │ Practice │ │ Batch     │  │
│  │ Routes   │ │ Routes   │ │ Routes   │ │ Runner    │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Services                                         │  │
│  │ ┌────────┐ ┌──────────┐ ┌───────────┐ ┌───────┐ │  │
│  │ │Auth    │ │Crawler   │ │LLM        │ │Extrac-│ │  │
│  │ │Service │ │Service   │ │Service    │ │tion   │ │  │
│  │ └────────┘ └──────────┘ └───────────┘ └───────┘ │  │
│  │ ┌──────────┐ ┌──────────┐ ┌───────────────────┐ │  │
│  │ │Genera-  │ │Schedule  │ │Coverage           │ │  │
│  │ │tion     │ │Service   │ │Service            │ │  │
│  │ └──────────┘ └──────────┘ └───────────────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │
              ┌────────┴────────┐
              │    MongoDB      │
              └─────────────────┘
```

## Research & Generation Pipeline

The kit is produced through a sequence of deliberate steps:

### Step 1: Requirement Extraction (LLM)
The job description is sent to the LLM with instructions to extract structured requirements. Each requirement is classified as `technical`, `behavioural`, or `domain`, and marked `must` or `nice` based on the posting's wording. A thin JD produces a thin result — no requirements are invented.

### Step 2: Company Site Crawl (Deterministic)
The crawler starts at the company URL and:
1. Fetches `robots.txt` and respects it
2. Fetches the homepage, extracts links
3. Scores each link for hiring/about relevance using keyword matching
4. Fetches the most promising pages (up to 15)
5. Classifies pages as hiring-related or about-related

Pages that fail (404, timeout, wrong content type) are skipped and recorded, not fatal.

### Step 3: Question Generation (LLM, per category)
Questions are generated **separately per category** (technical, behavioural, system-design, company-fit). Each category gets its own LLM call with category-specific instructions. A company that publishes a take-home followed by system design produces different questions from one that says nothing.

### Step 4: Coverage Check (Deterministic)
After the first draft, the system compares question `requirement_ids` against the extracted requirements. Any requirement with no question is a gap. This is code's decision, not the model's.

### Step 5: Second Pass (LLM)
For each gap, the system generates additional questions targeting the uncovered requirements. The coverage check runs again. Up to 3 passes total — enough to close gaps without wasting tokens on diminishing returns.

### Step 6: Flashcard Generation (LLM)
Flashcards are distilled from the generated questions for quick review.

### Step 7: Schedule Allocation (Deterministic)
The schedule is built by code, not the model:
- Questions are scored by priority (must-have requirements first) and difficulty
- Harder, higher-priority material is distributed earlier
- Every must-have requirement appears in at least one day
- Minutes are integers, scaled by question count per day

## Generated/Edited/Pinned State

Each question and flashcard has an `origin` field:
- **`generated`**: Created by the LLM. Can be regenerated away.
- **`edited`**: Modified by the user. Survives regeneration.
- **`pinned`**: Created by the user. Survives regeneration.

When a section is regenerated, items with `origin: "edited"` or `origin: "pinned"` are preserved. Only `generated` items are replaced.

## Schedule Allocation

The schedule service distributes questions across exactly the requested number of days:

1. **Score questions**: `score = (has_must_requirement ? 100 : 0) + difficulty * 10`
2. **Sort by score descending**: Harder, higher-priority questions first
3. **First pass**: Ensure every must-have requirement is covered by placing questions on the earliest available day
4. **Second pass**: Distribute remaining questions using load balancing (fewest questions first)
5. **Calculate minutes**: `min(60 + questions * 15, 180)` per day
6. **Generate focus**: Based on categories and must-have count for each day

## Batch Processing

The batch entry point (`npm run evaluate -- --input cases.json --output kits.json`, see above) runs the same pipeline as the web interface:

**Input format:**
```json
[
  { "id": "case-01", "jd": "Senior Backend Engineer\n\n...", "company_url": "https://example.com", "days": 5 }
]
```

**Output format:**
```json
{
  "version": "1.0",
  "generated_at": "2026-09-01T09:12:44Z",
  "kits": [
    { "id": "case-01", "status": "ok", "kit": { ... }, "error": null },
    { "id": "case-02", "status": "failed", "kit": null, "error": { "code": "...", "message": "..." } }
  ]
}
```

A case is `failed` only if no kit could be produced at all. Partial research (missing hiring page, thin JD) is recorded honestly in the kit with `status: "ok"`.

## Practice Mode

Flashcards are presented one at a time with a reveal-answer interaction. Users rate confidence 1-5 after each card. The ordering uses a **confidence-weighted sort**: cards with lower confidence scores appear first, so weak areas get more attention. This is simpler than full spaced repetition but effective for short preparation windows.

## Security

- **Authentication**: JWT-based with bcrypt password hashing (12 rounds)
- **Authorization**: Users can only access their own kits (checked on every request)
- **URL validation**: External URLs are validated before fetching; private/loopback addresses rejected
- **Content restrictions**: Only HTML/XHTML pages fetched, max 5MB
- **Rate limiting**: 30 requests/minute per IP on API routes
- **CSP headers**: Helmet.js for security headers
- **Untrusted content**: All fetched text is treated as data, never instructions to the model

## Testing

```bash
npm test
```

Tests cover:
- Schedule allocation (correct days, must-have coverage, integer minutes, difficulty ordering)
- Coverage checking (gap detection, completeness validation)
- Kit structure validation (required fields, enums, integer minutes/difficulty)

## Deployment

All free tiers. The repo includes `render.yaml`, so Render picks up the backend config automatically.

### 1. MongoDB Atlas (free M0)
Create a cluster → Database Access user → Network Access `0.0.0.0/0` → copy the connection URI. Render cannot reach your localhost Mongo, so this step is required.

### 2. Backend on Render (free Web Service)
New → Web Service → select this repo. `render.yaml` fills in the rest; you only set:
- `MONGODB_URI` = your Atlas URI
- `CORS_ORIGIN` = your Vercel URL (after step 3)
- `JWT_SECRET` is auto-generated.

No LLM key needed: the backend tries local Ollama, and on Render (where there is none) it falls back to the hosted free tier automatically.

### 3. Frontend on Vercel
Import the same repo → set Root Directory to `frontend` → add env var `API_URL` = your Render backend URL (e.g. `https://interview-prep-api.onrender.com`). Then go back and set Render's `CORS_ORIGIN` to the Vercel URL.

Note: Render free sleeps after inactivity, so the first request takes ~1 min to wake up.

## Environment Variables

| Variable | Purpose | Frontend | Backend |
|----------|---------|----------|---------|
| `PORT` | Backend port (default: 4000) | — | ✅ |
| `MONGODB_URI` | MongoDB connection string | — | ✅ |
| `JWT_SECRET` | Secret for JWT signing | — | ✅ |
| `JWT_EXPIRES_IN` | Token expiry (default: 7d) | — | ✅ |
| `LLM_PROVIDER` | LLM backend: `ollama` (default) | — | ✅ |
| `OLLAMA_URL` | Ollama server (default: http://localhost:11434) | — | ✅ |
| `OLLAMA_MODEL` | Ollama model (default: llama3.2:1b) | — | ✅ |
| `API_URL` | Backend URL | ✅ | — |
| `CORS_ORIGIN` | Allowed frontend origin | — | ✅ |
| `MAX_PAGES_PER_CRAWL` | Max pages to fetch per company (default: 15) | — | ✅ |
| `CRAWL_TIMEOUT_MS` | Fetch timeout (default: 10000) | — | ✅ |
| `LLM_TIMEOUT_MS` | LLM request timeout (default: 60000) | — | ✅ |
| `RATE_LIMIT_PER_MINUTE` | API rate limit (default: 30) | — | ✅ |

## Known Limitations

- **Ollama required**: The pipeline needs a local Ollama server with the configured model pulled (`ollama pull llama3.2:1b`). It runs offline with no API key and no token caps.
- **Crawler depth**: Limited to 2 levels deep to avoid fetching the entire site.
- **Question quality**: LLM-generated questions may need user refinement. The builder is designed for this.
- **No real-time updates**: Kit generation is synchronous; very long generations may need polling.
- **Provider abstraction**: Ollama is the default; the LLM service is abstracted enough to add providers.

## Design Decisions

1. **Separate Express server**: Chose a separate backend over Next.js API routes for cleaner separation of concerns and independent scaling.
2. **Ollama over hosted free tiers**: No API key, no cost, no signup, no per-minute token caps — a local model keeps the pipeline deterministic and offline-friendly, which matters for the batch entry point running from a clean clone.
3. **Confidence-weighted practice**: Chose simple confidence sorting over spaced repetition because preparation windows are typically short (1-60 days).
4. **3 coverage passes**: Enough to close gaps without excessive token usage. Most gaps close in pass 2.
5. **Origin tracking**: Simple enum field rather than complex diff tracking. Easy to understand and debug.
