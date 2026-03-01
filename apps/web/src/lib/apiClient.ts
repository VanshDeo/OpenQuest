const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Repo Analysis ─────────────────────────────────────────────────────────────

export interface RepoAnalysis {
    repoId: string;
    name: string;
    fullName: string;
    description: string;
    stars: number;
    forks: number;
    openIssues: number;
    contributorCount: number;
    techStack: string[];
    languages: { name: string; bytes: number; percentage: number }[];
    purpose: string;
    difficultyScore: number;
    difficultyLabel: "Beginner" | "Intermediate" | "Advanced" | "Expert";
    communityHealth: {
        score: number;
        label: string;
        lastCommitDays: number;
        commitFrequency: string;
        hasContributingGuide: boolean;
        hasCodeOfConduct: boolean;
        avgIssueResponseDays: number;
        recentContributors: number;
    };
    defaultBranch: string;
}

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

export interface Quest {
    id: number;
    title: string;
    body: string;
    url: string;
    labels: string[];
    difficultyScore: number;
    difficultyLabel: "Beginner" | "Intermediate" | "Advanced" | "Expert";
    xpReward: number;
    estimatedMinutes: number;
    isGoodFirstIssue: boolean;
    assignedTo: string | null;
}

export async function getRepoQuests(
    repoId: string,
    userLevel: number
): Promise<Quest[]> {
    const res = await fetch(
        `${API_BASE}/api/repo/${repoId}/quests?userLevel=${userLevel}`
    );
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

// ── User Level from localStorage ──────────────────────────────────────────────

const LEVEL_MAP: Record<string, number> = {
    beginner: 3,
    intermediate: 5,
    advanced: 7,
    expert: 9,
};

export function getUserLevel(): number {
    if (typeof window === "undefined") return 5;
    const stored = localStorage.getItem("openquest_user_level");
    if (stored) return parseInt(stored) || 5;
    return 5;
}

export function setUserLevel(experience: string): void {
    const level = LEVEL_MAP[experience] ?? 5;
    localStorage.setItem("openquest_user_level", String(level));
}

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

// ── RAG Query ─────────────────────────────────────────────────────────────────

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

// ── Architecture Graph ────────────────────────────────────────────────────

export async function getArchitecture(repoId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/api/repo/architecture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}
