export interface CommunityHealth {
    score: number;
    label: "Inactive" | "Low" | "Moderate" | "Active" | "Very Active";
    lastCommitDays: number;
    commitFrequency: "Daily" | "Weekly" | "Monthly" | "Rarely";
    hasContributingGuide: boolean;
    hasCodeOfConduct: boolean;
    avgIssueResponseDays: number;
    recentContributors: number;
}

export interface RepoAnalysis {
    repoId: string;
    name: string;
    fullName: string;
    description: string;
    stars: number;
    forks: number;
    openIssues: number;
    contributorCount: number;
    techStack: string[];
    purpose: string;
    difficultyScore: number;
    difficultyLabel: "Beginner" | "Intermediate" | "Advanced" | "Expert";
    communityHealth: CommunityHealth;
    defaultBranch: string;
}
