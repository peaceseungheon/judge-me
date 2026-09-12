import { describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { prisma } from '../../server/utils/prisma'
import { json, signupTestUser } from '../helpers/http'

async function createSubmission(cookie: string, title: string) {
  const res = await json('/api/submissions', {
    method: 'POST',
    cookie,
    body: { title, bodyText: 'b', jobMajor: '개발', jobMinor: '백엔드', experienceBand: '1~3년', lane: 'general' }
  })
  const body = await res.json()
  return body.submission.id as string
}

describe('평가 큐 API (docs/api-spec.md 평가 큐 섹션)', async () => {
  await setup({ server: true })

  const stamp = Date.now()
  const submitter = { email: `queue-submitter-${stamp}@example.com`, password: 'password123', jobMajor: '개발', jobMinor: '백엔드', experienceBand: '1~3년' }
  const reviewer = { email: `queue-reviewer-${stamp}@example.com`, password: 'password123', jobMajor: '개발', jobMinor: '백엔드', experienceBand: '1~3년' }
  const mismatchedReviewer = { email: `queue-mismatch-${stamp}@example.com`, password: 'password123', jobMajor: '디자인', jobMinor: 'UX·UI', experienceBand: '신입' }

  let submitterId = ''
  let submitterCookie = ''
  let reviewerCookie = ''
  let mismatchedCookie = ''
  let firstSubmissionId = ''
  let secondSubmissionId = ''

  it('setup: 제출자 1명, 평가자 2명(태그 일치/불일치) 생성 + 제출물 2건 등록', async () => {
    const submitterSignup = await signupTestUser(submitter)
    submitterId = submitterSignup.user.id
    submitterCookie = submitterSignup.cookie
    await prisma.user.update({ where: { id: submitterId }, data: { creditBalance: 20 } })

    reviewerCookie = (await signupTestUser(reviewer)).cookie
    mismatchedCookie = (await signupTestUser(mismatchedReviewer)).cookie

    firstSubmissionId = await createSubmission(submitterCookie, 'first')
    await new Promise(resolve => setTimeout(resolve, 10))
    secondSubmissionId = await createSubmission(submitterCookie, 'second')
  })

  it('POST /api/queue/claim — FIFO: 가장 먼저 등록된 제출물을 반환', async () => {
    const res = await json('/api/queue/claim', { method: 'POST', cookie: reviewerCookie })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.submission.id).toBe(firstSubmissionId)
    expect(body.submission.bodyText).toBeDefined()
  })

  it('POST /api/queue/claim — 같은 평가자는 다음 순번(second)을 반환', async () => {
    const res = await json('/api/queue/claim', { method: 'POST', cookie: reviewerCookie })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.submission.id).toBe(secondSubmissionId)
  })

  it('POST /api/queue/claim — 이미 둘 다 클레임했으면 QUEUE_EMPTY', async () => {
    const res = await json('/api/queue/claim', { method: 'POST', cookie: reviewerCookie })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('QUEUE_EMPTY')
  })

  it('POST /api/queue/claim — 본인 제출물은 클레임할 수 없음', async () => {
    const res = await json('/api/queue/claim', { method: 'POST', cookie: submitterCookie })
    expect(res.status).toBe(404)
  })

  it('POST /api/queue/claim — 태그가 다르면 인접 폴백 없이 QUEUE_EMPTY', async () => {
    const res = await json('/api/queue/claim', { method: 'POST', cookie: mismatchedCookie })
    expect(res.status).toBe(404)
  })

  it('GET /api/queue/current-claim — 가장 최근 클레임을 반환', async () => {
    const res = await json('/api/queue/current-claim', { cookie: reviewerCookie })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.claim.submissionId).toBe(secondSubmissionId)
    expect(body.claim.status).toBe('claimed')
  })

  it('GET /api/queue/current-claim — 클레임 이력이 없으면 null', async () => {
    const res = await json('/api/queue/current-claim', { cookie: mismatchedCookie })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.claim).toBeNull()
  })

  it('cleanup', async () => {
    const emails = [submitter.email, reviewer.email, mismatchedReviewer.email]
    const users = await prisma.user.findMany({ where: { email: { in: emails } } })
    const userIds = users.map(u => u.id)
    const submissions = await prisma.submission.findMany({ where: { userId: { in: userIds } } })
    const submissionIds = submissions.map(s => s.id)
    await prisma.review.deleteMany({ where: { submissionId: { in: submissionIds } } })
    await prisma.queueClaim.deleteMany({ where: { submissionId: { in: submissionIds } } })
    await prisma.priorityPass.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.creditLedgerEntry.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.submission.deleteMany({ where: { id: { in: submissionIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  })
})
