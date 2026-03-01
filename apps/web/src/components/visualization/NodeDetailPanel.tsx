"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { X, ArrowRight, FolderOpen, FolderClosed, FileText, ChevronRight } from "lucide-react";
import type { ArchNode, ArchGraph } from "@/types/ArchGraphTypes";
import { LAYER_COLORS, NODE_TYPE_ICONS } from "@/types/ArchGraphTypes";

const layerLabel: Record<string, string> = {
    ui: "UI Layer", api: "API Layer", service: "Service Layer", domain: "Domain Layer",
    data: "Data Layer", infra: "Infrastructure", config: "Configuration",
};

export default function NodeDetailPanel({
    graph,
    nodeId,
    expandedNodes,
    onToggleExpand,
    onClose,
}: {
    graph: ArchGraph;
    nodeId: string | null;
    expandedNodes: Set<string>;
    onToggleExpand: (id: string) => void;
    onClose: () => void;
}) {
    const node = nodeId ? graph.nodes.find((n) => n.id === nodeId) : null;
    const isExpanded = nodeId ? expandedNodes.has(nodeId) : false;
    const connectedEdges = nodeId
        ? graph.edges.filter((e) => e.source === nodeId || e.target === nodeId)
        : [];

    // Build breadcrumb path
    const breadcrumb: ArchNode[] = [];
    if (node) {
        let current: ArchNode | undefined = node;
        while (current) {
            breadcrumb.unshift(current);
            current = current.parentId
                ? graph.nodes.find((n) => n.id === current!.parentId)
                : undefined;
        }
    }

    // Get immediate children
    const children = node
        ? graph.nodes.filter((n) => n.parentId === nodeId)
        : [];

    return (
        <AnimatePresence>
            {node && (
                <motion.div
                    key="panel"
                    initial={{ x: 350, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 350, opacity: 0 }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="absolute top-0 right-0 w-[320px] h-full bg-[#0d0d0d]/95 backdrop-blur-2xl border-l border-white/5 overflow-y-auto z-20"
                >
                    {/* Header */}
                    <div className="p-5 border-b border-white/5">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">{NODE_TYPE_ICONS[node.type] ?? "📦"}</span>
                                <div>
                                    <h3 className="text-base font-bold text-white leading-tight">{node.label}</h3>
                                    <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                                        {node.type} · depth {node.depth}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed">{node.description}</p>
                    </div>

                    {/* Breadcrumb */}
                    {breadcrumb.length > 1 && (
                        <div className="px-5 py-3 border-b border-white/5">
                            <div className="flex items-center gap-1 text-[10px] flex-wrap">
                                {breadcrumb.map((bc, i) => (
                                    <span key={bc.id} className="flex items-center gap-1">
                                        {i > 0 && <ChevronRight className="w-2.5 h-2.5 text-slate-600" />}
                                        <span className={bc.id === nodeId ? "text-orange-400 font-semibold" : "text-slate-500"}>
                                            {bc.label}
                                        </span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Expand/Collapse action */}
                    {node.isExpandable && (
                        <div className="px-5 py-3 border-b border-white/5">
                            <button
                                onClick={() => onToggleExpand(node.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition text-sm"
                            >
                                {isExpanded ? (
                                    <>
                                        <FolderOpen className="w-4 h-4 text-orange-400" />
                                        <span className="text-slate-300">Collapse</span>
                                        <span className="ml-auto text-[10px] text-slate-500">{node.childCount} children</span>
                                    </>
                                ) : (
                                    <>
                                        <FolderClosed className="w-4 h-4 text-slate-400" />
                                        <span className="text-slate-300">Expand</span>
                                        <span className="ml-auto text-[10px] text-slate-500">{node.childCount} children</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Children list (when expanded) */}
                    {isExpanded && children.length > 0 && (
                        <div className="px-5 py-3 border-b border-white/5">
                            <h4 className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                Children
                            </h4>
                            <div className="space-y-1.5">
                                {children.map((child) => (
                                    <button
                                        key={child.id}
                                        onClick={() => onToggleExpand(child.id)}
                                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition text-left"
                                    >
                                        {child.isExpandable ? (
                                            expandedNodes.has(child.id) ? (
                                                <FolderOpen className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                                            ) : (
                                                <FolderClosed className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                            )
                                        ) : (
                                            <FileText className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                        )}
                                        <span className="text-xs text-slate-300 truncate">{child.label}</span>
                                        <span
                                            className="ml-auto w-2 h-2 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: LAYER_COLORS[child.layer] }}
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Layer & Type */}
                    <div className="px-5 py-4 border-b border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500 font-medium">Layer</span>
                            <Badge
                                style={{
                                    backgroundColor: `${LAYER_COLORS[node.layer]}15`,
                                    color: LAYER_COLORS[node.layer],
                                    borderColor: `${LAYER_COLORS[node.layer]}30`,
                                }}
                            >
                                {layerLabel[node.layer] ?? node.layer}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500 font-medium">Depth</span>
                            <span className="text-xs text-white font-semibold">Level {node.depth}</span>
                        </div>
                    </div>

                    {/* Metrics */}
                    <div className="px-5 py-4 border-b border-white/5 space-y-4">
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs text-slate-500 font-medium">Importance</span>
                                <span className="text-xs font-bold text-orange-400">
                                    {(node.importance * 100).toFixed(0)}%
                                </span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${node.importance * 100}%` }}
                                    transition={{ duration: 0.6 }}
                                    className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500"
                                />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs text-slate-500 font-medium">Complexity</span>
                                <span className="text-xs font-bold text-purple-400">
                                    {(node.complexity * 100).toFixed(0)}%
                                </span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${node.complexity * 100}%` }}
                                    transition={{ duration: 0.6, delay: 0.1 }}
                                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Connected Edges */}
                    {connectedEdges.length > 0 && (
                        <div className="px-5 py-4 border-b border-white/5">
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                                Connections ({connectedEdges.length})
                            </h4>
                            <div className="space-y-2">
                                {connectedEdges.slice(0, 8).map((edge, i) => {
                                    const isSource = edge.source === nodeId;
                                    const otherId = isSource ? edge.target : edge.source;
                                    const otherNode = graph.nodes.find((n) => n.id === otherId);
                                    return (
                                        <div key={i} className="flex items-center gap-2 text-xs bg-white/[0.03] rounded-lg px-3 py-2">
                                            <ArrowRight
                                                className={`w-3 h-3 flex-shrink-0 ${isSource ? "text-orange-400" : "text-blue-400 rotate-180"}`}
                                            />
                                            <span className="text-slate-300 truncate">{otherNode?.label ?? otherId}</span>
                                            <span className="ml-auto text-slate-600 text-[10px] flex-shrink-0">
                                                {edge.relationship}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Tags */}
                    {node.tags.length > 0 && (
                        <div className="px-5 py-4">
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Tags</h4>
                            <div className="flex flex-wrap gap-1.5">
                                {node.tags.map((tag) => (
                                    <Badge key={tag} className="bg-white/5 text-slate-400 border-white/10 text-[10px] px-2 py-0.5">
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
