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
