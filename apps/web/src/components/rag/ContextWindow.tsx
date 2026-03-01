"use client";
import { motion } from "framer-motion";

export interface ContextUsage {
    systemPromptChars: number;
    queryChars: number;
    contextChars: number;
    tokenEstimate: number;
}

export default function ContextWindow({ usage }: { usage: ContextUsage | null }) {
    if (!usage) return null;
    const total = usage.systemPromptChars + usage.queryChars + usage.contextChars;
    if (total === 0) return null;
    const segments = [
        { label: "System Prompt", chars: usage.systemPromptChars, color: "#64748B" },
        { label: "Query", chars: usage.queryChars, color: "#3B82F6" },
        { label: "Retrieved Context", chars: usage.contextChars, color: "#F97316" },
    ];
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-white">Context Window</h4>
                <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">~{usage.tokenEstimate.toLocaleString()} tokens</span>
            </div>
            <div className="flex h-4 rounded-full overflow-hidden mb-3">
                {segments.map((seg, i) => (
                    <motion.div key={seg.label} initial={{ width: 0 }} animate={{ width: `${(seg.chars / total) * 100}%` }} transition={{ delay: 0.1 + i * 0.1, duration: 0.5 }} className="h-full" style={{ backgroundColor: seg.color }} title={`${seg.label}: ${seg.chars.toLocaleString()} chars`} />
                ))}
            </div>
            <div className="flex flex-wrap gap-4">
                {segments.map((seg) => (
                    <div key={seg.label} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
                        <span className="text-[10px] text-slate-500">{seg.label} ({Math.round((seg.chars / total) * 100)}%)</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
