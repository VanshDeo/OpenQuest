---
name: OpenQuest-frontend-rag-integration
description: >
  Use this skill to integrate the OpenQuest RAG backend with the
  Next.js frontend. Triggers when asked to connect RAG to frontend, display repo
  analysis data, show GitHub issues as quests, fetch community health, show
  difficulty scores, or wire any API endpoint to a frontend component. Use this
  skill any time the task involves connecting apps/api RAG output to apps/web UI,
  fetching GitHub repo metadata, mapping issues to XP/difficulty, or adapting
  difficulty based on user skill profile.
---

# OpenQuest Frontend ↔ RAG Integration Skill

## Overview

This skill guides the full integration between the `apps/api` RAG backend and
the `apps/web` Next.js frontend. It covers:

1. Wiring the repo analysis API to the frontend repo card UI
2. Displaying community health signals from GitHub
3. Fetching and rendering GitHub issues as gamified quests with XP
4. Adapting difficulty based on user skill profile from onboarding
5. Minor RAG additions for community health scoring

---

## Project Context

```
apps/api/src/
├── rag/ingestion/        ← fetches + chunks repo files
├── rag/embeddings/       ← Gemini embeddings
├── rag/retrieval/        ← similarity search + context assembly
├── rag/vectorstore/      ← pgvector writer
├── modules/              ← domain logic (repo analysis, skill profile)
├── routes/
│   ├── indexRepo.route.ts     ← POST /api/index, GET /api/index/status/:jobId
│   └── ragQuery.route.ts      ← POST /api/rag/query

apps/web/
├── app/                  ← Next.js App Router pages
├── components/           ← React UI components
├── hooks/                ← TanStack Query hooks
└── lib/                  ← frontend utility functions
```

---

## Step 1 — Read the Frontend First

Before writing any code, read these files to understand the existing UI:

```bash
# Understand the page structure
find apps/web/app -name "*.tsx" | head -20

# Understand existing components
find apps/web/components -name "*.tsx"

# Understand existing hooks
find apps/web/hooks -name "*.ts"

# Check if any API client already exists
cat apps/web/lib/*.ts 2>/dev/null || echo "No lib files yet"
```

Then read the key component files to understand:
- Where repo cards are rendered
- Where issues/quests are shown
- Where user skill profile data is stored (from onboarding)
- What props each component expects

---

## Step 2 — Create the API Client

Create `apps/web/lib/apiClient.ts` as the single source of truth for all
backend calls. Never call `fetch` directly from components.

