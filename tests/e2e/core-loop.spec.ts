import 'dotenv/config'
import { expect, request, test } from '@playwright/test'
import { prisma } from '../../server/utils/prisma'

const TAGS = { jobMajor: '개발', jobMinor: '백엔드', experienceBand: '1~3년' }
const EMPTY_QUEUE_TAGS = { jobMajor: 'HR', jobMinor: '채용', experienceBand: '8년+' }
const VALID_COMMENT = '구체적인 사례와 숫자를 바탕으로 강점과 보완점을 균형 있게 짚었습니다. 다음 수정 방향도 실행 가능하게 제안합니다.'

async function cleanupEmails(emails: string[]) {
  const users = await prisma.user.findMany({ where: { email: { in: emails } } })
  const userIds = users.map(user => user.id)
  if (userIds.length === 0) return

  const submissions = await prisma.submission.findMany({ where: { userId: { in: userIds } } })
  const submissionIds = submissions.map(submission => submission.id)

  await prisma.trustChecklistResponse.deleteMany({
    where: { OR: [{ submitterId: { in: userIds } }, { submissionId: { in: submissionIds } }] }
  })
  await prisma.review.deleteMany({
    where: { OR: [{ reviewerId: { in: userIds } }, { submissionId: { in: submissionIds } }] }
  })
  await prisma.queueClaim.deleteMany({
    where: { OR: [{ reviewerId: { in: userIds } }, { submissionId: { in: submissionIds } }] }
  })
  await prisma.priorityPass.deleteMany({
    where: { OR: [{ userId: { in: userIds } }, { submissionId: { in: submissionIds } }] }
  })
  await prisma.creditLedgerEntry.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.submission.deleteMany({ where: { id: { in: submissionIds } } })
  await prisma.user.deleteMany({ where: { id: { in: userIds } } })
}

async function chooseOption(page: import('@playwright/test').Page, label: string, option: string) {
  const optionLocator = page.getByRole('option', { name: option, exact: true })

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const combobox = page.getByRole('combobox', { name: label })
    await combobox.press('Space')
    try {
      await optionLocator.waitFor({ state: 'visible', timeout: 1_500 })
      await optionLocator.click()
      await expect(page.getByRole('combobox', { name: label })).toHaveText(option)
      return
    } catch {
      await page.keyboard.press('Escape')
    }
    await page.waitForTimeout(250)
  }

  throw new Error(`${label}의 ${option} 선택지를 열 수 없습니다.`)
}

async function signupAndOpenDashboard(page: import('@playwright/test').Page, email: string, tags = TAGS) {
  const response = await page.request.post('/api/auth/signup', {
    data: { email, password: 'password123', ...tags }
  })
  expect(response.status(), await response.text()).toBe(201)
  await page.goto('/me')
  await expect(page.getByRole('heading', { name: '내 평가 흐름' })).toBeVisible()
}

async function logout(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '로그아웃' }).click()
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible()
}

test.afterAll(async () => {
  await prisma.$disconnect()
})

