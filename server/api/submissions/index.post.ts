import { z } from 'zod'
import { readBody, defineEventHandler, setResponseStatus } from 'h3'
import { prisma } from '../../utils/prisma'
import { apiError } from '../../utils/errors'
import { isUniqueConstraintError } from '../../utils/prisma-errors'
import { jobMajorMap, jobMinorMap, experienceBandMap, assertJobMinorMatchesMajor } from '../../utils/enum-maps'
import { serializeSubmissionSummary } from '../../utils/serializers'
import { detectPiiWarnings } from '../../utils/pii'

const SUBMISSION_COST = 3
const PRIORITY_PASS_DURATION_MS = 24 * 60 * 60 * 1000

const bodySchema = z.object({
  title: z.string().min(1),
  bodyText: z.string().min(1),
  jobMajor: jobMajorMap.zodEnum,
  jobMinor: jobMinorMap.zodEnum,
  experienceBand: experienceBandMap.zodEnum,
  lane: z.enum(['general', 'priority'])
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    apiError(400, 'INVALID_BODY', parsed.error.issues[0]?.message ?? '요청 값이 올바르지 않습니다.')
  }
  const body = parsed.data
  assertJobMinorMatchesMajor(body.jobMajor, body.jobMinor)

  const piiWarnings = detectPiiWarnings(body.bodyText)

  const { submission, creditBalance } = await prisma.$transaction(async (tx) => {
    // 잔액 확인과 차감을 하나의 원자적 UPDATE로 처리해 동시 요청 간 이중 차감을 막는다.
    const debited = await tx.user.updateMany({
      where: { id: session.user.id, creditBalance: { gte: SUBMISSION_COST } },
      data: { creditBalance: { decrement: SUBMISSION_COST } }
    })
    if (debited.count === 0) {
      apiError(409, 'INSUFFICIENT_CREDITS', '크레딧 잔액이 부족합니다.')
    }

    const created = await tx.submission.create({
      data: {
        userId: session.user.id,
        title: body.title,
        bodyText: body.bodyText,
        jobMajor: jobMajorMap.toPrisma(body.jobMajor),
        jobMinor: jobMinorMap.toPrisma(body.jobMinor),
        experienceBand: experienceBandMap.toPrisma(body.experienceBand),
        lane: body.lane
      }
    })

    await tx.creditLedgerEntry.create({
      data: {
        userId: session.user.id,
        delta: -SUBMISSION_COST,
        eventType: 'submission_debit',
        refId: created.id
      }
    })

    if (body.lane === 'priority') {
      try {
        await tx.priorityPass.create({
          data: {
            userId: session.user.id,
            submissionId: created.id,
            expiresAt: new Date(Date.now() + PRIORITY_PASS_DURATION_MS)
          }
        })
      } catch (error) {
        // idx_priority_pass_active_per_user 부분 유니크 인덱스 위반 → 이미 활성 우선매칭권 존재
        if (isUniqueConstraintError(error)) {
          apiError(409, 'PRIORITY_PASS_LIMIT', '이미 활성 우선매칭권이 있습니다.')
        }
        throw error
      }
    }

    const updatedUser = await tx.user.findUniqueOrThrow({ where: { id: session.user.id } })

    return { submission: created, creditBalance: updatedUser.creditBalance }
  })

  setResponseStatus(event, 201)
  return {
    submission: serializeSubmissionSummary(submission),
    creditBalance,
    piiWarnings
  }
})
