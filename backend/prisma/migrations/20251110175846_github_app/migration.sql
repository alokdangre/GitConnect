-- AlterTable
ALTER TABLE "User" ADD COLUMN     "githubRefreshToken" TEXT,
ADD COLUMN     "githubTokenScope" TEXT,
ADD COLUMN     "githubTokenType" TEXT,
ADD COLUMN     "refreshTokenExpiresAt" TIMESTAMP(3);
