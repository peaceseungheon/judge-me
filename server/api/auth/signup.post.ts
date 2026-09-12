import { z } from 'zod'
import { readBody, defineEventHandler, setResponseStatus } from 'h3'
import { prisma } from '../../utils/prisma'
import { apiError } from '../../utils/errors'
import { jobMajorMap, jobMinorMap, experienceBandMap, assertJobMinorMatchesMajor } from '../../utils/enum-maps'
import { serializeUserSummary } from '../../utils/serializers'

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  jobMajor: jobMajorMap.zodEnum,
  jobMinor: jobMinorMap.zodEnum,
  experienceBand: experienceBandMap.zodEnum
})

export default defineEventHandler(async (event) => {
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    apiError(400, 'INVALID_BODY', parsed.error.issues[0]?.message ?? '요청 값이 올바르지 않습니다.')
  }
  const body = parsed.data

  assertJobMinorMatchesMajor(body.jobMajor, body.jobMinor)

  const existing = await prisma.user.findUnique({ where: { email: body.email } })
  if (existing) {
    apiError(409, 'DUPLICATE_EMAIL', '이미 등록된 이메일입니다.')
  }

  const passwordHash = await hashPassword(body.password)

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: body.email,
        passwordHash,
        jobMajor: jobMajorMap.toPrisma(body.jobMajor),
        jobMinor: jobMinorMap.toPrisma(body.jobMinor),
        experienceBand: experienceBandMap.toPrisma(body.experienceBand)
      }
    })
    await tx.creditLedgerEntry.create({
      data: { userId: created.id, delta: 5, eventType: 'signup_bonus' }
    })
    return created
  })

  await setUserSession(event, { user: { id: user.id, email: user.email } })

  setResponseStatus(event, 201)
  return { user: serializeUserSummary(user) }
})