test('가입→등록→타 계정 클레임→평가 제출→진행률 1/3 확인', async ({ page }) => {
  const stamp = Date.now()
  const submitterEmail = `pw-submitter-${stamp}@example.com`
  const reviewerEmail = `pw-reviewer-${stamp}@example.com`

  await cleanupEmails([submitterEmail, reviewerEmail])

  try {
    await signupAndOpenDashboard(page, submitterEmail)

    await page.goto('/submissions/new')
    await expect(page.getByRole('heading', { name: '자소서 등록' })).toBeVisible()
    await chooseOption(page, '직군 대분류', TAGS.jobMajor)
    await chooseOption(page, '직군 소분류', TAGS.jobMinor)
    await chooseOption(page, '경력', TAGS.experienceBand)
    await page.getByLabel('제목').fill('Playwright 핵심 루프 자소서')
    await page.getByLabel('자소서 본문').fill('지원 동기와 프로젝트 경험을 구체적인 수치와 함께 설명한 자소서 본문입니다.')
    await page.getByRole('button', { name: '등록하기' }).click()
    await expect(page.getByRole('heading', { name: '내 평가 흐름' })).toBeVisible()
    await expect(page.getByText('Playwright 핵심 루프 자소서')).toBeVisible()
    await expect(page.getByText('0/3')).toBeVisible()

    await logout(page)
    await signupAndOpenDashboard(page, reviewerEmail)

    await page.goto('/queue')
    await expect(page.getByRole('heading', { name: '평가하기' })).toBeVisible()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: '평가 시작' }).click()
    await expect(page.getByRole('heading', { name: 'Playwright 핵심 루프 자소서' })).toBeVisible()
    await page.getByLabel('코멘트 (50자 이상)').fill(VALID_COMMENT)
    await page.getByRole('button', { name: '평가 제출' }).click()
    await expect(page.getByRole('heading', { name: '내 평가 흐름' })).toBeVisible()

    await logout(page)
    await page.context().clearCookies()
    const loginResponse = await page.request.post('/api/auth/login', {
      data: { email: submitterEmail, password: 'password123' }
    })
    expect(loginResponse.status()).toBe(200)
    for (const endpoint of ['/api/users/me', '/api/submissions/mine', '/api/reviews/mine']) {
      const response = await page.request.get(endpoint)
      expect(response.status(), `${endpoint}: ${await response.text()}`).toBe(200)
    }
    await page.goto('/me')
    await expect(page.getByRole('heading', { name: '내 평가 흐름' })).toBeVisible()
    await expect(page.getByText('Playwright 핵심 루프 자소서')).toBeVisible()
    await expect(page.getByText('1/3')).toBeVisible()
    await expect(page.getByText('1명 평가 완료')).toBeVisible()
  } finally {
    await cleanupEmails([submitterEmail, reviewerEmail])
  }
})

test('empty 빈 상태: 평가 큐가 비었을 때 안내를 표시한다', async ({ page }) => {
  const email = `pw-empty-${Date.now()}@example.com`

  await cleanupEmails([email])

  try {
    await signupAndOpenDashboard(page, email, EMPTY_QUEUE_TAGS)
    await page.route('**/api/queue/claim', async route => route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'QUEUE_EMPTY', message: '일치하는 제출물이 없습니다.' } })
    }))

    await page.goto('/queue')
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: '평가 시작' }).click()
    await expect(page.getByText('현재 평가 대기 중인 자소서가 없습니다. 잠시 후 다시 시도해 주세요.')).toBeVisible()
  } finally {
    await cleanupEmails([email])
  }
})

test('error 에러: 크레딧 부족으로 자소서 등록 실패 메시지를 표시한다', async ({ page, baseURL }) => {
  const email = `pw-credit-error-${Date.now()}@example.com`
  const api = await request.newContext({ baseURL })

  await cleanupEmails([email])

  try {
    const signupRes = await api.post('/api/auth/signup', {
      data: { email, password: 'password123', ...TAGS }
    })
    expect(signupRes.status()).toBe(201)
    await prisma.user.update({ where: { email }, data: { creditBalance: 0 } })

    const loginResponse = await page.request.post('/api/auth/login', {
      data: { email, password: 'password123' }
    })
    expect(loginResponse.status()).toBe(200)
    await page.goto('/me')
    await expect(page.getByRole('heading', { name: '내 평가 흐름' })).toBeVisible()

    await page.goto('/submissions/new')
    await chooseOption(page, '직군 대분류', TAGS.jobMajor)
    await chooseOption(page, '직군 소분류', TAGS.jobMinor)
    await chooseOption(page, '경력', TAGS.experienceBand)
    await page.getByLabel('제목').fill('크레딧 부족 검증 자소서')
    await page.getByLabel('자소서 본문').fill('크레딧이 부족한 계정의 등록 실패 UI를 확인하기 위한 본문입니다.')
    await page.getByRole('button', { name: '등록하기' }).click()
    await expect(page.getByText('크레딧 잔액이 부족합니다. 평가를 완료하면 크레딧이 적립됩니다.')).toBeVisible()
  } finally {
    await api.dispose()
    await cleanupEmails([email])
  }
})
