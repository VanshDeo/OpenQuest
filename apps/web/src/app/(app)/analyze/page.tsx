"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ArchVisualization from "@/components/visualization/ArchVisualization";
import { sampleGraph } from "@/data/sampleGraph";
import { analyzeRepository, type RepoAnalysis, getArchitecture, indexRepository, getIndexStatus } from "@/lib/apiClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
import RAGPipelineView from "@/components/rag/RAGPipelineView";

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

function formatBytes(bytes: number): string {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
}

const LANG_COLORS: Record<string, string> = {
    TypeScript: "#3178C6", JavaScript: "#F7DF1E", Python: "#3572A5",
    Java: "#B07219", Go: "#00ADD8", Rust: "#DEA584",
    Ruby: "#701516", "C++": "#F34B7D", C: "#555555",
    "C#": "#178600", PHP: "#4F5D95", Swift: "#F05138",
    Kotlin: "#A97BFF", Dart: "#00B4AB", Shell: "#89E051",
    HTML: "#E34C26", CSS: "#563D7C", SCSS: "#C6538C",
    Vue: "#41B883", Svelte: "#FF3E00", Lua: "#000080",
    Haskell: "#5E5086", Elixir: "#6E4A7E", Scala: "#DC322F",
    R: "#198CE7", Makefile: "#427819", Dockerfile: "#384D54",
    Nix: "#7E7EFF",
};

function getLangColor(name: string): string {
    return LANG_COLORS[name] || `hsl(${name.length * 47 % 360}, 60%, 55%)`;
}

