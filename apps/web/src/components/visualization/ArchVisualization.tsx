"use client";
import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Network, BarChart3, AlertTriangle, Layers, FolderTree, Maximize, Minimize } from "lucide-react";
import type { ArchGraph, ArchNode } from "@/types/ArchGraphTypes";
import { LAYER_COLORS } from "@/types/ArchGraphTypes";
import NodeDetailPanel from "./NodeDetailPanel";

const ArchGraph3D = dynamic(() => import("./ArchGraph3D"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center bg-[#0a0a0a]">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                <span className="text-xs text-slate-500">Loading 3D Engine…</span>
            </div>
        </div>
    ),
});

const layerLabelMap: Record<string, string> = {
    ui: "UI", api: "API", service: "Service", domain: "Domain",
    data: "Data", infra: "Infra", config: "Config",
};

export default function ArchVisualization({ graph }: { graph: ArchGraph }) {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
        // Initialize with defaultExpanded nodes
        const initial = new Set<string>();
        for (const node of graph.nodes) {
            if (node.defaultExpanded) initial.add(node.id);
        }
        return initial;
    });

    // Toggle expand/collapse
    const toggleExpand = useCallback((nodeId: string) => {
        const node = graph.nodes.find((n) => n.id === nodeId);
        if (!node) return;

        if (node.isExpandable) {
            setExpandedNodes((prev) => {
                const next = new Set(prev);
                if (next.has(nodeId)) {
                    // Collapse: also collapse all children recursively
                    const collapseRecursive = (id: string) => {
                        next.delete(id);
                        const n = graph.nodes.find((nd) => nd.id === id);
                        if (n) n.children.forEach(collapseRecursive);
                    };
                    collapseRecursive(nodeId);
                } else {
                    next.add(nodeId);
                }
                return next;
            });
        }
        // Also select the node
        setSelectedId(nodeId);
    }, [graph.nodes]);

    const handleHover = useCallback((id: string) => setHoveredId(id), []);
    const handleUnhover = useCallback(() => setHoveredId(null), []);
    const handleClosePanel = useCallback(() => setSelectedId(null), []);

    // Filter visible nodes: depth 0 always visible, deeper only if parent is expanded
    const visibleNodes = useMemo(() => {
        return graph.nodes.filter((node) => {
            if (node.depth === 0) return true;
            if (node.parentId && expandedNodes.has(node.parentId)) return true;
            return false;
        });
    }, [graph.nodes, expandedNodes]);

    // Compute current max visible depth
    const currentMaxDepth = useMemo(() => {
        return Math.max(0, ...visibleNodes.map((n) => n.depth));
    }, [visibleNodes]);

    // Filter visible edges
    const visibleEdges = useMemo(() => {
        const visibleIds = new Set(visibleNodes.map((n) => n.id));
        return graph.edges.filter((edge) => {
            if (edge.visibleAtDepth > currentMaxDepth) return false;
            return visibleIds.has(edge.source) && visibleIds.has(edge.target);
        });
    }, [graph.edges, visibleNodes, currentMaxDepth]);

    // Collect unique layers
    const layers = Array.from(new Set(visibleNodes.map((n) => n.layer)));

    // Count expanded
    const expandedCount = expandedNodes.size;

    return (
        <div className={isFullscreen
            ? "fixed inset-0 z-50 bg-[#0a0a0a] flex flex-col"
            : "relative rounded-2xl bg-[#0a0a0a] border border-white/5 overflow-hidden"}>
            {/* ── Top bar ── */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-3">
                    <Network className="w-4 h-4 text-orange-400" />
                    <span className="text-sm font-semibold text-white">Architecture Graph</span>
                    <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-[10px] px-2 py-0.5">
                        {graph.architecturePattern}
                    </Badge>
                    <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px] px-2 py-0.5">
                        {graph.systemType}
                    </Badge>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                        <FolderTree className="w-3 h-3" />
                        {visibleNodes.length}/{graph.metadata.totalNodes} visible
                    </span>
                    <span>{visibleEdges.length} edges</span>
                    <span className="text-orange-400 font-semibold">
                        {(graph.metadata.analysisConfidence * 100).toFixed(0)}% confidence
                    </span>
                    <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="p-1 hover:bg-white/10 rounded-md transition-colors text-slate-400 hover:text-white ml-2"
                        title={isFullscreen ? "Minimize" : "Expand Fullscreen"}
                    >
                        {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* ── Canvas + Panel ── */}
            <div className="relative flex-1" style={{ height: isFullscreen ? "100%" : "560px" }}>
                <ArchGraph3D
                    graph={graph}
                    visibleNodes={visibleNodes}
                    visibleEdges={visibleEdges}
                    expandedNodes={expandedNodes}
                    selectedId={selectedId}
                    hoveredId={hoveredId}
                    onSelectNode={toggleExpand}
                    onHoverNode={handleHover}
                    onUnhoverNode={handleUnhover}
                />

                {/* Node detail panel */}
                <NodeDetailPanel
                    graph={graph}
                    nodeId={selectedId}
                    expandedNodes={expandedNodes}
                    onToggleExpand={toggleExpand}
                    onClose={handleClosePanel}
                />

                {/* ── Layer Legend (bottom-left) ── */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="absolute bottom-4 left-4 bg-[#0d0d0d]/80 backdrop-blur-xl border border-white/5 rounded-xl px-4 py-3 z-10"
                >
                    <div className="text-[9px] uppercase tracking-wider font-bold text-slate-500 mb-2">
                        Layers
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                        {layers.map((layer) => (
                            <div key={layer} className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LAYER_COLORS[layer] }} />
                                <span className="text-[10px] text-slate-400 font-medium">
                                    {layerLabelMap[layer] ?? layer}
                                </span>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* ── Summary (top-left) ── */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="absolute top-4 left-4 max-w-md bg-[#0d0d0d]/80 backdrop-blur-xl border border-white/5 rounded-xl px-4 py-2.5 z-10"
                >
                    <p className="text-xs text-slate-300 leading-relaxed">{graph.summary}</p>
                </motion.div>

                {/* ── Complexity + Depth (top-right) ── */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="absolute top-4 right-4 bg-[#0d0d0d]/80 backdrop-blur-xl border border-white/5 rounded-xl px-4 py-2.5 z-10 flex items-center gap-4"
                >
                    <div className="flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5 text-orange-400" />
                        <span className="text-[10px] text-slate-500 font-medium">Complexity</span>
                        <span className="text-lg font-black text-white">{graph.complexityScore}</span>
                        <span className="text-[10px] text-slate-600">/10</span>
                    </div>
                    <div className="w-px h-6 bg-white/10" />
                    <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-[10px] text-slate-500 font-medium">Depth</span>
                        <span className="text-lg font-black text-white">{currentMaxDepth}</span>
                        <span className="text-[10px] text-slate-600">/{graph.progressiveStructure.maxDepth}</span>
                    </div>
                </motion.div>

                {/* ── Warnings (bottom-right) ── */}
                {graph.metadata.warnings && graph.metadata.warnings.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="absolute bottom-4 right-4 max-w-xs bg-[#0d0d0d]/80 backdrop-blur-xl border border-yellow-500/20 rounded-xl px-4 py-2.5 z-10"
                    >
                        <div className="flex items-center gap-1.5 mb-1">
                            <AlertTriangle className="w-3 h-3 text-yellow-400" />
                            <span className="text-[9px] uppercase tracking-wider font-bold text-yellow-400">Warnings</span>
                        </div>
                        {graph.metadata.warnings.map((w, i) => (
                            <p key={i} className="text-[10px] text-slate-400 leading-snug">{w}</p>
                        ))}
                    </motion.div>
                )}

                {/* Instruction hint */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5 }}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-slate-600 z-10"
                >
                    Click a cluster to expand · Click again to collapse · Drag to orbit
                </motion.div>
            </div>
        </div>
    );
}
