import { Router, Request, Response } from "express";
import { Octokit } from "@octokit/rest";
import { parseGitHubUrl } from "../rag/ingestion/githubFetcher";
import { config } from "../config/env";

export function createRepoAnalysisRouter(): Router {
    const router = Router();

    // POST /api/repo/analyze
    router.post("/analyze", async (req: Request, res: Response) => {
        const { githubUrl } = req.body;
        if (!githubUrl) return res.status(400).json({ error: "githubUrl required" });

        try {
            const { owner, repo } = parseGitHubUrl(githubUrl);
            const octokit = new Octokit({ auth: config.GITHUB_TOKEN });

            // Fetch in parallel
            const [repoData, contributors, commits, communityProfile, languages] = await Promise.allSettled([
                octokit.repos.get({ owner, repo }),
                octokit.repos.listContributors({ owner, repo, per_page: 100 }),
                octokit.repos.listCommits({ owner, repo, per_page: 30 }),
                octokit.repos.getCommunityProfileMetrics({ owner, repo }),
                octokit.repos.listLanguages({ owner, repo }),
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
                        .filter((c: any) => {
                            const d = new Date(c.commit.author?.date ?? "");
                            return (Date.now() - d.getTime()) < 30 * 24 * 60 * 60 * 1000;
                        })
                        .map((c: any) => c.author?.login)
                        .filter(Boolean)
                ).size
                : 0;

            const communityHealth = buildCommunityHealth(
                lastCommitDays,
                recentContribs,
                communityProfile
            );

            const techStack = detectTechStack(r.language, (r as any).topics ?? []);
            const difficultyScore = computeDifficultyScore(r, contribCount);

            // Build language breakdown with percentages
            const langData = languages.status === "fulfilled" ? languages.value.data as Record<string, number> : {};
            const totalBytes = Object.values(langData).reduce((a, b) => a + b, 0);
            const languageBreakdown = Object.entries(langData)
                .map(([name, bytes]) => ({
                    name,
                    bytes,
                    percentage: totalBytes > 0 ? Math.round((bytes / totalBytes) * 1000) / 10 : 0,
                }))
                .sort((a, b) => b.bytes - a.bytes);

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
                languages: languageBreakdown,
                purpose: r.description ?? "No description provided.",
                difficultyScore,
                difficultyLabel: getDifficultyLabel(difficultyScore),
                communityHealth,
                defaultBranch: r.default_branch,
            });
        } catch (err: any) {
            console.error("[RepoAnalysis] Error:", err.message);
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
        avgIssueResponseDays: 0,
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
    if (repo.size > 100000) score += 20;
    else if (repo.size > 10000) score += 10;
    if (contributorCount > 100) score += 15;
    else if (contributorCount > 20) score += 8;
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
