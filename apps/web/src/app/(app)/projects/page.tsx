"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    Search,
    Star,
    GitFork,
    Clock,
    Zap,
    Brain,
    ArrowRight,
    Shield,
    Users,
    AlertCircle,
    Activity,
} from "lucide-react";
import Link from "next/link";
import { analyzeRepository, type RepoAnalysis } from "@/lib/apiClient";

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

function formatNum(n: number) {
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
    return String(n);
}

function getHealthColor(label: string): string {
    switch (label) {
        case "Very Active": return "text-green-400";
        case "Active": return "text-green-400";
        case "Moderate": return "text-yellow-400";
        case "Low": return "text-orange-400";
        case "Inactive": return "text-red-400";
        default: return "text-slate-400";
    }
}

export default function ProjectsPage() {
    const [url, setUrl] = useState("");
    const [projects, setProjects] = useState<RepoAnalysis[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<string>("All");

    const handleSearch = async () => {
        if (!url) return;
        setLoading(true);
        setError(null);
        try {
            const data = await analyzeRepository(url);
            // Don't duplicate
            setProjects((prev) => {
                const exists = prev.some((p) => p.repoId === data.repoId);
                return exists ? prev : [data, ...prev];
            });
            setUrl("");
        } catch (err: any) {
            setError(err.message || "Failed to analyze repo");
        } finally {
            setLoading(false);
        }
    };

    const filtered = filter === "All"
        ? projects
        : projects.filter((p) => p.difficultyLabel === filter);

    return (
        <div className="relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-10"
                >
                    <Badge className="mb-3 bg-orange-500/10 text-orange-400 border-orange-500/20">
                        Project Discovery
                    </Badge>
                    <h1 className="text-4xl font-bold text-white mb-2">Find Your Next Project</h1>
                    <p className="text-slate-400">
                        Paste a GitHub URL to analyze any repo. We&apos;ll show you community health, difficulty, and available quests.
                    </p>
                </motion.div>

                {/* Search bar */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex gap-3 mb-6"
                >
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                            placeholder="https://github.com/owner/repo"
                            className="w-full bg-[#121212] border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500/40 transition-colors"
                        />
                    </div>
                    <Button
                        onClick={handleSearch}
                        disabled={loading || !url}
                        className="bg-orange-600 hover:bg-orange-500 text-white border-0 px-6"
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Analyzing…
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <Brain className="w-4 h-4" /> Add Repo
                            </span>
                        )}
                    </Button>
                </motion.div>

                {/* Filter bar */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="flex flex-wrap gap-2 mb-8"
                >
                    {["All", "Beginner", "Intermediate", "Advanced", "Expert"].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${filter === f
                                ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
                                : "border-white/10 text-slate-400 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            {f}
                        </button>
                    ))}
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
                {projects.length === 0 && !loading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center py-20"
                    >
                        <Brain className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-400 mb-2">No projects yet</h3>
                        <p className="text-sm text-slate-600">Paste a GitHub URL above to analyze your first repo.</p>
                    </motion.div>
                )}

                {/* Project Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <AnimatePresence>
                        {filtered.map((project, i) => (
                            <motion.div
                                key={project.repoId}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: i * 0.05, duration: 0.4 }}
                            >
                                <Card className="bg-[#121212] border-white/5 p-6 h-full hover:border-orange-500/20 hover:scale-[1.02] duration-300 transition-all group">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-slate-500 text-sm">{project.fullName.split("/")[0]}/</span>
                                                <span className="text-white font-semibold text-lg">{project.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge className={`text-xs border ${diffColorMap[getDiffColor(project.difficultyLabel)]}`}>
                                                    <Shield className="w-3 h-3 mr-1" />
                                                    {project.difficultyLabel}
                                                </Badge>
                                                {project.techStack.slice(0, 2).map((tech) => (
                                                    <Badge key={tech} className="text-xs border border-white/5 text-slate-400 bg-white/5">
                                                        {tech}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 text-yellow-400 text-sm font-medium">
                                            <Star className="w-4 h-4 fill-yellow-400" />
                                            {formatNum(project.stars)}
                                        </div>
                                    </div>

                                    <p className="text-slate-400 text-sm mb-3 leading-relaxed line-clamp-2">{project.purpose}</p>

                                    {/* Community Health badge */}
                                    <div className="flex items-start gap-2 bg-orange-500/5 border border-orange-500/10 rounded-lg p-3 mb-4 transition-colors group-hover:border-orange-500/20">
                                        <Activity className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                                        <div className="text-xs text-orange-300/80 leading-relaxed">
                                            Community: <span className={`font-semibold ${getHealthColor(project.communityHealth.label)}`}>{project.communityHealth.label}</span>
                                            {" · "}{project.communityHealth.commitFrequency} commits
                                            {" · "}{project.communityHealth.recentContributors} recent contributors
                                        </div>
                                    </div>

                                    {/* Stats row */}
                                    <div className="flex items-center gap-4 mb-4 text-xs text-slate-500">
                                        <div className="flex items-center gap-1">
                                            <GitFork className="w-3.5 h-3.5" /> {formatNum(project.forks)} forks
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Users className="w-3.5 h-3.5" /> {formatNum(project.contributorCount)}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5" />
                                            {project.communityHealth.lastCommitDays === 0 ? "Today" : `${project.communityHealth.lastCommitDays}d ago`}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Zap className="w-3.5 h-3.5 text-yellow-400" />
                                            <span className="text-yellow-400 font-medium">{project.openIssues} quests</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            className="flex-1 bg-orange-600 hover:bg-orange-500 text-white border-0 text-xs hover:scale-105 transition-transform"
                                            asChild
                                        >
                                            <Link href={`/quests?repo=${encodeURIComponent(project.fullName)}`}>
                                                View Quests <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                            </Link>
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-white/10 text-slate-400 hover:text-white hover:bg-white/5 text-xs"
                                            asChild
                                        >
                                            <Link href={`/analyze?url=${encodeURIComponent(`https://github.com/${project.fullName}`)}`}>Analyze</Link>
                                        </Button>
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
