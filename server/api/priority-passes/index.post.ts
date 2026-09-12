import { z } from 'zod'
import { readBody, defineEventHandler, setResponseStatus } from 'h3'
import { prisma } from '../../utils/prisma'
import { apiError } from '../../utils/errors'
import { isUniqueConstraintError } from '../../utils/prisma-errors'

const PRIORITY_PASS_DURATION_MS = 24 * 60 * 60 * 1000

const bodySchema = z.object({
  submissionId: z.string().uuid()
})

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    apiError(400, 'INVALID_BODY', parsed.error.issues[0]?.message ?? '요청 값이 올바르지 않습니다.')
  }
  const { submissionId } = parsed.data

  const submission = await prisma.submission.findUnique({ where: { id: submissionId } })
  if (!submission || submission.userId !== session.user.id) {
    apiError(404, 'SUBMISSION_NOT_FOUND', '제출물 없음 또는 접근 권한 없음')
  }

  try {
    const priorityPass = await prisma.$transaction(async (tx) => {
      const created = await tx.priorityPass.create({
        data: {
          userId: session.user.id,
          submissionId: submission.id,
          expiresAt: new Date(Date.now() + PRIORITY_PASS_DURATION_MS)
        }
      })
      await tx.submission.update({ where: { id: submission.id }, data: { lane: 'priority' } })
      return created
    })

    setResponseStatus(event, 201)
    return {
      priorityPass: {
        id: priorityPass.id,
        submissionId: priorityPass.submissionId,
        status: priorityPass.status,
        expiresAt: priorityPass.expiresAt.toISOString(),
        createdAt: priorityPass.createdAt.toISOString()
      }
    }
  } catch (error) {
    // idx_priority_pass_active_per_user(사용자당 활성 1건) 또는 submission_id UNIQUE(이미 발급된
    // 패스가 있는 제출물) 위반 — 두 경우 모두 "우선매칭권을 추가로 발급할 수 없음"으로 귀결된다.
    if (isUniqueConstraintError(error)) {
      apiError(409, 'PRIORITY_PASS_LIMIT', '이미 활성 우선매칭권이 있습니다.')
    }
    throw error
  }
})
