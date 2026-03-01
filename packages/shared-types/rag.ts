export interface RepoChunk {
    id: string;
    repoId: string;
    filePath: string;
    chunkType: "function" | "class" | "file";
    symbolName?: string;
    startLine: number;
    endLine: number;
    content: string;
    embedding?: number[];
    metadata: {
        language: string;
    }
}

export interface RAGAnswer {
    answer: string;
    sources: Array<{ filePath: string; start: number; end: number }>;
    confidence: number;
}

export interface RAGQueryResult {
    answer: string;
    citations: Record<string, {
        filePath: string;
        startLine: number;
        endLine: number;
        symbolName?: string | null;
    }>;
    chunks: Array<{
        filePath: string;
        startLine: number;
        endLine: number;
        symbolName?: string | null;
        score: number;
        language: string;
    }>;
    meta: {
        repoId: string;
        query: string;
        totalCandidates: number;
        chunksUsed: number;
        retrievalMs: number;
    };
}

