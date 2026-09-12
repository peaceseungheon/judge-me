import { z } from 'zod'
import { getQuery, defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { apiError } from '../../utils/errors'
import { serializeSubmissionSummary } from '../../utils/serializers'

const querySchema = z.object({
  status: z.enum(['open', 'closed']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const parsed = querySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    apiError(400, 'INVALID_QUERY', parsed.error.issues[0]?.message ?? '요청 값이 올바르지 않습니다.')
  }
  const { status, page, limit } = parsed.data

  const where = { userId: session.user.id, ...(status ? { status } : {}) }

  const [submissions, total] = await Promise.all([
    prisma.submission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.submission.count({ where })
  ])

  return {
    submissions: submissions.map(serializeSubmissionSummary),
    total,
    page,
    limit
  }
})
