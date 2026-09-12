import { z } from 'zod'
import { readBody, defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { apiError } from '../../utils/errors'
import { serializeUserSummary } from '../../utils/serializers'

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string()
})

export default defineEventHandler(async (event) => {
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    apiError(400, 'INVALID_BODY', parsed.error.issues[0]?.message ?? '요청 값이 올바르지 않습니다.')
  }
  const { email, password } = parsed.data

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !(await verifyPassword(user.passwordHash, password))) {
    apiError(401, 'INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.')
  }

  await setUserSession(event, { user: { id: user.id, email: user.email } })

  return { user: serializeUserSummary(user) }
})
