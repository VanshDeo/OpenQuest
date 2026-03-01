import { useQuery, useMutation } from "@tanstack/react-query";
import { analyzeRepository, indexRepository, getIndexStatus } from "../lib/apiClient";

export function useRepoAnalysis(githubUrl: string | null) {
    return useQuery({
        queryKey: ["repo-analysis", githubUrl],
        queryFn: () => analyzeRepository(githubUrl!),
        enabled: !!githubUrl,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

export function useIndexRepo() {
    return useMutation({
        mutationFn: indexRepository,
    });
}

export function useIndexStatus(jobId: string | null) {
    return useQuery({
        queryKey: ["index-status", jobId],
        queryFn: () => getIndexStatus(jobId!),
        enabled: !!jobId,
        refetchInterval: (query: any) => {
            const data = query.state.data;
            return data?.state === "completed" || data?.state === "failed" ? false : 2000;
        },
    });
}
