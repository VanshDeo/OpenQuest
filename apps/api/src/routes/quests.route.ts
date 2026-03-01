import { Router, Request, Response } from "express";
import { Octokit } from "@octokit/rest";
import { config } from "../config/env";

export function createQuestsRouter(): Router {
    const router = Router();

    // GET /api/repo/:owner/:repo/quests?userLevel=5
    router.get("/:owner/:repo/quests", async (req: Request, res: Response) => {
        const owner = req.params.owner as string;
        const repo = req.params.repo as string;
        const userLevel = parseInt(req.query.userLevel as string) || 5; // 1-10

        if (!owner || !repo) return res.status(400).json({ error: "Invalid repoId" });

        try {
            const octokit = new Octokit({ auth: config.GITHUB_TOKEN });

            const { data: issues } = await octokit.issues.listForRepo({
                owner, repo,
                state: "open",
                per_page: 50,
                sort: "updated",
            });

            // Filter out pull requests (GitHub API returns both)
            const realIssues = issues.filter((i: any) => !i.pull_request);

            const quests = realIssues.map((issue: any) => {
                const labels = issue.labels.map((l: any) =>
                    typeof l === "string" ? l : l.name ?? ""
                );

                const isGoodFirstIssue = labels.some((l: string) =>
                    l.toLowerCase().includes("good first issue") ||
                    l.toLowerCase().includes("beginner") ||
                    l.toLowerCase().includes("easy")
                );

                // Base difficulty from labels
                let baseDifficulty = isGoodFirstIssue ? 20 : 50;
                if (labels.some((l: string) => l.toLowerCase().includes("hard") || l.toLowerCase().includes("complex"))) {
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
            const sorted = quests.sort((a: any, b: any) => {
                if (a.assignedTo && !b.assignedTo) return 1;
                if (!a.assignedTo && b.assignedTo) return -1;
                return Math.abs(a.difficultyScore - 50) - Math.abs(b.difficultyScore - 50);
            });

            return res.json(sorted);
        } catch (err: any) {
            console.error("[Quests] Error:", err.message);
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
