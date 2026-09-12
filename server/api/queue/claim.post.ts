import { defineEventHandler, setResponseStatus } from 'h3'
import { Prisma } from '../../../generated/prisma/client'
import { prisma } from '../../utils/prisma'
import { apiError } from '../../utils/errors'
import { jobMajorMap, jobMinorMap, experienceBandMap } from '../../utils/enum-maps'
import { serializeClaimSubmission, serializeQueueClaim } from '../../utils/serializers'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const evaluator = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } })

  // docs/data-model.md의 원자적 클레임 쿼리: FOR UPDATE SKIP LOCKED로 동시 클레임 경합을 처리한다.
  // enum 컬럼의 DB 표현은 한글(@map)이며 와이어 포맷과 동일한 문자열이므로 fromPrisma() 결과를 그대로 캐스팅한다.
  const result = await prisma.$transaction(async (tx) => {
    const targets = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT s.id
      FROM submissions s
      WHERE s.status = 'open'
        AND s.job_major = ${jobMajorMap.fromPrisma(evaluator.jobMajor)}::job_major
        AND s.job_minor = ${jobMinorMap.fromPrisma(evaluator.jobMinor)}::job_minor
        AND s.experience_band = ${experienceBandMap.fromPrisma(evaluator.experienceBand)}::experience_band
        AND s.user_id != ${evaluator.id}::uuid
        AND s.reviewer_count < 3
        AND NOT EXISTS (
          SELECT 1 FROM queue_claims qc
          WHERE qc.submission_id = s.id AND qc.reviewer_id = ${evaluator.id}::uuid
        )
      ORDER BY s.created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `)

    const target = targets[0]
    if (!target) return null

    const claim = await tx.queueClaim.create({
      data: { submissionId: target.id, reviewerId: evaluator.id }
    })
    const submission = await tx.submission.findUniqueOrThrow({ where: { id: target.id } })

    return { claim, submission }
  })

  if (!result) {
    apiError(404, 'QUEUE_EMPTY', '일치하는 제출물이 없습니다.')
  }

  setResponseStatus(event, 201)
  return {
    claim: serializeQueueClaim(result.claim),
    submission: serializeClaimSubmission(result.submission)
  }
})
