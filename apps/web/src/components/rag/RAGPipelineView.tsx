"use client";
import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, RotateCcw } from "lucide-react";
import PipelineStages, { type StageInfo } from "./PipelineStages";
import RetrievedChunks, { type ChunkInfo } from "./RetrievedChunks";
import ContextWindow, { type ContextUsage } from "./ContextWindow";
import StreamedAnswer, { type Citation } from "./StreamedAnswer";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const DEFAULT_STAGES: StageInfo[] = [
    { id: "embedding", label: "Embedding", status: "idle" },
    { id: "retrieval", label: "Retrieval", status: "idle" },
    { id: "ranking", label: "Ranking", status: "idle" },
    { id: "context", label: "Context", status: "idle" },
    { id: "generation", label: "Generation", status: "idle" },
];

interface Props {
    repoId: string;
    query: string;
    label: string;
    autoStart?: boolean;
}

export default function RAGPipelineView({ repoId, query, label }: Props) {
    const [stages, setStages] = useState<StageInfo[]>(DEFAULT_STAGES);
    const [chunks, setChunks] = useState<ChunkInfo[]>([]);
    const [contextUsage, setContextUsage] = useState<ContextUsage | null>(null);
    const [citations, setCitations] = useState<Record<string, Citation>>({});
    const [answer, setAnswer] = useState("");
    const [streaming, setStreaming] = useState(false);
    const [started, setStarted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const updateStage = useCallback((id: string, update: Partial<StageInfo>) => {
        setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...update } : s)));
    }, []);

    const handleEvent = useCallback((event: string, data: any) => {
        if (event.startsWith("stage:")) {
            const stageId = event.replace("stage:", "");
            updateStage(stageId, { status: data.status, durationMs: data.durationMs });
            if (stageId === "ranking" && data.status === "done" && data.chunks) setChunks(data.chunks);
            if (stageId === "context" && data.status === "done") {
                setContextUsage({
                    systemPromptChars: data.systemPromptChars ?? 0,
                    queryChars: data.queryChars ?? 0,
                    contextChars: data.contextChars ?? 0,
                    tokenEstimate: data.tokenEstimate ?? 0,
                });
                if (data.citationMap) setCitations(data.citationMap);
            }
            if (stageId === "generation" && data.status === "done" && data.answer) {
                setAnswer(data.answer);
                setStreaming(false);
            }
        } else if (event === "token") {
            setAnswer((prev) => prev + (data.text || ""));
        } else if (event === "error") {
            setError(data.error || "Unknown pipeline error");
            setStreaming(false);
        }
    }, [updateStage]);

    const runPipeline = useCallback(async () => {
        setStarted(true);
        setError(null);
        setStages(DEFAULT_STAGES.map((s) => ({ ...s, status: "idle" as const })));
        setChunks([]);
        setContextUsage(null);
        setCitations({});
        setAnswer("");
        setStreaming(true);
        try {
            const res = await fetch(`${API_BASE}/api/rag/pipeline`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ repoId, query, topK: 8 }),
            });
            if (!res.ok || !res.body) {
                setError(`Pipeline request failed: ${res.status}`);
                setStreaming(false);
                return;
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";
                let currentEvent = "";
                for (const line of lines) {
                    if (line.startsWith("event: ")) currentEvent = line.slice(7).trim();
                    else if (line.startsWith("data: ") && currentEvent) {
                        handleEvent(currentEvent, JSON.parse(line.slice(6)));
                        currentEvent = "";
                    }
                }
            }
            setStreaming(false);
        } catch (err: any) {
            setError(err.message || "Pipeline connection failed");
            setStreaming(false);
        }
    }, [repoId, query, handleEvent]);

    return (
        <Card className="bg-[#121212] border-white/5 p-6 hover:border-orange-500/20 transition-all duration-300">
            <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-semibold flex items-center gap-2">
                    <Brain className="w-4 h-4 text-orange-400" />
                    {label}
                    <span className="text-xs text-slate-600 font-normal">(RAG-powered)</span>
                </h3>
                {!started ? (
                    <Button size="sm" onClick={runPipeline} className="bg-orange-600 hover:bg-orange-500 text-white border-0 text-xs shadow-lg shadow-orange-500/20 hover:scale-105 transition-transform">
                        <Brain className="w-3.5 h-3.5 mr-1" /> Analyze with RAG
                    </Button>
                ) : (
                    <Button size="sm" variant="outline" onClick={runPipeline} disabled={streaming} className="border-white/10 text-slate-400 hover:text-white text-xs">
                        <RotateCcw className="w-3 h-3 mr-1" /> Re-run
                    </Button>
                )}
            </div>
            {started && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <PipelineStages stages={stages} />
                    {error && <div className="text-sm text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-3">{error}</div>}
                    {chunks.length > 0 && <RetrievedChunks chunks={chunks} />}
                    {contextUsage && <ContextWindow usage={contextUsage} />}
                    {(answer || streaming) && <StreamedAnswer text={answer} citations={citations} streaming={streaming} />}
                </motion.div>
            )}
            {!started && <p className="text-sm text-slate-600 text-center py-4">Click &quot;Analyze with RAG&quot; to see the transparent pipeline in action</p>}
        </Card>
    );
}