```typescript
// apps/web/lib/apiClient.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ── Repo Indexing ─────────────────────────────────────────────────────────────

export async function indexRepository(githubUrl: string): Promise<{ jobId: string }> {
  const res = await fetch(`${API_BASE}/api/index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ githubUrl }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getIndexStatus(jobId: string): Promise<{
  state: "waiting" | "active" | "completed" | "failed";
  progress: number;
  result?: { repoId: string; chunksWritten: number };
}> {
  const res = await fetch(`${API_BASE}/api/index/status/${jobId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Repo Analysis ─────────────────────────────────────────────────────────────

export async function analyzeRepository(githubUrl: string): Promise<RepoAnalysis> {
  const res = await fetch(`${API_BASE}/api/repo/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ githubUrl }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Issues as Quests ──────────────────────────────────────────────────────────

export async function getRepoQuests(
  repoId: string,
  userLevel: number
): Promise<Quest[]> {
  const res = await fetch(
    `${API_BASE}/api/repo/${encodeURIComponent(repoId)}/quests?userLevel=${userLevel}`
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── RAG Query ─────────────────────────────────────────────────────────────────

export async function queryCodebase(
  repoId: string,
  query: string
): Promise<RAGQueryResult> {
  const res = await fetch(`${API_BASE}/api/rag/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoId, query }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

---

## Step 3 — Define Shared Types

Create `packages/shared-types/src/index.ts` with these types (or add to
existing file if it already exists):

```typescript
// RepoAnalysis — returned by POST /api/repo/analyze
export interface RepoAnalysis {
  repoId: string;           // "owner/repo"
  name: string;             // "express"
  fullName: string;         // "expressjs/express"
  description: string;      // one-line purpose
  stars: number;
  forks: number;
  openIssues: number;
  contributorCount: number;
  techStack: string[];      // ["Node.js", "JavaScript", "Express"]
  purpose: string;          // AI-generated plain English explanation
  difficultyScore: number;  // 1-100
  difficultyLabel: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  communityHealth: CommunityHealth;
  defaultBranch: string;
}

export interface CommunityHealth {
  score: number;            // 0-100
  label: "Inactive" | "Low" | "Moderate" | "Active" | "Very Active";
  lastCommitDays: number;   // days since last commit
  commitFrequency: string;  // "Daily" | "Weekly" | "Monthly" | "Rarely"
  hasContributingGuide: boolean;
  hasCodeOfConduct: boolean;
  avgIssueResponseDays: number;
  recentContributors: number; // unique contributors in last 30 days
}

// Quest — a GitHub issue transformed into a gamified quest
export interface Quest {
  id: number;               // GitHub issue number
  title: string;
  body: string;
  url: string;              // GitHub issue URL
  labels: string[];
  difficultyScore: number;  // 1-100, adapted to user level
  difficultyLabel: "Beginner" | "Intermediate" | "Advanced" | "Expert";
  xpReward: number;         // XP earned for completing this quest
  estimatedMinutes: number; // estimated time to fix
  isGoodFirstIssue: boolean;
  assignedTo: string | null;
}

// RAG query result
export interface RAGQueryResult {
  answer: string;
  citations: Record<string, {
    filePath: string;
    startLine: number;
    endLine: number;
    symbolName?: string | null;
  }>;
  chunks: Array<{
    filePath: string;
    startLine: number;
    endLine: number;
    symbolName?: string | null;
    score: number;
    language: string;
  }>;
  meta: {
    repoId: string;
    query: string;
    totalCandidates: number;
    chunksUsed: number;
    retrievalMs: number;
  };
}

// User skill profile — from onboarding questions
export interface UserSkillProfile {
  userId: string;
  level: number;            // 1-10 overall coding level
  experienceYears: number;
  languages: string[];      // ["JavaScript", "Python"]
  frameworks: string[];     // ["React", "Express"]
  preferredDifficulty: "Beginner" | "Intermediate" | "Advanced";
  completedQuests: number;
  totalXP: number;
}
```

---

## Step 4 — Backend: Repo Analysis Route

Create `apps/api/src/routes/repoAnalysis.route.ts`:

```typescript
import { Router } from "express";
import { Octokit } from "@octokit/rest";
import { parseGitHubUrl } from "../rag/ingestion/githubFetcher";

export function createRepoAnalysisRouter(): Router {
  const router = Router();

  // POST /api/repo/analyze
  router.post("/analyze", async (req, res) => {
    const { githubUrl } = req.body;
    if (!githubUrl) return res.status(400).json({ error: "githubUrl required" });

    try {
      const { owner, repo } = parseGitHubUrl(githubUrl);
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

      // Fetch in parallel
      const [repoData, contributors, commits, communityProfile] = await Promise.allSettled([
        octokit.repos.get({ owner, repo }),
        octokit.repos.listContributors({ owner, repo, per_page: 100 }),
        octokit.repos.listCommits({ owner, repo, per_page: 30 }),
        octokit.repos.getCommunityProfileMetrics({ owner, repo }),
      ]);

      const r = repoData.status === "fulfilled" ? repoData.value.data : null;
      if (!r) return res.status(404).json({ error: "Repo not found" });

      const contribCount = contributors.status === "fulfilled"
        ? contributors.value.data.length : 0;

      const lastCommit = commits.status === "fulfilled" && commits.value.data[0]
        ? new Date(commits.value.data[0].commit.author?.date ?? "")
        : null;

      const lastCommitDays = lastCommit
        ? Math.floor((Date.now() - lastCommit.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      // Recent contributors (last 30 days)
      const recentContribs = commits.status === "fulfilled"
        ? new Set(
            commits.value.data
              .filter(c => {
                const d = new Date(c.commit.author?.date ?? "");
                return (Date.now() - d.getTime()) < 30 * 24 * 60 * 60 * 1000;
              })
              .map(c => c.author?.login)
              .filter(Boolean)
          ).size
        : 0;

      const communityHealth = buildCommunityHealth(
        lastCommitDays,
        recentContribs,
        communityProfile
      );

      const techStack = detectTechStack(r.language, r.topics ?? []);
      const difficultyScore = computeDifficultyScore(r, contribCount);

      return res.json({
        repoId: `${owner}/${repo}`,
        name: r.name,
        fullName: r.full_name,
        description: r.description ?? "",
        stars: r.stargazers_count,
        forks: r.forks_count,
        openIssues: r.open_issues_count,
        contributorCount: contribCount,
        techStack,
        purpose: r.description ?? "No description provided.",
        difficultyScore,
        difficultyLabel: getDifficultyLabel(difficultyScore),
        communityHealth,
        defaultBranch: r.default_branch,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}

// ─── Community Health ─────────────────────────────────────────────────────────

function buildCommunityHealth(
  lastCommitDays: number,
  recentContributors: number,
  communityProfile: PromiseSettledResult<any>
): any {
  const hasContribGuide = communityProfile.status === "fulfilled"
    ? !!communityProfile.value.data.files?.contributing
    : false;
  const hasCoC = communityProfile.status === "fulfilled"
    ? !!communityProfile.value.data.files?.code_of_conduct
    : false;

  // Score based on recency + contributors
  let score = 100;
  if (lastCommitDays > 365) score -= 60;
  else if (lastCommitDays > 180) score -= 40;
  else if (lastCommitDays > 90) score -= 20;
  else if (lastCommitDays > 30) score -= 10;

  if (recentContributors === 0) score -= 20;
  else if (recentContributors < 3) score -= 10;

  if (hasContribGuide) score += 5;
  if (hasCoC) score += 5;

  score = Math.max(0, Math.min(100, score));

  const label =
    score >= 80 ? "Very Active" :
    score >= 60 ? "Active" :
    score >= 40 ? "Moderate" :
    score >= 20 ? "Low" : "Inactive";

  const commitFrequency =
    lastCommitDays <= 1 ? "Daily" :
    lastCommitDays <= 7 ? "Weekly" :
    lastCommitDays <= 30 ? "Monthly" : "Rarely";

  return {
    score,
    label,
    lastCommitDays,
    commitFrequency,
    hasContributingGuide: hasContribGuide,
    hasCodeOfConduct: hasCoC,
    avgIssueResponseDays: 0, // can be enhanced later
    recentContributors,
  };
}

function detectTechStack(primaryLanguage: string | null, topics: string[]): string[] {
  const stack = new Set<string>();
  if (primaryLanguage) stack.add(primaryLanguage);
  const known = ["react", "nextjs", "vue", "angular", "express", "fastapi",
    "django", "flask", "postgres", "mongodb", "redis", "docker", "kubernetes",
    "graphql", "typescript", "rust", "go", "python", "java"];
  for (const topic of topics) {
    if (known.includes(topic.toLowerCase())) stack.add(topic);
  }
  return Array.from(stack).slice(0, 8);
}

function computeDifficultyScore(repo: any, contributorCount: number): number {
  let score = 50;
  // Larger repos = harder
  if (repo.size > 100000) score += 20;
  else if (repo.size > 10000) score += 10;
  // More contributors = more complex codebase
  if (contributorCount > 100) score += 15;
  else if (contributorCount > 20) score += 8;
  // Age — older repos have more context to understand
  const ageYears = (Date.now() - new Date(repo.created_at).getTime()) / (1000 * 60 * 60 * 24 * 365);
  if (ageYears > 5) score += 10;
  return Math.min(100, Math.max(1, score));
}

function getDifficultyLabel(score: number): string {
  if (score <= 25) return "Beginner";
  if (score <= 50) return "Intermediate";
  if (score <= 75) return "Advanced";
  return "Expert";
}
```

---

## Step 5 — Backend: Issues as Quests Route

Create `apps/api/src/routes/quests.route.ts`:

```typescript
import { Router } from "express";
import { Octokit } from "@octokit/rest";

export function createQuestsRouter(): Router {
  const router = Router();

  // GET /api/repo/:repoId/quests?userLevel=5
  router.get("/:repoId(*)/quests", async (req, res) => {
    const repoId = req.params.repoId;       // "owner/repo"
    const userLevel = parseInt(req.query.userLevel as string) || 5; // 1-10

    const [owner, repo] = repoId.split("/");
    if (!owner || !repo) return res.status(400).json({ error: "Invalid repoId" });

    try {
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

      const { data: issues } = await octokit.issues.listForRepo({
        owner, repo,
        state: "open",
        per_page: 50,
        sort: "updated",
      });

      // Filter out pull requests (GitHub API returns both)
      const realIssues = issues.filter(i => !i.pull_request);

      const quests = realIssues.map(issue => {
        const labels = issue.labels.map((l: any) =>
          typeof l === "string" ? l : l.name ?? ""
        );

        const isGoodFirstIssue = labels.some(l =>
          l.toLowerCase().includes("good first issue") ||
          l.toLowerCase().includes("beginner") ||
          l.toLowerCase().includes("easy")
        );

        // Base difficulty from labels
        let baseDifficulty = isGoodFirstIssue ? 20 : 50;
        if (labels.some(l => l.toLowerCase().includes("hard") || l.toLowerCase().includes("complex"))) {
          baseDifficulty = 80;
        }

        // Adapt difficulty to user level (1-10 scale mapped to 1-100)
        const userDifficultyThreshold = userLevel * 10;
        const relativeScore = Math.round(
          (baseDifficulty / userDifficultyThreshold) * 50
        );
        const difficultyScore = Math.min(100, Math.max(1, relativeScore));

        // XP scales with difficulty
        const xpReward = Math.round(50 + (difficultyScore / 100) * 450); // 50–500 XP

        return {
          id: issue.number,
          title: issue.title,
          body: issue.body ?? "",
          url: issue.html_url,
          labels,
          difficultyScore,
          difficultyLabel: getDifficultyLabel(difficultyScore),
          xpReward,
          estimatedMinutes: Math.round(30 + (difficultyScore / 100) * 330), // 30–360 min
          isGoodFirstIssue,
          assignedTo: issue.assignee?.login ?? null,
        };
      });

      // Sort: unassigned first, then by closest to user's level
      const sorted = quests.sort((a, b) => {
        if (a.assignedTo && !b.assignedTo) return 1;
        if (!a.assignedTo && b.assignedTo) return -1;
        return Math.abs(a.difficultyScore - 50) - Math.abs(b.difficultyScore - 50);
      });

      return res.json(sorted);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}

function getDifficultyLabel(score: number): string {
  if (score <= 25) return "Beginner";
  if (score <= 50) return "Intermediate";
  if (score <= 75) return "Advanced";
  return "Expert";
}
```

---

## Step 6 — Register All Routes in Express App

Find the main Express app file (`apps/api/src/index.ts` or `app.ts`) and
register all routes:

```typescript
import { createIndexRepoRouter } from "./routes/indexRepo.route";
import { createRagQueryRouter } from "./routes/ragQuery.route";
import { createRepoAnalysisRouter } from "./routes/repoAnalysis.route";
import { createQuestsRouter } from "./routes/quests.route";

// Register routes
app.use("/api/index", createIndexRepoRouter(redis));
app.use("/api/rag", createRagQueryRouter());
app.use("/api/repo", createRepoAnalysisRouter());
app.use("/api/repo", createQuestsRouter());
```

---

## Step 7 — Frontend Hooks

Create TanStack Query hooks in `apps/web/hooks/`:

```typescript
// apps/web/hooks/useRepoAnalysis.ts
import { useQuery, useMutation } from "@tanstack/react-query";
import { analyzeRepository, indexRepository, getIndexStatus } from "../lib/apiClient";

export function useRepoAnalysis(githubUrl: string | null) {
  return useQuery({
    queryKey: ["repo-analysis", githubUrl],
    queryFn: () => analyzeRepository(githubUrl!),
    enabled: !!githubUrl,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useIndexRepo() {
  return useMutation({
    mutationFn: indexRepository,
  });
}

export function useIndexStatus(jobId: string | null) {
  return useQuery({
    queryKey: ["index-status", jobId],
    queryFn: () => getIndexStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (data) =>
      data?.state === "completed" || data?.state === "failed" ? false : 2000,
  });
}

// apps/web/hooks/useQuests.ts
import { useQuery } from "@tanstack/react-query";
import { getRepoQuests } from "../lib/apiClient";

export function useQuests(repoId: string | null, userLevel: number) {
  return useQuery({
    queryKey: ["quests", repoId, userLevel],
    queryFn: () => getRepoQuests(repoId!, userLevel),
    enabled: !!repoId,
    staleTime: 2 * 60 * 1000,
  });
}

// apps/web/hooks/useRAGQuery.ts
import { useMutation } from "@tanstack/react-query";
import { queryCodebase } from "../lib/apiClient";

export function useRAGQuery(repoId: string) {
  return useMutation({
    mutationFn: (query: string) => queryCodebase(repoId, query),
  });
}
```

---

## Step 8 — Wire Data to Frontend Components

After reading the existing component files (Step 1), map data to props:

### Repo Card Component
```
RepoAnalysis field        → UI element
─────────────────────────────────────────
name                      → Project name heading
stars                     → ⭐ star count badge
forks                     → 🍴 fork count badge
openIssues                → 🐛 issues count badge
contributorCount          → 👥 contributors count badge
techStack                 → tech stack pill list
purpose                   → project description paragraph
difficultyLabel           → difficulty tier badge (color coded)
difficultyScore           → difficulty progress bar
communityHealth.label     → community health badge
communityHealth.score     → health meter/progress bar
communityHealth.commitFrequency → "Updated X" label
```

### Quest Card Component
```
Quest field               → UI element
─────────────────────────────────────────
title                     → quest title
difficultyLabel           → difficulty badge
xpReward                  → XP reward tag (e.g. "+250 XP")
estimatedMinutes          → time estimate label
labels                    → label pills
isGoodFirstIssue          → "Good First Issue" highlight
url                       → "Start Quest" button link
assignedTo                → "Claimed" indicator if assigned
```

---

## Step 9 — User Skill Level Integration

The user's skill level comes from onboarding questions stored in the user
profile. Read from wherever the frontend stores auth/profile state:

```typescript
// In the page/component that shows quests:
const { user } = useAuth(); // or useSession, useStore — check existing auth setup
const userLevel = user?.skillProfile?.level ?? 5; // default mid-level

const { data: quests } = useQuests(repoId, userLevel);
```

The `userLevel` (1–10) is passed to the API which scales all difficulty
scores and XP rewards relative to that level. A level-3 user sees the same
issue rated "Beginner" while a level-8 user sees it as "Easy" — this is
handled in the backend `quests.route.ts`.

---

## Step 10 — Verify Integration

Test each endpoint manually before wiring to UI:

```bash
# 1. Analyze a repo
curl -X POST http://localhost:3001/api/repo/analyze \
  -H "Content-Type: application/json" \
  -d '{"githubUrl":"https://github.com/expressjs/express"}'

# 2. Get quests for a repo
curl "http://localhost:3001/api/repo/expressjs%2Fexpress/quests?userLevel=5"

# 3. Index a repo
curl -X POST http://localhost:3001/api/index \
  -H "Content-Type: application/json" \
  -d '{"githubUrl":"https://github.com/expressjs/express"}'

# 4. Query the codebase
curl -X POST http://localhost:3001/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"repoId":"expressjs/express","query":"Where is routing handled?"}'
```

All 4 should return valid JSON before touching the frontend.

---

## Important Notes

- **Never call GitHub API from the frontend directly** — always go through the
  Express backend to keep the GitHub token server-side only.
- **The RAG query endpoint** (`POST /api/rag/query`) requires the repo to be
  indexed first. Check `RepoIndex` table or call `GET /api/index/status` to
  verify before enabling the query box.
- **Community health** is computed at analysis time, not stored — it's always
  fresh from GitHub.
- **Difficulty adaptation** is entirely backend-side. The frontend only sends
  `userLevel` and renders whatever score/label comes back.
- **XP values** range from 50 (trivial issues) to 500 (complex issues). These
  can be tuned in `quests.route.ts` by adjusting the formula.
