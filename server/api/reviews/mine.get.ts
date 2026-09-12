import { z } from 'zod'
import { getQuery, defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { apiError } from '../../utils/errors'
import { serializeReviewMine } from '../../utils/serializers'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const parsed = querySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    apiError(400, 'INVALID_QUERY', parsed.error.issues[0]?.message ?? '요청 값이 올바르지 않습니다.')
  }
  const { page, limit } = parsed.data

  const where = { reviewerId: session.user.id }
  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.review.count({ where })
  ])

  return {
    reviews: reviews.map(serializeReviewMine),
    total
  }
})
