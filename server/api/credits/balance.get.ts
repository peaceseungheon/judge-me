import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } })
  return { creditBalance: user.creditBalance }
})
