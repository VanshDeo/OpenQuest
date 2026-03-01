export interface Quest {
    id: number;
    title: string;
    body: string;
    url: string;
    labels: string[];
    difficultyScore: number;
    difficultyLabel: "Beginner" | "Intermediate" | "Advanced" | "Expert";
    xpReward: number;
    estimatedMinutes: number;
    isGoodFirstIssue: boolean;
    assignedTo: string | null;
}
