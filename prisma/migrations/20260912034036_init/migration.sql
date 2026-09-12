-- CreateEnum
CREATE TYPE "job_major" AS ENUM ('개발', '디자인', '마케팅', '기획', '영업', 'HR');

-- CreateEnum
CREATE TYPE "job_minor" AS ENUM ('프론트엔드', '백엔드', '풀스택', '모바일', '데이터·AI', 'DevOps·인프라', 'UX·UI', '그래픽·브랜딩', '프로덕트 디자인', '퍼포먼스', '브랜드·콘텐츠', '그로스', '프로덕트 기획', '서비스 기획', '영업', '비즈니스 개발', '채용', '인사·조직문화');

-- CreateEnum
CREATE TYPE "experience_band" AS ENUM ('신입', '1~3년', '4~7년', '8년+');

-- CreateEnum
CREATE TYPE "submission_lane" AS ENUM ('general', 'priority');

-- CreateEnum
CREATE TYPE "submission_status" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "claim_status" AS ENUM ('claimed', 'reviewed', 'abandoned');

-- CreateEnum
CREATE TYPE "credit_event_type" AS ENUM ('signup_bonus', 'submission_debit', 'review_credit');

-- CreateEnum
CREATE TYPE "priority_pass_status" AS ENUM ('active', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "job_major" "job_major" NOT NULL,
    "job_minor" "job_minor" NOT NULL,
    "experience_band" "experience_band" NOT NULL,
    "credit_balance" INTEGER NOT NULL DEFAULT 5,
    "trust_score" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    "job_major" "job_major" NOT NULL,
    "job_minor" "job_minor" NOT NULL,
    "experience_band" "experience_band" NOT NULL,
    "lane" "submission_lane" NOT NULL DEFAULT 'general',
    "reviewer_count" INTEGER NOT NULL DEFAULT 0,
    "status" "submission_status" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_claims" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "status" "claim_status" NOT NULL DEFAULT 'claimed',
    "claimed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ,

    CONSTRAINT "queue_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "queue_claim_id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "score_relevance" SMALLINT NOT NULL,
    "score_logic" SMALLINT NOT NULL,
    "score_specificity" SMALLINT NOT NULL,
    "score_readability" SMALLINT NOT NULL,
    "comment" TEXT NOT NULL,
    "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_checklist_responses" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "submitter_id" UUID NOT NULL,
    "used_specifics" BOOLEAN NOT NULL,
    "new_perspective" BOOLEAN NOT NULL,
    "actionable_alternatives" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trust_checklist_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_ledger_entries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "event_type" "credit_event_type" NOT NULL,
    "ref_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "priority_passes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "status" "priority_pass_status" NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "priority_passes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_submissions_queue" ON "submissions"("job_major", "job_minor", "experience_band", "created_at");

-- CreateIndex
CREATE INDEX "idx_queue_claims_submission" ON "queue_claims"("submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "queue_claims_submission_id_reviewer_id_key" ON "queue_claims"("submission_id", "reviewer_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_queue_claim_id_key" ON "reviews"("queue_claim_id");

-- CreateIndex
CREATE UNIQUE INDEX "trust_checklist_responses_review_id_key" ON "trust_checklist_responses"("review_id");

-- CreateIndex
CREATE INDEX "idx_credit_ledger_user" ON "credit_ledger_entries"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "priority_passes_submission_id_key" ON "priority_passes"("submission_id");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_claims" ADD CONSTRAINT "queue_claims_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_claims" ADD CONSTRAINT "queue_claims_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_queue_claim_id_fkey" FOREIGN KEY ("queue_claim_id") REFERENCES "queue_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_checklist_responses" ADD CONSTRAINT "trust_checklist_responses_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_checklist_responses" ADD CONSTRAINT "trust_checklist_responses_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_checklist_responses" ADD CONSTRAINT "trust_checklist_responses_submitter_id_fkey" FOREIGN KEY ("submitter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "priority_passes" ADD CONSTRAINT "priority_passes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "priority_passes" ADD CONSTRAINT "priority_passes_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint (docs/data-model.md 제약 명세 — Prisma DSL로 표현 불가하여 수기 추가)
ALTER TABLE "users" ADD CONSTRAINT "users_credit_balance_check" CHECK ("credit_balance" >= 0);

ALTER TABLE "submissions" ADD CONSTRAINT "submissions_reviewer_count_check" CHECK ("reviewer_count" >= 0 AND "reviewer_count" <= 3);

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_score_relevance_check" CHECK ("score_relevance" BETWEEN 1 AND 5);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_score_logic_check" CHECK ("score_logic" BETWEEN 1 AND 5);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_score_specificity_check" CHECK ("score_specificity" BETWEEN 1 AND 5);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_score_readability_check" CHECK ("score_readability" BETWEEN 1 AND 5);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_comment_length_check" CHECK (char_length("comment") >= 50);

-- PartialUniqueIndex: 사용자당 활성 priority_pass 1건 상한
CREATE UNIQUE INDEX "idx_priority_pass_active_per_user" ON "priority_passes"("user_id") WHERE "status" = 'active';
