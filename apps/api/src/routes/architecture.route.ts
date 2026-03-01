/**
 * architecture.route.ts
 *
 * POST /api/repo/architecture
 * Generates a real ArchGraph for any GitHub repo by:
 *   1. Fetching the full file tree from GitHub API (via githubFetcher)
 *   2. Building a deterministic graph from real file paths + languages
 *   3. Using Gemini to generate a smart summary, architecture pattern,
 *      and edge analysis
 *
 * NO indexing / Redis / Worker required — works instantly.
 */

import { Router, Request, Response } from "express";
import { Octokit } from "@octokit/rest";
import path from "path";

/* ── Layer detection from file path ──────────────────────────────────── */
const layerRules: Array<{ test: RegExp; layer: string }> = [
    { test: /\.(tsx|jsx)$|components?\//i, layer: "ui" },
    { test: /routes?\//i, layer: "api" },
    { test: /controllers?\//i, layer: "api" },
    { test: /middleware/i, layer: "api" },
    { test: /services?\//i, layer: "service" },
    { test: /hooks?\//i, layer: "ui" },
    { test: /models?\//i, layer: "domain" },
    { test: /prisma|migrations?|database|db\//i, layer: "data" },
    { test: /config|\.env|env\./i, layer: "config" },
    { test: /infra|docker|ci|scripts|deploy/i, layer: "infra" },
    { test: /utils?|helpers?|lib\//i, layer: "service" },
    { test: /types?|interfaces?\//i, layer: "domain" },
    { test: /test|spec|__test/i, layer: "infra" },
    { test: /pages?\//i, layer: "ui" },
    { test: /app\//i, layer: "ui" },
    { test: /public\//i, layer: "ui" },
    { test: /styles?|css/i, layer: "ui" },
];

function detectLayer(filePath: string): string {
    for (const rule of layerRules) {
        if (rule.test.test(filePath)) return rule.layer;
    }
    return "service";
}

/* ── Type detection ──────────────────────────────────────────────────── */
function detectNodeType(filePath: string): string {
    const lc = filePath.toLowerCase();
    if (/index\.(ts|js|tsx|jsx)$/.test(lc)) return "entry";
    if (/routes?\//i.test(lc)) return "api";
    if (/controllers?\//i.test(lc)) return "controller";
    if (/components?\//i.test(lc)) return "component";
    if (/models?|schema/i.test(lc)) return "model";
    if (/config/i.test(lc)) return "config";
    if (/services?\//i.test(lc)) return "service";
    if (/\.(tsx|jsx)$/.test(lc)) return "component";
    if (/\.(ts|js)$/.test(lc)) return "module";
    return "module";
}

/* ── Language detection from extension ────────────────────────────────── */
const EXT_LANG: Record<string, string> = {
    ".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript",
    ".jsx": "JavaScript", ".py": "Python", ".go": "Go", ".rs": "Rust",
    ".java": "Java", ".rb": "Ruby", ".php": "PHP", ".swift": "Swift",
    ".kt": "Kotlin", ".c": "C", ".cpp": "C++", ".cs": "C#",
    ".html": "HTML", ".css": "CSS", ".scss": "SCSS", ".vue": "Vue",
    ".svelte": "Svelte", ".md": "Markdown", ".json": "JSON",
    ".yaml": "YAML", ".yml": "YAML", ".toml": "TOML",
    ".sql": "SQL", ".sh": "Shell", ".dockerfile": "Dockerfile",
};

function detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return EXT_LANG[ext] || ext.replace(".", "").toUpperCase() || "Other";
}

/* ── Ignored paths ───────────────────────────────────────────────────── */
const IGNORED = new Set([
    "node_modules", ".git", "dist", "build", ".next", "__pycache__",
    "vendor", ".vscode", ".idea", "coverage", ".cache", ".turbo",
    "target", "bin", "obj", ".husky",
]);

function shouldIgnore(filePath: string): boolean {
    return filePath.split("/").some(part => IGNORED.has(part));
}

/* ── Supported extensions (code files only) ──────────────────────────── */
const CODE_EXTS = new Set([
    ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java",
    ".rb", ".php", ".swift", ".kt", ".c", ".cpp", ".cs", ".vue",
    ".svelte", ".html", ".css", ".scss", ".sql", ".sh",
]);

function isCodeFile(filePath: string): boolean {
    return CODE_EXTS.has(path.extname(filePath).toLowerCase());
}

/* ─────────────────────────────────────────────────────────────────────── */

interface TreeItem {
    path: string;
    type: string;
    size?: number;
}

export function createArchitectureRouter(): Router {
    const router = Router();

    router.post("/architecture", async (req: Request, res: Response) => {
        const { repoId } = req.body; // e.g. "owner/repo" or GitHub URL

        if (!repoId) {
            return res.status(400).json({ error: "repoId required (owner/repo or GitHub URL)" });
        }

        try {
            // Parse owner/repo from whatever format is provided
            let owner: string, repo: string;
            if (repoId.includes("github.com")) {
                const match = repoId.replace(/\.git$/, "").match(/github\.com\/([^/]+)\/([^/]+)/);
                if (!match) return res.status(400).json({ error: "Invalid GitHub URL" });
                owner = match[1];
                repo = match[2];
            } else {
                [owner, repo] = repoId.split("/");
            }

            if (!owner || !repo) {
                return res.status(400).json({ error: "Invalid repoId format. Use owner/repo" });
            }

            const githubToken = process.env.GITHUB_TOKEN;
            const octokit = new Octokit({ auth: githubToken });

            // 1. Fetch repo metadata
            const { data: repoData } = await octokit.repos.get({ owner, repo });

            // 2. Fetch the full file tree
            const { data: treeData } = await octokit.git.getTree({
                owner,
                repo,
                tree_sha: repoData.default_branch,
                recursive: "1",
            });

            const allItems: TreeItem[] = (treeData.tree || [])
                .filter((item): item is TreeItem & { path: string } =>
                    item.type === "blob" && !!item.path && !shouldIgnore(item.path)
                );

            // Filter to code files only
            const codeFiles = allItems.filter(item => isCodeFile(item.path));

            if (codeFiles.length === 0) {
                return res.status(404).json({ error: "No code files found in repository" });
            }

            // 3. Build the architecture graph
            const graph = buildArchGraphFromTree(owner, repo, codeFiles, repoData);

            // 4. Enhance with Gemini if available
            const apiKey = process.env.GEMINI_API_KEY;
            if (apiKey) {
                try {
                    await enhanceWithGemini(apiKey, graph, codeFiles);
                } catch (err) {
                    console.warn("[Architecture] Gemini enhancement failed, using deterministic graph");
                }
            }

            return res.json(graph);
        } catch (err: any) {
            console.error("[Architecture] Error:", err.message);
            return res.status(500).json({ error: err.message });
        }
    });

    return router;
}

/* ── Build ArchGraph from real file tree ─────────────────────────────── */

function buildArchGraphFromTree(
    owner: string,
    repo: string,
    files: TreeItem[],
    repoData: any
): any {
    const repoId = `${owner}/${repo}`;

    // Group files by top-level directory
    const dirMap = new Map<string, TreeItem[]>();
    for (const file of files) {
        const parts = file.path.split("/");
        const topDir = parts.length > 1 ? parts[0] : "_root";
        if (!dirMap.has(topDir)) dirMap.set(topDir, []);
        dirMap.get(topDir)!.push(file);
    }

    const nodes: any[] = [];
    const edges: any[] = [];
    const rootNodes: string[] = [];
    const languagesUsed = new Set<string>();
    const layersUsed = new Set<string>();

    // ── Depth 0: Cluster nodes (top-level directories) ──
    for (const [dir, dirFiles] of dirMap.entries()) {
        const clusterId = `cluster_${dir.replace(/[^a-zA-Z0-9]/g, "_")}`;
        rootNodes.push(clusterId);

        // Group files within this dir by subdirectory (depth 1)
        const subDirMap = new Map<string, TreeItem[]>();
        for (const f of dirFiles) {
            const parts = f.path.split("/");
            const subDir = parts.length > 2 ? parts.slice(0, 2).join("/") : f.path;
            if (!subDirMap.has(subDir)) subDirMap.set(subDir, []);
            subDirMap.get(subDir)!.push(f);
        }

        const moduleIds: string[] = [];
        const clusterLayer = detectLayer(dirFiles[0].path);
        layersUsed.add(clusterLayer);

        // Count languages in this cluster
        const clusterLangs = new Set<string>();
        for (const f of dirFiles) {
            const lang = detectLanguage(f.path);
            clusterLangs.add(lang);
            languagesUsed.add(lang);
        }

        // ── Depth 1: Module/file nodes ──
        // If lots of files, group by subdirectory; otherwise show individual files
        if (subDirMap.size > 1 && dirFiles.length > 3) {
            for (const [subPath, subFiles] of subDirMap.entries()) {
                const moduleId = `mod_${subPath.replace(/[^a-zA-Z0-9]/g, "_")}`;
                moduleIds.push(moduleId);

                const fileIds: string[] = [];
                const modLayer = detectLayer(subPath);
                layersUsed.add(modLayer);

                // ── Depth 2: Individual files within module ──
                for (const f of subFiles.slice(0, 15)) { // cap at 15 files per module
                    const fileId = `file_${f.path.replace(/[^a-zA-Z0-9]/g, "_")}`;
                    fileIds.push(fileId);
                    const fileLayer = detectLayer(f.path);
                    const fileName = f.path.split("/").pop() || f.path;

                    nodes.push({
                        id: fileId,
                        label: fileName,
                        type: detectNodeType(f.path),
                        description: f.path,
                        parentId: moduleId,
                        children: [],
                        isExpandable: false,
                        defaultExpanded: false,
                        depth: 2,
                        childCount: 0,
                        visualHint: "leaf-node",
                        layer: fileLayer,
                        importance: fileName.includes("index") ? 0.9 : 0.5,
                        complexity: Math.min(1, (f.size || 1000) / 10000),
                        size: Math.max(2, Math.min(6, Math.ceil((f.size || 500) / 2000))),
                        tags: [detectLanguage(f.path)],
                    });
                }

                const moduleName = subPath.split("/").pop() || subPath;
                nodes.push({
                    id: moduleId,
                    label: moduleName,
                    type: detectNodeType(subPath),
                    description: `${subFiles.length} files in ${subPath}`,
                    parentId: clusterId,
                    children: fileIds,
                    isExpandable: fileIds.length > 0,
                    defaultExpanded: false,
                    depth: 1,
                    childCount: fileIds.length,
                    visualHint: fileIds.length > 0 ? "folder-collapsed" : "leaf-node",
                    layer: modLayer,
                    importance: Math.min(1, subFiles.length / 8),
                    complexity: Math.min(1, subFiles.length / 15),
                    size: Math.max(3, Math.min(8, subFiles.length + 2)),
                    tags: Array.from(new Set(subFiles.map(f => detectLanguage(f.path)))),
                });
            }
        } else {
            // Small directory — show files directly at depth 1
            for (const f of dirFiles.slice(0, 20)) {
                const fileId = `file_${f.path.replace(/[^a-zA-Z0-9]/g, "_")}`;
                moduleIds.push(fileId);
                const fileLayer = detectLayer(f.path);
                const fileName = f.path.split("/").pop() || f.path;

                nodes.push({
                    id: fileId,
                    label: fileName,
                    type: detectNodeType(f.path),
                    description: f.path,
                    parentId: clusterId,
                    children: [],
                    isExpandable: false,
                    defaultExpanded: false,
                    depth: 1,
                    childCount: 0,
                    visualHint: "leaf-node",
                    layer: fileLayer,
                    importance: fileName.includes("index") ? 0.9 : 0.5,
                    complexity: Math.min(1, (f.size || 1000) / 10000),
                    size: Math.max(2, Math.min(7, Math.ceil((f.size || 500) / 2000))),
                    tags: [detectLanguage(f.path)],
                });
            }
        }

        // Create cluster node
        nodes.push({
            id: clusterId,
            label: dir === "_root" ? "Root" : dir,
            type: "cluster",
            description: `${dirFiles.length} code files`,
            parentId: null,
            children: moduleIds,
            isExpandable: true,
            defaultExpanded: false,
            depth: 0,
            childCount: moduleIds.length,
            visualHint: "folder-collapsed",
            layer: clusterLayer,
            importance: Math.min(1, dirFiles.length / 20),
            complexity: Math.min(1, dirFiles.length / 40),
            size: Math.max(5, Math.min(10, Math.ceil(dirFiles.length / 3) + 3)),
            tags: Array.from(clusterLangs),
        });
    }

    // ── Build edges ──

    // Depth 0: Connect clusters based on architectural layer relationships
    const clusterList = nodes.filter(n => n.depth === 0);
    const layerOrder = ["ui", "api", "service", "domain", "data", "infra", "config"];

    for (let i = 0; i < clusterList.length; i++) {
        for (let j = i + 1; j < clusterList.length; j++) {
            const a = clusterList[i];
            const b = clusterList[j];
            const aIdx = layerOrder.indexOf(a.layer);
            const bIdx = layerOrder.indexOf(b.layer);

            // Connect if they're in adjacent or related layers
            if (Math.abs(aIdx - bIdx) <= 2 || aIdx === -1 || bIdx === -1) {
                const relationship = aIdx < bIdx ? "calls" : "depends_on";
                const strength = Math.max(0.3, 1 - Math.abs(aIdx - bIdx) * 0.2);

                edges.push({
                    source: aIdx <= bIdx ? a.id : b.id,
                    target: aIdx <= bIdx ? b.id : a.id,
                    relationship,
                    strength: parseFloat(strength.toFixed(2)),
                    direction: "forward",
                    visibleAtDepth: 0,
                });
            }
        }
    }

    // Depth 1: Connect modules within same cluster
    for (const cluster of clusterList) {
        const children = cluster.children;
        for (let i = 0; i < Math.min(children.length, 6); i++) {
            for (let j = i + 1; j < Math.min(children.length, i + 3); j++) {
                edges.push({
                    source: children[i],
                    target: children[j],
                    relationship: "imports",
                    strength: 0.6,
                    direction: "forward",
                    visibleAtDepth: 1,
                });
            }
        }
    }

    // Determine architecture pattern
    const hasUI = layersUsed.has("ui");
    const hasAPI = layersUsed.has("api");
    const hasService = layersUsed.has("service");
    const hasData = layersUsed.has("data");
    let pattern = "monolithic";
    if (hasUI && hasAPI && hasService) pattern = "layered";
    else if (hasAPI && hasService && !hasUI) pattern = "api-first";
    else if (hasUI && !hasAPI) pattern = "frontend-only";

    const systemType = hasUI && hasAPI ? "full-stack"
        : hasUI ? "web-app"
            : hasAPI ? "api-server"
                : "library";

    const complexity = Math.min(10, Math.max(1,
        Math.round((files.length / 30) + (dirMap.size / 3) + (layersUsed.size / 2))
    ));

    return {
        repository: repoId,
        summary: `${repoData.description || repoId} — ${files.length} code files across ${languagesUsed.size} languages`,
        architecturePattern: pattern,
        systemType,
        complexityScore: complexity,
        progressiveStructure: {
            maxDepth: 2,
            rootNodes,
            defaultViewDepth: 0,
            expansionStrategy: "click-to-expand",
            recommendedStartNodes: rootNodes.slice(0, 2),
        },
        nodes,
        edges,
        visualization: {
            initialView: "clusters-only",
            cameraFocus: rootNodes[0] || "",
            layoutStyle: "hierarchical-tree",
            expansionAnimation: "zoom-and-unfold",
            collapseAnimation: "fold-and-zoom-out",
            expansionDuration: 400,
            layoutEngine: "force-directed-hierarchical",
        },
        tags: Array.from(languagesUsed),
        metadata: {
            totalNodes: nodes.length,
            visibleNodesAtStart: rootNodes.length,
            maxDepthAvailable: 2,
            analysisConfidence: 0.85,
            warnings: files.length < 5
                ? ["Very small codebase — limited structural detail"]
                : files.length > 500
                    ? ["Large repo — showing top-level structure only"]
                    : [],
        },
    };
}

/* ── Gemini enhancement (optional, but makes it much smarter) ────────── */

async function enhanceWithGemini(
    apiKey: string,
    graph: any,
    files: TreeItem[]
): Promise<void> {
    const filePaths = files.map(f => f.path).slice(0, 80).join("\n");
    const clustersSummary = graph.nodes
        .filter((n: any) => n.depth === 0)
        .map((n: any) => `${n.label} (${n.layer}, ${n.childCount} modules)`)
        .join(", ");

    const prompt = `Analyze this repository structure and provide a concise architecture summary.

Repository: ${graph.repository}
Clusters: ${clustersSummary}
Sample files (${files.length} total):
${filePaths}

Return ONLY a valid JSON object:
{
  "summary": "one clear sentence about what this project does and its architecture",
  "architecturePattern": "layered|microservice|monolithic|api-first|event-driven|frontend-only",
  "systemType": "web-app|api-server|library|cli-tool|full-stack",
  "complexityScore": <1-10>,
  "warnings": ["any architectural concerns"]
}

JSON only. No markdown. No explanation.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 300 },
        }),
    });

    if (!res.ok) return;

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return;

    try {
        const jsonStr = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
        const enhancement = JSON.parse(jsonStr);

        graph.summary = enhancement.summary || graph.summary;
        graph.architecturePattern = enhancement.architecturePattern || graph.architecturePattern;
        graph.systemType = enhancement.systemType || graph.systemType;
        graph.complexityScore = enhancement.complexityScore || graph.complexityScore;
        graph.metadata.analysisConfidence = 0.92;
        if (enhancement.warnings?.length) {
            graph.metadata.warnings = enhancement.warnings;
        }
    } catch { /* keep deterministic values */ }
}
