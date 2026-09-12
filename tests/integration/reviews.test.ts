import { describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { prisma } from '../../server/utils/prisma'
import { json, signupTestUser } from '../helpers/http'

const TAGS = { jobMajor: '개발', jobMinor: '백엔드', experienceBand: '1~3년' }
const VALID_COMMENT = '구체적인 사례와 숫자를 잘 짚어주셔서 큰 도움이 되었습니다. 실행 가능한 대안도 제시해주셨어요.'

async function createSubmission(cookie: string, title: string) {
  const res = await json('/api/submissions', {
    method: 'POST',
    cookie,
    body: { title, bodyText: 'b', lane: 'general', ...TAGS }
  })
  const body = await res.json()
  return body.submission.id as string
}

async function claim(cookie: string) {
  const res = await json('/api/queue/claim', { method: 'POST', cookie })
  const body = await res.json()
  return body.claim.id as string
}

describe('평가 및 신뢰점수 체크리스트 API', async () => {
  await setup({ server: true })

  const stamp = Date.now()
  const submitter = { email: `rev-submitter-${stamp}@example.com`, password: 'password123', ...TAGS }
  const reviewer = { email: `rev-reviewer-${stamp}@example.com`, password: 'password123', ...TAGS }
  const stranger = { email: `rev-stranger-${stamp}@example.com`, password: 'password123', ...TAGS }

  let submitterId = ''
  let submitterCookie = ''
  let reviewerId = ''
  let reviewerCookie = ''
  let strangerCookie = ''
  let submissionId = ''
  let claimId = ''
  let reviewId = ''

  it('setup: 계정 생성 및 크레딧 보강', async () => {
    const s = await signupTestUser(submitter)
    submitterId = s.user.id
    submitterCookie = s.cookie
    await prisma.user.update({ where: { id: submitterId }, data: { creditBalance: 20 } })

    const r = await signupTestUser(reviewer)
    reviewerId = r.user.id
    reviewerCookie = r.cookie

    strangerCookie = (await signupTestUser(stranger)).cookie

    submissionId = await createSubmission(submitterCookie, '리뷰 대상')
    claimId = await claim(reviewerCookie)
  })

  it('POST /api/reviews — 코멘트 50자 미만이면 422', async () => {
    const res = await json('/api/reviews', {
      method: 'POST',
      cookie: reviewerCookie,
      body: { queueClaimId: claimId, scoreRelevance: 5, scoreLogic: 5, scoreSpecificity: 5, scoreReadability: 5, comment: '짧음' }
    })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('COMPLETENESS_FAILED')
  })

  it('POST /api/reviews — 유효한 클레임이 아니면 404', async () => {
    const res = await json('/api/reviews', {
      method: 'POST',
      cookie: strangerCookie,
      body: { queueClaimId: claimId, scoreRelevance: 5, scoreLogic: 5, scoreSpecificity: 5, scoreReadability: 5, comment: VALID_COMMENT }
    })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('CLAIM_NOT_FOUND')
  })

  it('POST /api/reviews — 완결성 통과 시 크레딧 +1 즉시 지급', async () => {
    const res = await json('/api/reviews', {
      method: 'POST',
      cookie: reviewerCookie,
      body: { queueClaimId: claimId, scoreRelevance: 5, scoreLogic: 4, scoreSpecificity: 4, scoreReadability: 5, comment: VALID_COMMENT }
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.creditBalance).toBe(6) // 가입 5 + 평가 1
    reviewId = body.review.id
  })

  it('제출물 reviewerCount가 1로 증가한다', async () => {
    const res = await json(`/api/submissions/${submissionId}/progress`, { cookie: submitterCookie })
    const body = await res.json()
    expect(body.reviewerCount).toBe(1)
    expect(body.status).toBe('open')
  })

  it('POST /api/reviews — 같은 클레임에 다시 제출하면 409', async () => {
    const res = await json('/api/reviews', {
      method: 'POST',
      cookie: reviewerCookie,
      body: { queueClaimId: claimId, scoreRelevance: 5, scoreLogic: 4, scoreSpecificity: 4, scoreReadability: 5, comment: VALID_COMMENT }
    })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('REVIEW_ALREADY_EXISTS')
  })

  it('GET /api/reviews/mine — 방금 제출한 평가를 포함', async () => {
    const res = await json('/api/reviews/mine', { cookie: reviewerCookie })
    const body = await res.json()
    expect(body.total).toBe(1)
    expect(body.reviews[0].id).toBe(reviewId)
    expect(body.reviews[0].submissionId).toBe(submissionId)
  })

  it('POST /api/trust-checklist — 제출자가 아니면 403', async () => {
    const res = await json('/api/trust-checklist', {
      method: 'POST',
      cookie: strangerCookie,
      body: { reviewId, usedSpecifics: true, newPerspective: true, actionableAlternatives: false }
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_SUBMITTER')
  })

  it('POST /api/trust-checklist — 제출자가 응답하면 평가자 trust_score가 재계산된다', async () => {
    const res = await json('/api/trust-checklist', {
      method: 'POST',
      cookie: submitterCookie,
      body: { reviewId, usedSpecifics: true, newPerspective: true, actionableAlternatives: false }
    })
    expect(res.status).toBe(201)

    const reviewerUser = await prisma.user.findUniqueOrThrow({ where: { id: reviewerId } })
    expect(Number(reviewerUser.trustScore)).toBeCloseTo(66.67, 2) // 2/3 '예'
  })

  it('POST /api/trust-checklist — 같은 리뷰에 다시 응답하면 409', async () => {
    const res = await json('/api/trust-checklist', {
      method: 'POST',
      cookie: submitterCookie,
      body: { reviewId, usedSpecifics: true, newPerspective: true, actionableAlternatives: false }
    })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('ALREADY_RESPONDED')
  })

  it('GET /api/submissions/:id — 소유자에게 trustChecklistResponse가 중첩되어 보인다', async () => {
    const res = await json(`/api/submissions/${submissionId}`, { cookie: submitterCookie })
    const body = await res.json()
    expect(body.reviews[0].trustChecklistResponse).toEqual({
      usedSpecifics: true,
      newPerspective: true,
      actionableAlternatives: false
    })
  })

  it('3인이 모두 평가하면 제출물이 closed로 전환된다', async () => {
    // 이 파일의 다른 테스트가 TAGS 조합으로 아직 open 상태인 제출물을 큐에 남겨두므로,
    // FIFO 큐가 그 제출물을 먼저 반환하지 않도록 별도 태그 조합으로 완전히 격리한다.
    const CLOSE_TAGS = { jobMajor: '개발', jobMinor: '프론트엔드', experienceBand: '4~7년' } as const
    const closingRes = await json('/api/submissions', {
      method: 'POST',
      cookie: submitterCookie,
      body: { title: '3인 완료 테스트', bodyText: 'b', lane: 'general', ...CLOSE_TAGS }
    })
    const closingSubmission = (await closingRes.json()).submission.id as string

    for (let i = 0; i < 3; i++) {
      const r = await signupTestUser({ email: `rev-closer-${stamp}-${i}@example.com`, password: 'password123', ...CLOSE_TAGS })
      const claimRes = await json('/api/queue/claim', { method: 'POST', cookie: r.cookie })
      const claimBody = await claimRes.json()
      expect(claimBody.submission.id).toBe(closingSubmission)

      const reviewRes = await json('/api/reviews', {
        method: 'POST',
        cookie: r.cookie,
        body: { queueClaimId: claimBody.claim.id, scoreRelevance: 5, scoreLogic: 5, scoreSpecificity: 5, scoreReadability: 5, comment: VALID_COMMENT }
      })
      expect(reviewRes.status).toBe(201)
    }

    const progressRes = await json(`/api/submissions/${closingSubmission}/progress`, { cookie: submitterCookie })
    const progressBody = await progressRes.json()
    expect(progressBody.reviewerCount).toBe(3)
    expect(progressBody.status).toBe('closed')
  })

  it('cleanup', async () => {
    const emails = [
      submitter.email,
      reviewer.email,
      stranger.email,
      ...[0, 1, 2].map(i => `rev-closer-${stamp}-${i}@example.com`)
    ]
    const users = await prisma.user.findMany({ where: { email: { in: emails } } })
    const userIds = users.map(u => u.id)
    const submissions = await prisma.submission.findMany({ where: { userId: { in: userIds } } })
    const submissionIds = submissions.map(s => s.id)
    await prisma.trustChecklistResponse.deleteMany({ where: { submissionId: { in: submissionIds } } })
    await prisma.review.deleteMany({ where: { submissionId: { in: submissionIds } } })
    await prisma.queueClaim.deleteMany({ where: { submissionId: { in: submissionIds } } })
    await prisma.priorityPass.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.creditLedgerEntry.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.submission.deleteMany({ where: { id: { in: submissionIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  })
})
