import { describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { prisma } from '../../server/utils/prisma'
import { json, signupTestUser } from '../helpers/http'

const TAGS = { jobMajor: '개발', jobMinor: '백엔드', experienceBand: '1~3년' }

describe('크레딧 API (docs/api-spec.md 크레딧 섹션)', async () => {
  await setup({ server: true })

  const stamp = Date.now()
  const user = { email: `credits-${stamp}@example.com`, password: 'password123', ...TAGS }
  let userId = ''
  let cookie = ''

  it('setup: 가입 후 잔액/이력 조회', async () => {
    const signedUp = await signupTestUser(user)
    userId = signedUp.user.id
    cookie = signedUp.cookie
  })

  it('GET /api/credits/balance — 가입 직후 5', async () => {
    const res = await json('/api/credits/balance', { cookie })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.creditBalance).toBe(5)
  })

  it('GET /api/credits/history — signup_bonus 원장 1건', async () => {
    const res = await json('/api/credits/history', { cookie })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBe(1)
    expect(body.currentBalance).toBe(5)
    expect(body.entries[0]).toMatchObject({ delta: 5, eventType: 'signup_bonus', refId: null })
  })

  it('제출물 등록 후 submission_debit 원장이 최신순으로 추가된다', async () => {
    const res = await json('/api/submissions', {
      method: 'POST',
      cookie,
      body: { title: 't', bodyText: 'b', lane: 'general', ...TAGS }
    })
    const submissionId = (await res.json()).submission.id as string

    const historyRes = await json('/api/credits/history', { cookie })
    const body = await historyRes.json()
    expect(body.total).toBe(2)
    expect(body.currentBalance).toBe(2)
    expect(body.entries[0]).toMatchObject({ delta: -3, eventType: 'submission_debit', refId: submissionId })
    expect(body.entries[1].eventType).toBe('signup_bonus')
  })

  it('GET /api/credits/balance — 인증 없으면 401', async () => {
    const res = await json('/api/credits/balance')
    expect(res.status).toBe(401)
  })

  it('cleanup', async () => {
    await prisma.submission.deleteMany({ where: { userId } })
    await prisma.creditLedgerEntry.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } })
  })
})
