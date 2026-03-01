import { Router, Request, Response } from "express";
import { Octokit } from "@octokit/rest";
import { parseGitHubUrl } from "../rag/ingestion/githubFetcher";
import { config } from "../config/env";
import path from "path";

/* ── Ignored paths map for filtering tree ── */
const IGNORED = new Set([
    "node_modules", ".git", "dist", "build", ".next", "__pycache__",
    "vendor", ".vscode", ".idea", "coverage", ".cache", ".turbo",
    "target", "bin", "obj", ".husky",
]);

function shouldIgnore(filePath: string): boolean {
    return filePath.split("/").some(part => IGNORED.has(part));
}

/* ── Supported text extensions ── */
const TEXT_EXTS = new Set([
    ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java",
    ".rb", ".php", ".swift", ".kt", ".c", ".cpp", ".cs", ".vue",
    ".svelte", ".html", ".css", ".scss", ".sql", ".sh", ".md", ".json", ".toml", ".yaml", ".yml"
]);

function isTextFile(filePath: string): boolean {
    return TEXT_EXTS.has(path.extname(filePath).toLowerCase()) || filePath.toLowerCase().includes("doc") || filePath.toLowerCase().includes("file");
}

/* ── Deep analysis with Gemini ── */
async function generateDeepAnalysis(
    octokit: Octokit,
    owner: string,
    repo: string,
    defaultBranch: string,
    githubDescription: string
): Promise<{ customReadme: string; setupGuide: string; contributionGuide: string }> {
    try {
        // Fetch the file tree to understand the structure
        const { data: treeData } = await octokit.git.getTree({
            owner,
            repo,
            tree_sha: defaultBranch,
            recursive: "1",
        });

        const files = (treeData.tree || [])
            .filter((item): item is any => item.type === "blob" && !!item.path && !shouldIgnore(item.path) && isTextFile(item.path));

        const filePaths = files.map(f => f.path).slice(0, 100).join("\n");
        const fileCount = files.length;

        // Try to fetch key files content specifically
        let keyContents = "";
        const keyFilesToFetch = ["package.json", "pyproject.toml", "Cargo.toml", "go.mod", "docker-compose.yml", "Dockerfile"];
        for (const file of files) {
            const fileName = file.path.split("/").pop() || "";
            if (keyFilesToFetch.includes(fileName.toLowerCase())) {
                try {
                    const { data } = await octokit.repos.getContent({
                        owner,
                        repo,
                        path: file.path,
                        ref: defaultBranch,
                    });
                    if ("content" in data) {
                        const decodedVal = Buffer.from(data.content, "base64").toString("utf-8");
                        keyContents += `\n--- ${file.path} ---\n${decodedVal.slice(0, 800)}\n`;
                    }
                } catch { /* ignore */ }
            }
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY not found");

        const prompt = `You are a senior technical writer analyzing a GitHub repository.
Repository: ${owner}/${repo}
GitHub Description: ${githubDescription || "No description provided"}
Total Text Files Found: ${fileCount}

File Structure (Top 100 files):
${filePaths}

Key Configuration Files (if available):
${keyContents}

Analyze the structure and provided files to infer exactly what this project does, how to set it up, and how someone could contribute. 

Return ONLY a valid JSON object holding three distinct and detailed sections formatted in Markdown.
Respond strictly with valid JSON. Do not use Markdown wrapping for the final JSON block.
FORMAT:
{
  "customReadme": "A custom README explaining the project's purpose...",
  "setupGuide": "Step-by-step instructions...",
  "contributionGuide": "A short guide on how to contribute..."
}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
            }),
        });

        if (!res.ok) throw new Error(`Gemini API error: ${res.statusText}`);

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("No response from Gemini");

        const jsonStr = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(jsonStr);

        return {
            customReadme: parsed.customReadme || githubDescription,
            setupGuide: parsed.setupGuide || "Setup instructions could not be automatically determined.",
            contributionGuide: parsed.contributionGuide || "Please check the repository for contributing guidelines.",
        };
    } catch (e: any) {
        console.warn("[RepoAnalysis] Deep analysis failed, falling back to basic data:", e.message);
        return {
            customReadme: githubDescription || "No description provided.",
            setupGuide: "Setup instructions could not be automatically determined.",
            contributionGuide: "Please check the repository for contributing guidelines.",
        };
    }
}

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

            // Fetch deep analysis using Gemini
            const defaultBranch = r.default_branch || "main";
            const githubDesc = r.description ?? "No description provided.";
            const aiAnalysis = await generateDeepAnalysis(octokit, owner, repo, defaultBranch, githubDesc);

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
                purpose: aiAnalysis.customReadme,
                setupGuide: aiAnalysis.setupGuide,
                contributionGuide: aiAnalysis.contributionGuide,
                difficultyScore,
                difficultyLabel: getDifficultyLabel(difficultyScore),
                codebaseSize: (r.size || 0) * 1024,
                createdAt: r.created_at,
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
