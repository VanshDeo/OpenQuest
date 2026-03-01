"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
    Search,
    Zap,
    Clock,
    Users,
    Star,
    Shield,
    Code,
    Brain,
    Activity,
    BookOpen,
    ArrowRight,
    CheckCircle,
    ExternalLink,
    AlertCircle,
} from "lucide-react";
import { analyzeRepository, type RepoAnalysis } from "@/lib/apiClient";

const diffColorMap: Record<string, string> = {
    green: "bg-green-500/10 text-green-400 border-green-500/20",
    yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
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

function getHealthColor(score: number): string {
    if (score >= 80) return "#22C55E";
    if (score >= 60) return "#EAB308";
    if (score >= 40) return "#F97316";
    return "#EF4444";
}

function formatNumber(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
    return String(n);
}

export default function AnalyzePage() {
    const [url, setUrl] = useState("");
    const [analysis, setAnalysis] = useState<RepoAnalysis | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAnalyze = async () => {
        if (!url) return;
        setLoading(true);
        setError(null);
        setAnalysis(null);
        try {
            const data = await analyzeRepository(url);
            setAnalysis(data);
        } catch (err: any) {
            setError(err.message || "Analysis failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-10"
                >
                    <Badge className="mb-3 bg-orange-500/10 text-orange-400 border-orange-500/20">
                        AI Repo Analysis
                    </Badge>
                    <h1 className="text-4xl font-bold text-white mb-2">Analyze a Repository</h1>
                    <p className="text-slate-400">
                        Paste any GitHub URL and our AI will break down purpose, stack, difficulty, and contribution opportunities.
                    </p>
                </motion.div>

                {/* URL Input */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex gap-3 mb-10"
                >
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                            placeholder="https://github.com/owner/repo"
                            className="w-full bg-[#121212] border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500/40"
                        />
                    </div>
                    <Button
                        onClick={handleAnalyze}
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
                                <Brain className="w-4 h-4" /> Analyze
                            </span>
                        )}
                    </Button>
                </motion.div>

                {/* Error State */}
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8"
                    >
                        <Card className="bg-red-500/5 border-red-500/20 p-4 flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                            <p className="text-sm text-red-400">{error}</p>
                        </Card>
                    </motion.div>
                )}

                {/* Results */}
                <AnimatePresence>
                    {analysis && (
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="space-y-6"
                        >
                            {/* Repo header card */}
                            <Card className="bg-[#121212] border-white/5 p-6 hover:border-orange-500/20 hover:scale-[1.01] duration-300 transition-all">
                                <div className="flex items-start justify-between flex-wrap gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-slate-500">{analysis.fullName.split("/")[0]} /</span>
                                            <span className="text-2xl font-bold text-white">{analysis.name}</span>
                                            <a href={`https://github.com/${analysis.fullName}`} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink className="w-4 h-4 text-slate-500 hover:text-orange-400 transition-colors" />
                                            </a>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Badge className={`border ${diffColorMap[getDiffColor(analysis.difficultyLabel)]}`}>
                                                <Shield className="w-3 h-3 mr-1" />
                                                {analysis.difficultyLabel}
                                            </Badge>
                                            <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20">
                                                <Zap className="w-3 h-3 mr-1" />
                                                {analysis.difficultyScore}/100
                                            </Badge>
                                            <Badge className="bg-slate-800 text-slate-300 border-slate-700">
                                                <Clock className="w-3 h-3 mr-1" />
                                                Updated {analysis.communityHealth.commitFrequency.toLowerCase()}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-center">
                                        {[
                                            { icon: Star, label: "Stars", val: formatNumber(analysis.stars) },
                                            { icon: Activity, label: "Forks", val: formatNumber(analysis.forks) },
                                            { icon: BookOpen, label: "Issues", val: formatNumber(analysis.openIssues) },
                                            { icon: Users, label: "Contributors", val: formatNumber(analysis.contributorCount) },
                                        ].map(({ icon: Icon, label, val }) => (
                                            <div key={label} className="flex flex-col items-center">
                                                <Icon className="w-3.5 h-3.5 text-slate-500 mb-0.5" />
                                                <span className="text-white font-bold text-sm">{val}</span>
                                                <span className="text-slate-600 text-xs">{label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Card>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Purpose */}
                                <Card className="bg-[#121212] border-white/5 p-6 hover:border-orange-500/20 hover:scale-[1.02] duration-300 transition-all">
                                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                                        <Brain className="w-4 h-4 text-orange-400" /> Purpose
                                    </h3>
                                    <p className="text-slate-400 text-sm leading-relaxed">{analysis.purpose}</p>
                                </Card>

                                {/* Tech Stack */}
                                <Card className="bg-[#121212] border-white/5 p-6 hover:border-orange-500/20 hover:scale-[1.02] duration-300 transition-all">
                                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                                        <Code className="w-4 h-4 text-orange-400" /> Tech Stack
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {analysis.techStack.map((tech) => (
                                            <Badge key={tech} className="text-xs border border-white/10 text-slate-300 bg-white/5">
                                                {tech}
                                            </Badge>
                                        ))}
                                        {analysis.techStack.length === 0 && (
                                            <span className="text-xs text-slate-500">No stack detected</span>
                                        )}
                                    </div>
                                </Card>

                                {/* Community Health */}
                                <Card className="bg-[#121212] border-white/5 p-6 hover:border-orange-500/20 hover:scale-[1.02] duration-300 transition-all">
                                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                                        <Activity className="w-4 h-4 text-orange-400" /> Community Health
                                    </h3>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="relative w-14 h-14">
                                            <svg className="w-14 h-14 -rotate-90">
                                                <circle cx="28" cy="28" r="22" fill="none" stroke="#1E293B" strokeWidth="4" />
                                                <circle
                                                    cx="28"
                                                    cy="28"
                                                    r="22"
                                                    fill="none"
                                                    stroke={getHealthColor(analysis.communityHealth.score)}
                                                    strokeWidth="4"
                                                    strokeDasharray={`${(analysis.communityHealth.score / 100) * 138.2} 138.2`}
                                                />
                                            </svg>
                                            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold" style={{ color: getHealthColor(analysis.communityHealth.score) }}>
                                                {analysis.communityHealth.score}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-white font-semibold">{analysis.communityHealth.label}</p>
                                            <p className="text-xs text-slate-500">
                                                {analysis.communityHealth.recentContributors} contributors in last 30 days
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        {[
                                            { label: "Commit Frequency", val: analysis.communityHealth.commitFrequency },
                                            { label: "Contributing Guide", val: analysis.communityHealth.hasContributingGuide ? "Yes" : "No" },
                                            { label: "Code of Conduct", val: analysis.communityHealth.hasCodeOfConduct ? "Yes" : "No" },
                                            { label: "Last Commit", val: analysis.communityHealth.lastCommitDays === 0 ? "Today" : `${analysis.communityHealth.lastCommitDays} days ago` },
                                        ].map(({ label, val }) => (
                                            <div key={label} className="flex items-center gap-2">
                                                <CheckCircle className="w-3 h-3 text-orange-400 flex-shrink-0" />
                                                <span className="text-xs text-slate-400 flex-1">{label}</span>
                                                <span className="text-xs text-slate-300 font-medium">{val}</span>
                                            </div>
                                        ))}
                                    </div>
                                </Card>

                                {/* Difficulty Score */}
                                <Card className="bg-[#121212] border-white/5 p-6 hover:border-orange-500/20 hover:scale-[1.02] duration-300 transition-all">
                                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                                        <Shield className="w-4 h-4 text-orange-400" /> Contribution Difficulty
                                    </h3>
                                    <div className="flex items-center gap-4 mb-3">
                                        <Progress value={analysis.difficultyScore} className="flex-1 h-3" />
                                        <span className="text-2xl font-bold text-orange-400">{analysis.difficultyScore}/100</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge className={`border ${diffColorMap[getDiffColor(analysis.difficultyLabel)]}`}>
                                            {analysis.difficultyLabel}
                                        </Badge>
                                        <span className="text-xs text-slate-500">
                                            Based on codebase size, age, and contributor count
                                        </span>
                                    </div>
                                </Card>
                            </div>

                            <div className="flex justify-center mt-4">
                                <Button
                                    size="lg"
                                    className="bg-orange-600 hover:bg-orange-500 text-white border-0 shadow-lg shadow-orange-500/20 px-10 hover:scale-105 transition-transform"
                                    asChild
                                >
                                    <a href={`/quests?repo=${encodeURIComponent(analysis.fullName)}`}>
                                        Explore Quests for this Repo <ArrowRight className="w-5 h-5 ml-2" />
                                    </a>
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
