const { Octokit } = require("@octokit/rest");
require("dotenv").config({ path: "/Users/vanshdeo/dev/git-master/apps/api/.env" });

async function run() {
    const githubUrl = "https://github.com/VanshDeo/Cancer-Awareness";
    const MATCH = githubUrl.replace(/\.git$/, "").match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!MATCH) throw new Error("Invalid GitHub URL");
    const owner = MATCH[1];
    const repo = MATCH[2];

    const githubToken = process.env.GITHUB_TOKEN;
    const octokit = new Octokit({ auth: githubToken });

    console.log(`Fetching metadata for ${owner}/${repo}...`);
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch;
    const githubDesc = repoData.description || "No description";

    console.log(`Fetching tree for branch ${defaultBranch}...`);
    const { data: treeData } = await octokit.git.getTree({
        owner,
        repo,
        tree_sha: defaultBranch,
        recursive: "1",
    });

    const files = (treeData.tree || []).filter(item => item.type === "blob" && !!item.path).slice(0, 100);
    const filePaths = files.map(f => f.path).join("\n");

    const prompt = `You are a senior technical writer analyzing a GitHub repository.
Repository: ${owner}/${repo}
GitHub Description: ${githubDesc}
Total Text Files Found: ${files.length}

File Structure (Top 100 files):
${filePaths}

Analyze the structure and provided files to infer exactly what this project does, how to set it up, and how someone could contribute. 

Return ONLY a valid JSON object holding three distinct and detailed sections formatted in Markdown.
Respond strictly with valid JSON. Do not use Markdown wrapping for the final JSON block.
FORMAT:
{
  "customReadme": "A custom README explaining the project's purpose...",
  "setupGuide": "Step-by-step instructions...",
  "contributionGuide": "A short guide on how to contribute..."
}`;

    console.log("Calling Gemini flash-latest...");
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
        }),
    });

    console.log("Status:", res.status);
    if (!res.ok) {
        console.error(await res.text());
        return;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log("\n--- RAW TEXT RESPONSE LOG ---");
    console.log(text.slice(0, 500) + "...\n");

    try {
        const jsonStr = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(jsonStr);
        console.log("JSON PARSED SUCCESSFULLY!");
        console.log("Keys generated:", Object.keys(parsed));
    } catch (e) {
        console.error("Parse failed:", e.message);
    }
}

run().catch(console.error);
