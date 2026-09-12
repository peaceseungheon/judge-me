import { z } from 'zod'
import { readBody, defineEventHandler, setResponseStatus } from 'h3'
import { prisma } from '../utils/prisma'
import { apiError } from '../utils/errors'
import { isUniqueConstraintError } from '../utils/prisma-errors'

const bodySchema = z.object({
  reviewId: z.string().uuid(),
  usedSpecifics: z.boolean(),
  newPerspective: z.boolean(),
  actionableAlternatives: z.boolean()
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    apiError(400, 'INVALID_BODY', parsed.error.issues[0]?.message ?? '요청 값이 올바르지 않습니다.')
  }
  const body = parsed.data

  const review = await prisma.review.findUnique({
    where: { id: body.reviewId },
    include: { submission: true }
  })
  if (!review) {
    apiError(404, 'REVIEW_NOT_FOUND', '평가를 찾을 수 없습니다.')
  }
  if (review.submission.userId !== session.user.id) {
    apiError(403, 'NOT_SUBMITTER', '해당 제출물의 소유자가 아닙니다.')
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const response = await tx.trustChecklistResponse.create({
        data: {
          reviewId: review.id,
          submissionId: review.submissionId,
          submitterId: session.user.id,
          usedSpecifics: body.usedSpecifics,
          newPerspective: body.newPerspective,
          actionableAlternatives: body.actionableAlternatives
        }
      })

      // 신뢰 점수는 "평가를 받은 제출자가 평가자를 판단한 결과"이므로 리뷰 작성자(reviewerId)의
      // users.trust_score를 그 평가자가 받은 모든 체크리스트 응답의 '예' 비율로 재계산한다.
      // (docs/data-model.md: "배치 또는 응답 저장 시 재계산" — 정확한 산식은 명시되지 않아 MVP
      // 기준으로 단순 비율을 채택함.)
      const answers = await tx.trustChecklistResponse.findMany({
        where: { review: { reviewerId: review.reviewerId } },
        select: { usedSpecifics: true, newPerspective: true, actionableAlternatives: true }
      })
      const trueCount = answers.reduce(
        (sum, a) => sum + Number(a.usedSpecifics) + Number(a.newPerspective) + Number(a.actionableAlternatives),
        0
      )
      const totalCount = answers.length * 3
      const trustScore = totalCount === 0 ? 0 : Math.round((trueCount / totalCount) * 10000) / 100
      await tx.user.update({ where: { id: review.reviewerId }, data: { trustScore } })

      return response
    })

    setResponseStatus(event, 201)
    return {
      trustChecklistResponse: {
        id: created.id,
        reviewId: created.reviewId,
        createdAt: created.createdAt.toISOString()
      }
    }
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      apiError(409, 'ALREADY_RESPONDED', '이미 응답했습니다.')
    }
    throw error
  }
})
