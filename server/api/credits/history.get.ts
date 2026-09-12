import { z } from 'zod'
import { getQuery, defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { apiError } from '../../utils/errors'

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

  const where = { userId: session.user.id }
  const [entries, total, user] = await Promise.all([
    prisma.creditLedgerEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.creditLedgerEntry.count({ where }),
    prisma.user.findUniqueOrThrow({ where: { id: session.user.id } })
  ])

  return {
    entries: entries.map(entry => ({
      id: entry.id,
      delta: entry.delta,
      eventType: entry.eventType,
      refId: entry.refId,
      createdAt: entry.createdAt.toISOString()
    })),
    total,
    currentBalance: user.creditBalance
  }
})
