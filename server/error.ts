import { defineNitroErrorHandler } from 'nitropack/runtime'
import { send, setResponseHeader, setResponseStatus } from 'h3'

/**
 * docs/api-spec.md 공통 에러 응답 형식을 모든 서버 라우트에 강제한다.
 * server/utils/errors.ts의 apiError()가 실어 보낸 data.code/message를 그대로 내려준다.
 */
const FALLBACK_BY_STATUS: Record<number, { code: string, message: string }> = {
  400: { code: 'BAD_REQUEST', message: '요청 값이 올바르지 않습니다.' },
  401: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
  403: { code: 'FORBIDDEN', message: '접근 권한이 없습니다.' },
  404: { code: 'NOT_FOUND', message: '리소스를 찾을 수 없습니다.' },
  409: { code: 'CONFLICT', message: '요청이 현재 상태와 충돌합니다.' },
  422: { code: 'UNPROCESSABLE_ENTITY', message: '처리할 수 없는 요청입니다.' }
}

export default defineNitroErrorHandler((error, event) => {
  const statusCode = error.statusCode || 500
  const data = error.data as { code?: string, message?: string } | undefined
  const fallback = FALLBACK_BY_STATUS[statusCode]
  const code = data?.code ?? fallback?.code ?? 'INTERNAL_ERROR'
  const message = data?.message ?? fallback?.message ?? '알 수 없는 오류가 발생했습니다.'

  if (statusCode >= 500) {
    console.error(`[api-error] ${event.path} ${code}: ${error.message}`, error.stack)
  }

  setResponseStatus(event, statusCode)
  setResponseHeader(event, 'Content-Type', 'application/json')
  return send(event, JSON.stringify({ error: { code, message } }))
})
