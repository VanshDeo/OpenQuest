"use client";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { FileCode } from "lucide-react";

export interface Citation {
    filePath: string;
    startLine: number;
    endLine: number;
    symbolName?: string | null;
}

interface Props {
    text: string;
    citations: Record<string, Citation>;
    streaming: boolean;
}

export default function StreamedAnswer({ text, citations, streaming }: Props) {
    if (!text && !streaming) return null;
    const parts = text.split(/(\[\d+\])/g);
    return (
        <div>
            <h4 className="text-sm font-semibold text-white mb-3">AI Analysis</h4>
            <div className="bg-[#0A0A0A] rounded-xl border border-white/5 p-5">
                <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {parts.map((part, i) => {
                        const match = part.match(/^\[(\d+)\]$/);
                        if (match) {
                            const citation = citations[part];
                            return (
                                <span key={i} className="relative inline-block group/cite">
                                    <Badge className="text-[10px] bg-orange-500/10 text-orange-400 border-orange-500/20 cursor-default mx-0.5 hover:bg-orange-500/20 transition-colors">{part}</Badge>
                                    {citation && (
                                        <div className="absolute bottom-full left-0 mb-1 hidden group-hover/cite:block z-20">
                                            <div className="bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 shadow-xl min-w-[200px]">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <FileCode className="w-3 h-3 text-slate-500" />
                                                    <span className="text-[10px] text-slate-300 font-mono">{citation.filePath}</span>
                                                </div>
                                                <span className="text-[10px] text-slate-500">Lines {citation.startLine}–{citation.endLine}</span>
                                            </div>
                                        </div>
                                    )}
                                </span>
                            );
                        }
                        return <span key={i}>{part}</span>;
                    })}
                    {streaming && (
                        <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} className="inline-block w-2 h-4 bg-orange-400 ml-0.5 rounded-sm align-text-bottom" />
                    )}
                </div>
            </div>
            {Object.keys(citations).length > 0 && !streaming && (
                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-3 flex flex-wrap gap-1.5">
                    <span className="text-[10px] text-slate-600 mr-1 self-center">Sources:</span>
                    {Object.entries(citations).map(([key, c]) => (
                        <Badge key={key} className="text-[10px] border border-white/5 text-slate-500 bg-white/5 font-mono">
                            {key} {c.filePath.split("/").pop()}:{c.startLine}
                        </Badge>
                    ))}
                </motion.div>
            )}
        </div>
    );
}
