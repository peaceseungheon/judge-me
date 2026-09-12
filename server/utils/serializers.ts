import type { User as PrismaUser, Submission as PrismaSubmission, QueueClaim as PrismaQueueClaim, Review as PrismaReview, TrustChecklistResponse as PrismaTrustChecklistResponse } from '../../generated/prisma/client'
import { jobMajorMap, jobMinorMap, experienceBandMap } from './enum-maps'

export function serializeUserSummary(user: PrismaUser) {
  return {
    id: user.id,
    email: user.email,
    jobMajor: jobMajorMap.fromPrisma(user.jobMajor),
    jobMinor: jobMinorMap.fromPrisma(user.jobMinor),
    experienceBand: experienceBandMap.fromPrisma(user.experienceBand),
    creditBalance: user.creditBalance
  }
}

export function serializeUserProfile(user: PrismaUser) {
  return {
    ...serializeUserSummary(user),
    trustScore: Number(user.trustScore),
    createdAt: user.createdAt.toISOString()
  }
}

export function serializeSubmissionSummary(submission: PrismaSubmission) {
  return {
    id: submission.id,
    title: submission.title,
    jobMajor: jobMajorMap.fromPrisma(submission.jobMajor),
    jobMinor: jobMinorMap.fromPrisma(submission.jobMinor),
    experienceBand: experienceBandMap.fromPrisma(submission.experienceBand),
    lane: submission.lane,
    reviewerCount: submission.reviewerCount,
    status: submission.status,
    createdAt: submission.createdAt.toISOString()
  }
}

export function serializeSubmissionDetail(submission: PrismaSubmission) {
  return {
    ...serializeSubmissionSummary(submission),
    bodyText: submission.bodyText
  }
}

/** POST /api/queue/claim 응답에 쓰는 축약형 — lane/reviewerCount/status/createdAt은 제외한다. */
export function serializeClaimSubmission(submission: PrismaSubmission) {
  return {
    id: submission.id,
    title: submission.title,
    bodyText: submission.bodyText,
    jobMajor: jobMajorMap.fromPrisma(submission.jobMajor),
    jobMinor: jobMinorMap.fromPrisma(submission.jobMinor),
    experienceBand: experienceBandMap.fromPrisma(submission.experienceBand)
  }
}

export function serializeQueueClaim(claim: PrismaQueueClaim) {
  return {
    id: claim.id,
    submissionId: claim.submissionId,
    claimedAt: claim.claimedAt.toISOString()
  }
}

export function serializeTrustChecklistResponse(response: PrismaTrustChecklistResponse) {
  return {
    usedSpecifics: response.usedSpecifics,
    newPerspective: response.newPerspective,
    actionableAlternatives: response.actionableAlternatives
  }
}

export function serializeReview(
  review: PrismaReview,
  trustChecklistResponse?: PrismaTrustChecklistResponse | null
) {
  return {
    id: review.id,
    scoreRelevance: review.scoreRelevance,
    scoreLogic: review.scoreLogic,
    scoreSpecificity: review.scoreSpecificity,
    scoreReadability: review.scoreReadability,
    comment: review.comment,
    submittedAt: review.submittedAt.toISOString(),
    ...(trustChecklistResponse
      ? { trustChecklistResponse: serializeTrustChecklistResponse(trustChecklistResponse) }
      : {})
  }
}
