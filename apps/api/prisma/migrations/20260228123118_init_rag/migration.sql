-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "githubId" TEXT,
    "name" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL DEFAULT 0,
    "overallLevel" TEXT NOT NULL DEFAULT 'beginner',
    "accountAgeYears" INTEGER NOT NULL DEFAULT 0,
    "totalRepos" INTEGER NOT NULL DEFAULT 0,
    "totalStars" INTEGER NOT NULL DEFAULT 0,
    "contributionCount" INTEGER NOT NULL DEFAULT 0,
    "languageStats" JSONB NOT NULL DEFAULT '{}',
    "frameworks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredContributionTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weeklyAvailability" TEXT,
    "lastFastUpdate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepoIndex" (
    "id" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "commitHash" TEXT,
    "defaultBranch" TEXT,
    "sizeKB" INTEGER,
    "fileCount" INTEGER,
    "embeddingModel" TEXT,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "lastIndexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepoIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_chunks" (
    "id" TEXT NOT NULL,
    "repo_id" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "start_line" INTEGER NOT NULL,
    "end_line" INTEGER NOT NULL,
    "symbol_name" TEXT,
    "chunk_index" INTEGER NOT NULL,
    "embedding" vector(768),
    "embedded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "code_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillProfile_userId_key" ON "SkillProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RepoIndex_repoId_key" ON "RepoIndex"("repoId");

-- CreateIndex
CREATE INDEX "code_chunks_repo_id_idx" ON "code_chunks"("repo_id");

-- AddForeignKey
ALTER TABLE "SkillProfile" ADD CONSTRAINT "SkillProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