export default function AnalyzePage() {
    const [url, setUrl] = useState("");
    const [analysis, setAnalysis] = useState<RepoAnalysis | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [archGraph, setArchGraph] = useState<any>(null);
    const [archLoading, setArchLoading] = useState(false);

    const handleAnalyze = async () => {
        if (!url) return;
        setLoading(true);
        setError(null);
        setAnalysis(null);
        setArchGraph(null);
        setArchLoading(false);

        try {
            const data = await analyzeRepository(url);
            setAnalysis(data);

            // Fetch live architecture graph directly (uses GitHub API, no indexing needed)
            setArchLoading(true);
            getArchitecture(data.fullName)
                .then((graph) => setArchGraph(graph))
                .catch((err) => {
                    console.warn("Architecture graph failed:", err.message);
                    setArchGraph(null);
                })
                .finally(() => setArchLoading(false));
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
                                {/* Detailed Analysis (Custom README etc) */}
                                <Card className="bg-[#121212] border-white/5 p-6 md:col-span-2">
                                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                                        <Brain className="w-4 h-4 text-orange-400" /> Deep Repository Analysis
                                    </h3>
                                    <Tabs defaultValue="readme" className="w-full">
                                        <TabsList className="bg-white/5 border border-white/10 text-slate-400 mb-4 h-auto p-1">
                                            <TabsTrigger value="readme" className="data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-orange-400 rounded-md py-1.5 text-xs">Custom README</TabsTrigger>
                                            <TabsTrigger value="setup" className="data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-orange-400 rounded-md py-1.5 text-xs">Setup Guide</TabsTrigger>
                                            <TabsTrigger value="contribute" className="data-[state=active]:bg-[#1a1a1a] data-[state=active]:text-orange-400 rounded-md py-1.5 text-xs">Contribution Guide</TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="readme" className="mt-0 outline-none">
                                            <div className="prose prose-invert prose-sm max-w-none prose-a:text-orange-400 prose-headings:text-slate-200 prose-p:text-slate-400 prose-li:text-slate-400 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {analysis.purpose || "No custom README generated."}
                                                </ReactMarkdown>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="setup" className="mt-0 outline-none">
                                            <div className="prose prose-invert prose-sm max-w-none prose-a:text-orange-400 prose-headings:text-slate-200 prose-p:text-slate-400 prose-li:text-slate-400 prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {analysis.setupGuide || "No setup guide generated."}
                                                </ReactMarkdown>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="contribute" className="mt-0 outline-none">
                                            <div className="prose prose-invert prose-sm max-w-none prose-a:text-orange-400 prose-headings:text-slate-200 prose-p:text-slate-400 prose-li:text-slate-400 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {analysis.contributionGuide || "No contribution guide generated."}
                                                </ReactMarkdown>
                                            </div>
                                        </TabsContent>
                                    </Tabs>
                                </Card>

                                {/* Tech Stack */}
                                <Card className="bg-[#121212] border-white/5 p-6 hover:border-orange-500/20 hover:scale-[1.02] duration-300 transition-all">
                                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                                        <Code className="w-4 h-4 text-orange-400" /> Tech Stack
                                    </h3>
                                    {analysis.techStack.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mb-4">
                                            {analysis.techStack.map((tech) => (
                                                <Badge key={tech} className="text-xs border border-white/10 text-slate-300 bg-white/5">
                                                    {tech}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                    {analysis.languages && analysis.languages.length > 0 ? (
                                        <div>
                                            {/* Stacked color bar */}
                                            <div className="flex h-3 rounded-full overflow-hidden mb-4">
                                                {analysis.languages.map((lang, i) => (
                                                    <motion.div
                                                        key={lang.name}
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${lang.percentage}%` }}
                                                        transition={{ delay: 0.2 + i * 0.05, duration: 0.6 }}
                                                        className="h-full"
                                                        style={{ backgroundColor: getLangColor(lang.name) }}
                                                        title={`${lang.name}: ${lang.percentage}%`}
                                                    />
                                                ))}
                                            </div>
                                            {/* Individual language rows */}
                                            <div className="space-y-2.5">
                                                {analysis.languages.map((lang, i) => (
                                                    <motion.div
                                                        key={lang.name}
                                                        initial={{ opacity: 0, x: -10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: 0.1 + i * 0.03 }}
                                                        className="group/lang"
                                                    >
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getLangColor(lang.name) }} />
                                                                <span className="text-sm text-slate-300 font-medium">{lang.name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-xs text-slate-500">{formatBytes(lang.bytes)}</span>
                                                                <span className="text-sm text-white font-semibold w-12 text-right">{lang.percentage}%</span>
                                                            </div>
                                                        </div>
                                                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${lang.percentage}%` }}
                                                                transition={{ delay: 0.3 + i * 0.05, duration: 0.8 }}
                                                                className="h-full rounded-full group-hover/lang:brightness-125 transition-all"
                                                                style={{ backgroundColor: getLangColor(lang.name) }}
                                                            />
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-slate-500">No language data available</span>
                                    )}
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
                                            <p className="text-xs text-slate-500 leading-relaxed pr-2">
                                                {analysis.healthExplanation || `${analysis.communityHealth.recentContributors} contributors in last 30 days`}
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
                                        <Badge className={`border whitespace-nowrap ${diffColorMap[getDiffColor(analysis.difficultyLabel)]}`}>
                                            {analysis.difficultyLabel}
                                        </Badge>
                                        <span className="text-xs text-slate-500 leading-relaxed">
                                            {analysis.difficultyExplanation || "Based on codebase size, age, and contributor count"}
                                        </span>
                                    </div>
                                </Card>
                            </div>

                            {/* ── Architecture Graph Visualization ── */}
                            <div className="mt-8">
                                <div className="flex items-center gap-2 mb-4">
                                    <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20">
                                        <Zap className="w-3 h-3 mr-1" />
                                        Architecture Map
                                    </Badge>
                                </div>

                                {/* Architecture graph loading */}
                                {archLoading && (
                                    <div className="w-full h-[200px] flex items-center justify-center bg-[#0a0a0a] rounded-2xl border border-white/5">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                                            <span className="text-xs text-slate-500">Generating architecture graph…</span>
                                        </div>
                                    </div>
                                )}

                                {/* Architecture graph ready */}
                                {archGraph && !archLoading && (
                                    <ArchVisualization graph={archGraph} />
                                )}
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
