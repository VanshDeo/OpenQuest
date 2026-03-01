/**
 * ragPipelineStream.route.ts
 *
 * POST /api/rag/pipeline
 * SSE endpoint that streams each RAG stage for pipeline transparency.
 */

import { Router, Request, Response } from "express";
import { embedQuery } from "../rag/embeddings/queryEmbedder";
import { vectorSearch, rerankByFileProximity, type RetrievedChunk } from "../rag/retrieval/retriever";
import { assembleContext } from "../rag/reranking/contextAssembler";

export function createRagPipelineRouter(): Router {
    const router = Router();

    router.post("/pipeline", async (req: Request, res: Response) => {
        const { repoId, query, topK } = req.body;

        if (!repoId || !query) {
            return res.status(400).json({ error: "repoId and query required" });
        }

        // SSE headers
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        });

        const emit = (event: string, data: any) => {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        try {
            const finalTopK = topK ?? 8;
            const candidateCount = finalTopK * 3;
            const minScore = 0.3;

            // ── Stage 1: Embedding
            emit("stage:embedding", { status: "active" });
            const embedStart = Date.now();
            const queryVector = await embedQuery(query.trim());
            emit("stage:embedding", {
                status: "done",
                durationMs: Date.now() - embedStart,
                dimensions: queryVector.length,
            });

            // ── Stage 2: Retrieval
            emit("stage:retrieval", { status: "active" });
            const retrieveStart = Date.now();
            const candidates = await vectorSearch(queryVector, repoId, candidateCount, minScore);
            emit("stage:retrieval", {
                status: "done",
                totalCandidates: candidates.length,
                durationMs: Date.now() - retrieveStart,
            });

            if (candidates.length === 0) {
                emit("stage:ranking", { status: "done", chunks: [] });
                emit("stage:context", { status: "done", tokenEstimate: 0 });
                emit("stage:generation", {
                    status: "done",
                    answer: "No relevant code was found. The repository may not be indexed yet.",
                });
                res.end();
                return;
            }

            // ── Stage 3: Ranking
            emit("stage:ranking", { status: "active" });
            const ranked = rerankByFileProximity(candidates, finalTopK);
            emit("stage:ranking", {
                status: "done",
                chunks: ranked.map((c: RetrievedChunk, i: number) => ({
                    id: c.id,
                    filePath: c.filePath,
                    startLine: c.startLine,
                    endLine: c.endLine,
                    symbolName: c.symbolName,
                    language: c.language,
                    content: c.content.slice(0, 300),
                    score: parseFloat(c.score.toFixed(4)),
                    vectorScore: parseFloat(c.vectorScore.toFixed(4)),
                    proximityBoost: parseFloat(c.proximityBoost.toFixed(4)),
                    injected: true,
                    rank: i + 1,
                })),
            });

            // ── Stage 4: Context Assembly
            emit("stage:context", { status: "active" });
            const { systemPrompt, userPrompt, citationMap, tokenEstimate } =
                assembleContext(query, ranked, repoId);
            emit("stage:context", {
                status: "done",
                tokenEstimate,
                systemPromptChars: systemPrompt.length,
                queryChars: query.length,
                contextChars: userPrompt.length - query.length,
                citationMap,
            });

            // ── Stage 5: Generation (streaming)
            emit("stage:generation", { status: "active" });

            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                emit("error", { error: "GEMINI_API_KEY not set" });
                res.end();
                return;
            }

            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${apiKey}`;

            const geminiRes = await fetch(geminiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: systemPrompt }] },
                    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
                    generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
                }),
            });

            if (!geminiRes.ok || !geminiRes.body) {
                const errText = await geminiRes.text();
                emit("error", { error: `Gemini error ${geminiRes.status}: ${errText.slice(0, 200)}` });
                res.end();
                return;
            }

            const reader = geminiRes.body.getReader();
            const decoder = new TextDecoder();
            let fullAnswer = "";
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    const jsonStr = line.slice(6).trim();
                    if (!jsonStr || jsonStr === "[DONE]") continue;
                    try {
                        const parsed = JSON.parse(jsonStr);
                        const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text) {
                            fullAnswer += text;
                            emit("token", { text });
                        }
                    } catch { /* skip malformed */ }
                }
            }

            emit("stage:generation", { status: "done", answer: fullAnswer });
            res.end();
        } catch (err: any) {
            emit("error", { error: err.message || "Pipeline failed" });
            res.end();
        }
    });

    return router;
}
