import type { User as PrismaUser } from '../../generated/prisma/client'
import { jobMajorMap, jobMinorMap, experienceBandMap } from './enum-maps'

export function serializeUserSummary(user: PrismaUser) {
  return {
    id: user.id,
    email: user.email,
    jobMajor: jobMajorMap.fromPrisma(user.jobMajor),
    jobMinor: jobMinorMap.fromPrisma(user.jobMinor),
    experienceBand: experienceBandMap.fromPrisma(user.experienceBand),
    creditBalance: user.creditBalance
  }
}

export function serializeUserProfile(user: PrismaUser) {
  return {
    ...serializeUserSummary(user),
    trustScore: Number(user.trustScore),
    createdAt: user.createdAt.toISOString()
  }
}
