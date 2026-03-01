"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FileCode, ArrowRight } from "lucide-react";

export interface ChunkInfo {
    id: string;
    filePath: string;
    startLine: number;
    endLine: number;
    symbolName?: string | null;
    language: string;
    content: string;
    score: number;
    vectorScore: number;
    proximityBoost: number;
    injected: boolean;
    rank: number;
}

function scoreColor(s: number): string {
    if (s >= 0.8) return "#22C55E";
    if (s >= 0.6) return "#EAB308";
    if (s >= 0.4) return "#F97316";
    return "#EF4444";
}

export default function RetrievedChunks({ chunks }: { chunks: ChunkInfo[] }) {
    if (chunks.length === 0) return null;
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-semibold text-white">Retrieved Chunks</h4>
                <Badge className="text-[10px] bg-white/5 text-slate-500 border-white/10">{chunks.length} chunks</Badge>
            </div>
            <AnimatePresence>
                {chunks.map((chunk, i) => (
                    <motion.div key={chunk.id} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, duration: 0.3 }}>
                        <Card className="bg-[#0A0A0A] border-white/5 p-4 hover:border-orange-500/15 transition-all duration-300">
                            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                                <div className="flex items-center gap-2 min-w-0">
                                    <FileCode className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                    <span className="text-xs text-slate-300 font-mono truncate">{chunk.filePath}</span>
                                    <span className="text-[10px] text-slate-600">L{chunk.startLine}–{chunk.endLine}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Badge className="text-[10px] bg-orange-500/10 text-orange-400 border-orange-500/20">#{chunk.rank}</Badge>
                                    {chunk.injected && <Badge className="text-[10px] bg-green-500/10 text-green-400 border-green-500/20">Injected</Badge>}
                                </div>
                            </div>
                            {chunk.symbolName && (
                                <div className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                                    <ArrowRight className="w-3 h-3 text-slate-600" />
                                    <code className="text-orange-400/80">{chunk.symbolName}</code>
                                </div>
                            )}
                            <div className="mb-2">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] text-slate-600">Similarity Score</span>
                                    <span className="text-xs font-bold" style={{ color: scoreColor(chunk.score) }}>{(chunk.score * 100).toFixed(1)}%</span>
                                </div>
                                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(chunk.score * 100, 100)}%` }} transition={{ delay: 0.2 + i * 0.05, duration: 0.6 }} className="h-full rounded-full" style={{ backgroundColor: scoreColor(chunk.score) }} />
                                </div>
                            </div>
                            <pre className="text-[11px] text-slate-500 bg-black/30 rounded-lg p-2.5 overflow-x-auto max-h-24 font-mono leading-tight">{chunk.content}</pre>
                        </Card>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
