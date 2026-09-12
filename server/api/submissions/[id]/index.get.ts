import { defineEventHandler, getRouterParam } from 'h3'
import { prisma } from '../../../utils/prisma'
import { apiError } from '../../../utils/errors'
import { serializeSubmissionDetail, serializeReview } from '../../../utils/serializers'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')
  if (!id) apiError(400, 'INVALID_PARAM', '잘못된 요청입니다.')

  const submission = await prisma.submission.findUnique({ where: { id } })
  if (!submission) apiError(404, 'SUBMISSION_NOT_FOUND', '제출물을 찾을 수 없습니다.')

  const isOwner = submission.userId === session.user.id

  if (!isOwner) {
    const claim = await prisma.queueClaim.findUnique({
      where: { submissionId_reviewerId: { submissionId: submission.id, reviewerId: session.user.id } }
    })
    if (!claim) {
      apiError(403, 'FORBIDDEN', '이 제출물에 접근할 권한이 없습니다.')
    }
    return serializeSubmissionDetail(submission)
  }

  const reviews = await prisma.review.findMany({
    where: { submissionId: submission.id },
    include: { trustChecklistResponse: true },
    orderBy: { submittedAt: 'asc' }
  })

  return {
    ...serializeSubmissionDetail(submission),
    reviews: reviews.map(r => serializeReview(r, r.trustChecklistResponse))
  }
})
