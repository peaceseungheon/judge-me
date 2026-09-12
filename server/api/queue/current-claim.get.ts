import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { serializeQueueClaim } from '../../utils/serializers'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  const claim = await prisma.queueClaim.findFirst({
    where: { reviewerId: session.user.id },
    orderBy: { claimedAt: 'desc' }
  })

  if (!claim) {
    return { claim: null }
  }

  return {
    claim: {
      ...serializeQueueClaim(claim),
      status: claim.status
    }
  }
})
