import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { serializeUserProfile } from '../../utils/serializers'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } })
  return serializeUserProfile(user)
})
