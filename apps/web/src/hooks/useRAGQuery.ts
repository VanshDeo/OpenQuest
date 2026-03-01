import { useMutation } from "@tanstack/react-query";
import { queryCodebase } from "../lib/apiClient";

export function useRAGQuery(repoId: string) {
    return useMutation({
        mutationFn: (query: string) => queryCodebase(repoId, query),
    });
}
