import { createError } from 'h3'

/**
 * docs/api-spec.md 공통 에러 응답 { error: { code, message } } 형식을 강제하기 위한 헬퍼.
 * 실제 직렬화는 server/error.ts(Nitro errorHandler)에서 처리한다.
 */
export function apiError(statusCode: number, code: string, message: string): never {
  throw createError({ statusCode, data: { code, message } })
}
