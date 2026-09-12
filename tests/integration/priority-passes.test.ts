import { describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { prisma } from '../../server/utils/prisma'
import { json, signupTestUser } from '../helpers/http'

const TAGS = { jobMajor: '개발', jobMinor: '백엔드', experienceBand: '1~3년' }

describe('우선매칭권 API (docs/api-spec.md 우선매칭권 섹션)', async () => {
  await setup({ server: true })

  const stamp = Date.now()
  const owner = { email: `pp-owner-${stamp}@example.com`, password: 'password123', ...TAGS }
  const stranger = { email: `pp-stranger-${stamp}@example.com`, password: 'password123', ...TAGS }

  let ownerId = ''
  let ownerCookie = ''
  let strangerCookie = ''
  let generalSubmissionId = ''

  it('setup', async () => {
    const o = await signupTestUser(owner)
    ownerId = o.user.id
    ownerCookie = o.cookie
    await prisma.user.update({ where: { id: ownerId }, data: { creditBalance: 20 } })
    strangerCookie = (await signupTestUser(stranger)).cookie

    const res = await json('/api/submissions', {
      method: 'POST',
      cookie: ownerCookie,
      body: { title: 'general', bodyText: 'b', lane: 'general', ...TAGS }
    })
    generalSubmissionId = (await res.json()).submission.id
  })

  it('POST /api/priority-passes — 소유자가 아니면 404', async () => {
    const res = await json('/api/priority-passes', {
      method: 'POST',
      cookie: strangerCookie,
      body: { submissionId: generalSubmissionId }
    })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('SUBMISSION_NOT_FOUND')
  })

  it('POST /api/priority-passes — 존재하지 않는 제출물은 404', async () => {
    const res = await json('/api/priority-passes', {
      method: 'POST',
      cookie: ownerCookie,
      body: { submissionId: '00000000-0000-0000-0000-000000000000' }
    })
    expect(res.status).toBe(404)
  })

  it('POST /api/priority-passes — 일반 제출물을 우선 레인으로 전환', async () => {
    const res = await json('/api/priority-passes', {
      method: 'POST',
      cookie: ownerCookie,
      body: { submissionId: generalSubmissionId }
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.priorityPass.submissionId).toBe(generalSubmissionId)
    expect(body.priorityPass.status).toBe('active')

    const updated = await prisma.submission.findUniqueOrThrow({ where: { id: generalSubmissionId } })
    expect(updated.lane).toBe('priority')
  })

  it('POST /api/priority-passes — 이미 활성 패스가 있으면 409 (다른 제출물이어도)', async () => {
    const otherRes = await json('/api/submissions', {
      method: 'POST',
      cookie: ownerCookie,
      body: { title: 'other', bodyText: 'b', lane: 'general', ...TAGS }
    })
    const otherId = (await otherRes.json()).submission.id

    const res = await json('/api/priority-passes', {
      method: 'POST',
      cookie: ownerCookie,
      body: { submissionId: otherId }
    })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('PRIORITY_PASS_LIMIT')
  })

  it('cleanup', async () => {
    const emails = [owner.email, stranger.email]
    const users = await prisma.user.findMany({ where: { email: { in: emails } } })
    const userIds = users.map(u => u.id)
    const submissions = await prisma.submission.findMany({ where: { userId: { in: userIds } } })
    const submissionIds = submissions.map(s => s.id)
    await prisma.priorityPass.deleteMany({ where: { submissionId: { in: submissionIds } } })
    await prisma.creditLedgerEntry.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.submission.deleteMany({ where: { id: { in: submissionIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  })
})
