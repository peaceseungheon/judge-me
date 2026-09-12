import { describe, expect, it, afterAll } from 'vitest'
import { prisma } from '../../server/utils/prisma'

describe('데이터 모델 제약 (docs/data-model.md)', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('users.credit_balance는 음수를 허용하지 않는다', async () => {
    const user = await prisma.user.create({
      data: {
        email: `check-${Date.now()}@example.com`,
        passwordHash: 'x',
        jobMajor: 'DEV',
        jobMinor: 'BACKEND',
        experienceBand: 'ENTRY'
      }
    })

    await expect(
      prisma.user.update({
        where: { id: user.id },
        data: { creditBalance: -1 }
      })
    ).rejects.toThrow()

    await prisma.user.delete({ where: { id: user.id } })
  })

  it('reviews.comment는 50자 미만이면 거부된다', async () => {
    const user = await prisma.user.create({
      data: {
        email: `check-${Date.now()}-reviewer@example.com`,
        passwordHash: 'x',
        jobMajor: 'DEV',
        jobMinor: 'BACKEND',
        experienceBand: 'ENTRY'
      }
    })
    const submission = await prisma.submission.create({
      data: {
        userId: user.id,
        title: 't',
        bodyText: 'b',
        jobMajor: 'DEV',
        jobMinor: 'BACKEND',
        experienceBand: 'ENTRY'
      }
    })
    const claim = await prisma.queueClaim.create({
      data: { submissionId: submission.id, reviewerId: user.id }
    })

    await expect(
      prisma.review.create({
        data: {
          queueClaimId: claim.id,
          submissionId: submission.id,
          reviewerId: user.id,
          scoreRelevance: 5,
          scoreLogic: 5,
          scoreSpecificity: 5,
          scoreReadability: 5,
          comment: '짧음'
        }
      })
    ).rejects.toThrow()
  })

  it('priority_passes는 사용자당 활성 1건만 허용한다', async () => {
    const user = await prisma.user.create({
      data: {
        email: `check-${Date.now()}-pp@example.com`,
        passwordHash: 'x',
        jobMajor: 'DEV',
        jobMinor: 'BACKEND',
        experienceBand: 'ENTRY'
      }
    })
    const submissionA = await prisma.submission.create({
      data: {
        userId: user.id,
        title: 'a',
        bodyText: 'b',
        jobMajor: 'DEV',
        jobMinor: 'BACKEND',
        experienceBand: 'ENTRY',
        lane: 'priority'
      }
    })
    const submissionB = await prisma.submission.create({
      data: {
        userId: user.id,
        title: 'b',
        bodyText: 'b',
        jobMajor: 'DEV',
        jobMinor: 'BACKEND',
        experienceBand: 'ENTRY',
        lane: 'priority'
      }
    })

    await prisma.priorityPass.create({
      data: {
        userId: user.id,
        submissionId: submissionA.id,
        expiresAt: new Date(Date.now() + 86_400_000)
      }
    })

    await expect(
      prisma.priorityPass.create({
        data: {
          userId: user.id,
          submissionId: submissionB.id,
          expiresAt: new Date(Date.now() + 86_400_000)
        }
      })
    ).rejects.toThrow()
  })
})
