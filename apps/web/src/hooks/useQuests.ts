import { useQuery } from "@tanstack/react-query";
import { getRepoQuests } from "../lib/apiClient";

export function useQuests(repoId: string | null, userLevel: number) {
    return useQuery({
        queryKey: ["quests", repoId, userLevel],
        queryFn: () => getRepoQuests(repoId!, userLevel),
        enabled: !!repoId,
        staleTime: 2 * 60 * 1000, // 2 minutes
    });
}
