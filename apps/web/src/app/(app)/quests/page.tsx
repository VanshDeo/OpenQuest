"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    Zap,
    Clock,
    Shield,
    ArrowRight,
    Filter,
    BookOpen,
    Play,
    GitPullRequest,
    Search,
    Brain,
    AlertCircle,
    ExternalLink,
    Tag,
} from "lucide-react";
import { getRepoQuests, getUserLevel, type Quest } from "@/lib/apiClient";

const diffColorMap: Record<string, string> = {
    green: "bg-green-500/10 text-green-400 border-green-500/20",
    yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
};

function getDiffColor(label: string): string {
    switch (label) {
        case "Beginner": return "green";
        case "Intermediate": return "yellow";
        case "Advanced": return "orange";
        case "Expert": return "red";
        default: return "yellow";
    }
}

function formatTime(mins: number): string {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function QuestsContent() {
    const searchParams = useSearchParams();
    const repoParam = searchParams.get("repo") || "";

    const [repoUrl, setRepoUrl] = useState(repoParam);
    const [quests, setQuests] = useState<Quest[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
    const [startedQuests, setStartedQuests] = useState<number[]>([]);
    const [filter, setFilter] = useState("All Difficulties");

    // Load quests when repo param is provided
    useEffect(() => {
        if (repoParam) {
            fetchQuests(repoParam);
        }
    }, [repoParam]);

    const fetchQuests = async (repo: string) => {
        setLoading(true);
        setError(null);
        try {
            // Normalize: accept full URL or owner/repo
            let repoId = repo;
            if (repo.includes("github.com")) {
                const url = new URL(repo);
                repoId = url.pathname.replace(/^\//, "").replace(/\/$/, "");
            }
            const userLevel = getUserLevel();
            const data = await getRepoQuests(repoId, userLevel);
            setQuests(data);
        } catch (err: any) {
            setError(err.message || "Failed to fetch quests");
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        if (!repoUrl) return;
        fetchQuests(repoUrl);
    };

    const handleStart = (id: number) => {
        setStartedQuests((prev) => [...prev, id]);
    };

    const filtered = filter === "All Difficulties"
        ? quests
        : quests.filter((q) => q.difficultyLabel === filter);

    return (
        <div className="relative">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-10"
                >
                    <Badge className="mb-3 bg-orange-500/10 text-orange-400 border-orange-500/20">
                        <Zap className="w-3.5 h-3.5 mr-1.5" /> Quest Board
                    </Badge>
                    <h1 className="text-4xl font-bold text-white mb-2">Active Quests</h1>
                    <p className="text-slate-400">
                        Every GitHub issue is a quest. Pick one, complete it, and earn your XP.
                    </p>
                </motion.div>

                {/* Repo search */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="flex gap-3 mb-6"
                >
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            placeholder="owner/repo or https://github.com/owner/repo"
                            className="w-full bg-[#121212] border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500/40 transition-colors"
                        />
                    </div>
                    <Button
                        onClick={handleSearch}
                        disabled={loading || !repoUrl}
                        className="bg-orange-600 hover:bg-orange-500 text-white border-0 px-6"
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Loading…
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <Brain className="w-4 h-4" /> Fetch Quests
                            </span>
                        )}
                    </Button>
                </motion.div>

                {/* Filter bar */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex flex-wrap gap-3 mb-8"
                >
                    {["All Difficulties", "Beginner", "Intermediate", "Advanced", "Expert"].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${filter === f
                                ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                                : "border-white/10 text-slate-400 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                    <button
                        onClick={() => {
                            const sorted = [...quests].sort((a, b) => b.xpReward - a.xpReward);
                            setQuests(sorted);
                        }}
                        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                    >
                        <Filter className="w-3.5 h-3.5" /> Sort by XP
                    </button>
                </motion.div>

                {/* Error */}
                {error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6">
                        <Card className="bg-red-500/5 border-red-500/20 p-4 flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                            <p className="text-sm text-red-400">{error}</p>
                        </Card>
                    </motion.div>
                )}

                {/* Empty state */}
                {quests.length === 0 && !loading && !error && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-20"
                    >
                        <Zap className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-400 mb-2">No quests loaded</h3>
                        <p className="text-sm text-slate-600">
                            {repoParam ? "No open issues found for this repo." : "Enter a repository above to see its quests."}
                        </p>
                    </motion.div>
                )}

                {/* Quest List */}
                <div className="space-y-4">
                    <AnimatePresence>
                        {filtered.map((quest, i) => (
                            <motion.div
                                key={quest.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ delay: i * 0.03, duration: 0.3 }}
                            >
                                <Card className="bg-[#121212] border-white/5 p-5 hover:border-orange-500/20 hover:scale-[1.01] duration-300 transition-all group">
                                    <div className="flex items-start gap-4 flex-wrap">
                                        {/* XP badge */}
                                        <div className="flex flex-col items-center justify-center bg-yellow-400/10 border border-yellow-400/20 rounded-xl px-3 py-2 min-w-[64px]">
                                            <Zap className="w-4 h-4 text-yellow-400 mb-0.5" />
                                            <span className="text-lg font-black text-yellow-400 leading-none">
                                                {quest.xpReward}
                                            </span>
                                            <span className="text-xs text-yellow-400/60">XP</span>
                                        </div>

                                        {/* Main info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                                                <h3
                                                    className="text-white font-semibold group-hover:text-orange-400 transition-colors cursor-pointer"
                                                    onClick={() => setSelectedQuest(quest)}
                                                >
                                                    {quest.title}
                                                </h3>
                                                {quest.isGoodFirstIssue && (
                                                    <Badge className="text-xs bg-green-500/10 text-green-400 border-green-500/20 ml-auto">
                                                        🌱 Good First Issue
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                                    <GitPullRequest className="w-3 h-3" /> #{quest.id}
                                                </span>
                                                <Badge className={`text-xs border ${diffColorMap[getDiffColor(quest.difficultyLabel)]}`}>
                                                    <Shield className="w-3 h-3 mr-1" /> {quest.difficultyLabel}
                                                </Badge>
                                                <span className="flex items-center gap-1 text-xs text-slate-500">
                                                    <Clock className="w-3 h-3" /> ~{formatTime(quest.estimatedMinutes)}
                                                </span>
                                                {quest.assignedTo && (
                                                    <span className="text-xs text-slate-500">
                                                        Claimed by @{quest.assignedTo}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {quest.labels.map((label) => (
                                                    <Badge
                                                        key={label}
                                                        className="text-xs border border-white/5 text-slate-500 bg-transparent"
                                                    >
                                                        <Tag className="w-2.5 h-2.5 mr-0.5" /> {label}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="border-white/10 text-slate-400 hover:text-white hover:bg-white/5 text-xs"
                                                onClick={() => setSelectedQuest(quest)}
                                            >
                                                <BookOpen className="w-3.5 h-3.5 mr-1" /> Details
                                            </Button>
                                            {startedQuests.includes(quest.id) ? (
                                                <Button
                                                    size="sm"
                                                    className="bg-green-600/20 text-green-400 border border-green-500/20 text-xs cursor-default hover:bg-green-600/20 hover:text-green-400"
                                                    disabled
                                                >
                                                    ✓ Started
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    className="bg-orange-600 hover:bg-orange-500 text-white border-0 text-xs shadow-lg shadow-orange-500/20 hover:scale-105 transition-transform"
                                                    onClick={() => {
                                                        handleStart(quest.id);
                                                        window.open(quest.url, "_blank");
                                                    }}
                                                >
                                                    <Play className="w-3.5 h-3.5 mr-1" /> Start Quest
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            {/* Quest Detail Modal */}
            <Dialog open={!!selectedQuest} onOpenChange={(o) => !o && setSelectedQuest(null)}>
                <DialogContent className="bg-[#121212] border-white/10 max-w-2xl">
                    {selectedQuest && (
                        <>
                            <DialogHeader>
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <Badge className={`text-xs border ${diffColorMap[getDiffColor(selectedQuest.difficultyLabel)]}`}>
                                        <Shield className="w-3 h-3 mr-1" /> {selectedQuest.difficultyLabel}
                                    </Badge>
                                    <Badge className="bg-yellow-400/10 text-yellow-400 border-yellow-400/20 text-xs">
                                        <Zap className="w-3 h-3 mr-1" /> {selectedQuest.xpReward} XP
                                    </Badge>
                                    <Badge className="bg-slate-700 text-slate-400 border-white/5 text-xs">
                                        <Clock className="w-3 h-3 mr-1" /> ~{formatTime(selectedQuest.estimatedMinutes)}
                                    </Badge>
                                    {selectedQuest.isGoodFirstIssue && (
                                        <Badge className="text-xs bg-green-500/10 text-green-400 border-green-500/20">
                                            🌱 Good First Issue
                                        </Badge>
                                    )}
                                </div>
                                <DialogTitle className="text-white text-xl leading-tight">
                                    {selectedQuest.title}
                                </DialogTitle>
                                <p className="text-xs text-slate-500 flex items-center gap-1 pt-1">
                                    <GitPullRequest className="w-3 h-3" /> Issue #{selectedQuest.id}
                                </p>
                            </DialogHeader>

                            <div className="space-y-5 pt-2">
                                <div>
                                    <h4 className="text-sm font-semibold text-white mb-2">Description</h4>
                                    <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-wrap line-clamp-[10]">
                                        {selectedQuest.body || "No description provided."}
                                    </p>
                                </div>

                                <div>
                                    <h4 className="text-sm font-semibold text-white mb-2">Labels</h4>
                                    <div className="flex flex-wrap gap-1.5">
                                        {selectedQuest.labels.map((l) => (
                                            <Badge key={l} className="text-xs border border-white/5 text-slate-400 bg-white/5">
                                                {l}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    {!startedQuests.includes(selectedQuest.id) ? (
                                        <Button
                                            className="flex-1 bg-orange-600 hover:bg-orange-500 text-white border-0 shadow-lg shadow-orange-500/20 hover:scale-[1.02] transition-transform"
                                            onClick={() => {
                                                handleStart(selectedQuest.id);
                                                window.open(selectedQuest.url, "_blank");
                                            }}
                                        >
                                            <Play className="w-4 h-4 mr-2" /> Start This Quest
                                        </Button>
                                    ) : (
                                        <Button
                                            className="flex-1 bg-green-600/20 text-green-400 border border-green-500/20"
                                            disabled
                                        >
                                            ✓ Quest Started
                                        </Button>
                                    )}
                                    <Button
                                        variant="outline"
                                        className="border-white/10 text-slate-400 hover:text-white hover:bg-white/5"
                                        asChild
                                    >
                                        <a href={selectedQuest.url} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="w-4 h-4 mr-1" /> View on GitHub
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function QuestsPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            </div>
        }>
            <QuestsContent />
        </Suspense>
    );
}
