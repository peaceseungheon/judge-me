import { describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { prisma } from '../../server/utils/prisma'
import { json, signupTestUser } from '../helpers/http'

describe('제출물 API (docs/api-spec.md 자소서 제출물 섹션)', async () => {
  await setup({ server: true })

  const stamp = Date.now()
  const owner = { email: `sub-owner-${stamp}@example.com`, password: 'password123', jobMajor: '개발', jobMinor: '백엔드', experienceBand: '1~3년' }
  const stranger = { email: `sub-stranger-${stamp}@example.com`, password: 'password123', jobMajor: '개발', jobMinor: '백엔드', experienceBand: '1~3년' }

  let ownerCookie = ''
  let strangerCookie = ''
  let submissionId = ''

  it('setup: 계정 2개 생성', async () => {
    ownerCookie = (await signupTestUser(owner)).cookie
    strangerCookie = (await signupTestUser(stranger)).cookie
  })

  it('POST /api/submissions — 크레딧 3점 차감 + PII 경고 반환', async () => {
    const res = await json('/api/submissions', {
      method: 'POST',
      cookie: ownerCookie,
      body: {
        title: '내 자소서',
        bodyText: '연락처는 test@example.com 입니다.',
        jobMajor: '개발',
        jobMinor: '백엔드',
        experienceBand: '1~3년',
        lane: 'general'
      }
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.creditBalance).toBe(2)
    expect(body.piiWarnings).toEqual([{ type: 'email', match: 'test@example.com', offset: 5 }])
    submissionId = body.submission.id
  })

  it('POST /api/submissions — 크레딧 부족 시 409', async () => {
    const res = await json('/api/submissions', {
      method: 'POST',
      cookie: ownerCookie,
      body: { title: '2', bodyText: 'b', jobMajor: '개발', jobMinor: '백엔드', experienceBand: '1~3년', lane: 'general' }
    })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('INSUFFICIENT_CREDITS')
  })

  it('GET /api/submissions/mine — 본인 제출물만 조회', async () => {
    const res = await json('/api/submissions/mine', { cookie: ownerCookie })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(1)
    expect(body.submissions[0].id).toBe(submissionId)
    expect(body.submissions[0].bodyText).toBeUndefined()
  })

  it('GET /api/submissions/:id/progress — 소유자는 조회 가능', async () => {
    const res = await json(`/api/submissions/${submissionId}/progress`, { cookie: ownerCookie })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ submissionId, reviewerCount: 0, targetCount: 3, status: 'open' })
  })

  it('GET /api/submissions/:id/progress — 소유자가 아니면 403', async () => {
    const res = await json(`/api/submissions/${submissionId}/progress`, { cookie: strangerCookie })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_SUBMITTER')
  })

  it('GET /api/submissions/:id — 소유자는 bodyText와 reviews를 포함해 조회', async () => {
    const res = await json(`/api/submissions/${submissionId}`, { cookie: ownerCookie })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.bodyText).toContain('test@example.com')
    expect(body.reviews).toEqual([])
  })

  it('GET /api/submissions/:id — 클레임하지 않은 타인은 403', async () => {
    const res = await json(`/api/submissions/${submissionId}`, { cookie: strangerCookie })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('FORBIDDEN')
  })

  it('GET /api/submissions/:id — 존재하지 않으면 404', async () => {
    const res = await json('/api/submissions/00000000-0000-0000-0000-000000000000', { cookie: ownerCookie })
    expect(res.status).toBe(404)
  })

  it('priority 레인 — 두 번째 활성 우선매칭권은 409, 롤백으로 크레딧 유지', async () => {
    const priorityUser = { email: `sub-priority-${stamp}@example.com`, password: 'password123', jobMajor: '개발', jobMinor: '백엔드', experienceBand: '1~3년' }
    const { user, cookie } = await signupTestUser(priorityUser)
    await prisma.user.update({ where: { id: user.id }, data: { creditBalance: 10 } })

    const first = await json('/api/submissions', {
      method: 'POST',
      cookie,
      body: { title: 'p1', bodyText: 'b', jobMajor: '개발', jobMinor: '백엔드', experienceBand: '1~3년', lane: 'priority' }
    })
    expect(first.status).toBe(201)

    const second = await json('/api/submissions', {
      method: 'POST',
      cookie,
      body: { title: 'p2', bodyText: 'b', jobMajor: '개발', jobMinor: '백엔드', experienceBand: '1~3년', lane: 'priority' }
    })
    expect(second.status).toBe(409)
    const body = await second.json()
    expect(body.error.code).toBe('PRIORITY_PASS_LIMIT')

    const reloaded = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(reloaded.creditBalance).toBe(7) // 10 - 3(first) — 실패한 두 번째 시도는 롤백되어 차감되지 않음
  })

  it('cleanup', async () => {
    const emails = [owner.email, stranger.email, `sub-priority-${stamp}@example.com`]
    const users = await prisma.user.findMany({ where: { email: { in: emails } } })
    const userIds = users.map(u => u.id)
    await prisma.review.deleteMany({ where: { reviewerId: { in: userIds } } })
    await prisma.queueClaim.deleteMany({ where: { reviewerId: { in: userIds } } })
    await prisma.priorityPass.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.creditLedgerEntry.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.submission.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  })
})
