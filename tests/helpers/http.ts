import { fetch, url } from '@nuxt/test-utils/e2e'

export function json(path: string, options: { method?: string, body?: unknown, cookie?: string } = {}) {
  return fetch(url(path), {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.cookie ? { cookie: options.cookie } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  })
}

interface SignupInput {
  email: string
  password: string
  jobMajor: string
  jobMinor: string
  experienceBand: string
}

/** 테스트용 계정을 가입시키고 세션 쿠키를 돌려준다. */
export async function signupTestUser(input: SignupInput) {
  const res = await json('/api/auth/signup', { method: 'POST', body: input })
  if (res.status !== 201) {
    throw new Error(`signupTestUser 실패: ${res.status} ${await res.text()}`)
  }
  const body = await res.json()
  const cookie = res.headers.getSetCookie()[0] ?? ''
  return { user: body.user as { id: string, email: string, creditBalance: number }, cookie }
}
