import { describe, expect, it } from 'vitest'
import { setup, fetch, url } from '@nuxt/test-utils/e2e'
import { prisma } from '../../server/utils/prisma'

function json(path: string, options: { method?: string, body?: unknown, cookie?: string } = {}) {
  return fetch(url(path), {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.cookie ? { cookie: options.cookie } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  })
}

describe('인증 API (docs/api-spec.md 인증 섹션)', async () => {
  await setup({ server: true })

  const email = `auth-e2e-${Date.now()}@example.com`
  const password = 'password123'
  let sessionCookie = ''

  it('POST /api/auth/signup — 가입 즉시 크레딧 5점 지급', async () => {
    const res = await json('/api/auth/signup', {
      method: 'POST',
      body: { email, password, jobMajor: '개발', jobMinor: '백엔드', experienceBand: '1~3년' }
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.user.creditBalance).toBe(5)
    sessionCookie = res.headers.getSetCookie()[0] ?? ''
    expect(sessionCookie).toContain('nuxt-session')
  })

  it('POST /api/auth/signup — 중복 이메일은 409', async () => {
    const res = await json('/api/auth/signup', {
      method: 'POST',
      body: { email, password, jobMajor: '개발', jobMinor: '백엔드', experienceBand: '1~3년' }
    })
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('DUPLICATE_EMAIL')
  })

  it('POST /api/auth/signup — jobMinor가 jobMajor 소속이 아니면 400', async () => {
    const res = await json('/api/auth/signup', {
      method: 'POST',
      body: {
        email: `mismatch-${Date.now()}@example.com`,
        password,
        jobMajor: '개발',
        jobMinor: '채용',
        experienceBand: '신입'
      }
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('JOB_MINOR_MISMATCH')
  })

  it('GET /api/users/me — 세션 쿠키 없으면 401', async () => {
    const res = await json('/api/users/me')
    expect(res.status).toBe(401)
  })

  it('GET /api/users/me — 세션 쿠키가 있으면 프로필 반환', async () => {
    const res = await json('/api/users/me', { cookie: sessionCookie })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.email).toBe(email)
  })

  it('POST /api/auth/logout — 세션 쿠키를 만료시킨다', async () => {
    // 세션은 서버 상태가 없는 sealed cookie이므로, 로그아웃은 "클라이언트에게 쿠키 삭제를
    // 지시"하는 것이지 이미 발급된 쿠키 값 자체를 서버에서 무효화하지 않는다. 따라서 여기서는
    // 만료 지시(Set-Cookie의 Max-Age=0)가 오는지만 검증한다.
    const logoutRes = await json('/api/auth/logout', { method: 'POST', cookie: sessionCookie })
    expect(logoutRes.status).toBe(204)
    expect(logoutRes.headers.getSetCookie()[0] ?? '').toMatch(/^nuxt-session=;/)
  })

  it('POST /api/auth/login — 잘못된 비밀번호는 401', async () => {
    const res = await json('/api/auth/login', { method: 'POST', body: { email, password: 'wrong-password' } })
    expect(res.status).toBe(401)
  })

  it('POST /api/auth/login — 올바른 자격증명은 200', async () => {
    const res = await json('/api/auth/login', { method: 'POST', body: { email, password } })
    expect(res.status).toBe(200)
  })

  it('cleanup', async () => {
    const user = await prisma.user.findUnique({ where: { email } })
    if (user) {
      await prisma.creditLedgerEntry.deleteMany({ where: { userId: user.id } })
      await prisma.user.delete({ where: { id: user.id } })
    }
  })
})
