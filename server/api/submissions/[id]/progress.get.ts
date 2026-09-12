import { defineEventHandler, getRouterParam } from 'h3'
import { prisma } from '../../../utils/prisma'
import { apiError } from '../../../utils/errors'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) apiError(400, 'INVALID_PARAM', '잘못된 요청입니다.')

  const submission = await prisma.submission.findUnique({ where: { id } })
  if (!submission) apiError(404, 'SUBMISSION_NOT_FOUND', '제출물을 찾을 수 없습니다.')
  if (submission.userId !== session.user.id) {
    apiError(403, 'NOT_SUBMITTER', '해당 제출물의 소유자가 아닙니다.')
  }

  return {
    submissionId: submission.id,
    reviewerCount: submission.reviewerCount,
    targetCount: 3 as const,
    progressLabel: `${submission.reviewerCount}/3 평가 완료`,
    status: submission.status
  }
})
