"use client";
import { motion } from "framer-motion";
import { CheckCircle, Loader2 } from "lucide-react";

export type StageStatus = "idle" | "active" | "done";

export interface StageInfo {
    id: string;
    label: string;
    status: StageStatus;
    durationMs?: number;
}

const STAGE_ICONS: Record<string, string> = {
    embedding: "🧬",
    retrieval: "🔍",
    ranking: "📊",
    context: "📦",
    generation: "✍️",
};

export default function PipelineStages({ stages }: { stages: StageInfo[] }) {
    return (
        <div className="relative">
            <div className="absolute top-5 left-5 right-5 h-px bg-white/5 hidden sm:block" />
            <div className="flex flex-wrap sm:flex-nowrap justify-between gap-2">
                {stages.map((stage, i) => (
                    <motion.div
                        key={stage.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex flex-col items-center gap-1.5 flex-1 min-w-[64px] z-10"
                    >
                        <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm transition-all duration-500 ${stage.status === "done"
                                    ? "bg-green-500/10 border-2 border-green-500/30 shadow-[0_0_12px_rgba(34,197,94,0.15)]"
                                    : stage.status === "active"
                                        ? "bg-orange-500/10 border-2 border-orange-500/30 shadow-[0_0_12px_rgba(249,115,22,0.2)]"
                                        : "bg-white/5 border-2 border-white/10"
                                }`}
                        >
                            {stage.status === "done" ? (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}>
                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                </motion.div>
                            ) : stage.status === "active" ? (
                                <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
                            ) : (
                                <span className="text-xs">{STAGE_ICONS[stage.id] || "⏳"}</span>
                            )}
                        </div>
                        <span className={`text-xs font-medium text-center transition-colors ${stage.status === "done" ? "text-green-400" : stage.status === "active" ? "text-orange-400" : "text-slate-600"}`}>
                            {stage.label}
                        </span>
                        {stage.status === "done" && stage.durationMs !== undefined && (
                            <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded-full">
                                {stage.durationMs}ms
                            </motion.span>
                        )}
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
