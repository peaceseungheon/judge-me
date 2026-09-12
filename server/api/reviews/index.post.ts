import { z } from 'zod'
import { readBody, defineEventHandler, setResponseStatus } from 'h3'
import { prisma } from '../../utils/prisma'
import { apiError } from '../../utils/errors'
import { isUniqueConstraintError } from '../../utils/prisma-errors'

const score = () => z.number().int().min(1, '점수는 1~5 사이여야 합니다.').max(5, '점수는 1~5 사이여야 합니다.')

const bodySchema = z.object({
  queueClaimId: z.string().uuid(),
  scoreRelevance: score(),
  scoreLogic: score(),
  scoreSpecificity: score(),
  scoreReadability: score(),
  comment: z.string().min(50, '코멘트는 50자 이상이어야 합니다.')
})

const REVIEW_CREDIT = 1
const CLOSE_AT_REVIEWER_COUNT = 3

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    apiError(422, 'COMPLETENESS_FAILED', parsed.error.issues[0]?.message ?? '점수 또는 코멘트가 완결성 기준을 충족하지 않습니다.')
  }
  const body = parsed.data

  const claim = await prisma.queueClaim.findUnique({ where: { id: body.queueClaimId } })
  if (!claim || claim.reviewerId !== session.user.id) {
    apiError(404, 'CLAIM_NOT_FOUND', '유효하지 않은 클레임입니다.')
  }
  if (claim.status === 'reviewed') {
    apiError(409, 'REVIEW_ALREADY_EXISTS', '이미 제출한 평가입니다.')
  }

  try {
    const { review, creditBalance } = await prisma.$transaction(async (tx) => {
      const createdReview = await tx.review.create({
        data: {
          queueClaimId: claim.id,
          submissionId: claim.submissionId,
          reviewerId: session.user.id,
          scoreRelevance: body.scoreRelevance,
          scoreLogic: body.scoreLogic,
          scoreSpecificity: body.scoreSpecificity,
          scoreReadability: body.scoreReadability,
          comment: body.comment
        }
      })

      await tx.queueClaim.update({
        where: { id: claim.id },
        data: { status: 'reviewed', reviewedAt: new Date() }
      })

      const submission = await tx.submission.update({
        where: { id: claim.submissionId },
        data: { reviewerCount: { increment: 1 } }
      })
      if (submission.reviewerCount >= CLOSE_AT_REVIEWER_COUNT) {
        await tx.submission.update({ where: { id: submission.id }, data: { status: 'closed' } })
      }

      const updatedUser = await tx.user.update({
        where: { id: session.user.id },
        data: { creditBalance: { increment: REVIEW_CREDIT } }
      })

      await tx.creditLedgerEntry.create({
        data: {
          userId: session.user.id,
          delta: REVIEW_CREDIT,
          eventType: 'review_credit',
          refId: createdReview.id
        }
      })

      return { review: createdReview, creditBalance: updatedUser.creditBalance }
    })

    setResponseStatus(event, 201)
    return {
      review: {
        id: review.id,
        submissionId: review.submissionId,
        submittedAt: review.submittedAt.toISOString()
      },
      creditBalance
    }
  } catch (error) {
    // reviews.queue_claim_id UNIQUE 제약 — 동시 요청으로 같은 클레임에 두 번 제출되는 경쟁을 방지.
    if (isUniqueConstraintError(error)) {
      apiError(409, 'REVIEW_ALREADY_EXISTS', '이미 제출한 평가입니다.')
    }
    throw error
  }
})
