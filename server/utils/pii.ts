export interface PiiWarning {
  type: 'email' | 'phone' | 'url'
  match: string
  offset: number
}

/**
 * docs/api-spec.md PII 처리 방침: 이메일·전화번호·URL 등 고신뢰도 정규식 패턴에
 * 한정한 비차단 경고. 마스킹은 하지 않고 감지된 위치만 알려준다.
 */
const PATTERNS: { type: PiiWarning['type'], regex: RegExp }[] = [
  { type: 'url', regex: /https?:\/\/[^\s]+/g },
  { type: 'email', regex: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  { type: 'phone', regex: /01[016789]-?\d{3,4}-?\d{4}|0[2-9]\d?-?\d{3,4}-?\d{4}/g }
]

export function detectPiiWarnings(text: string): PiiWarning[] {
  const warnings: PiiWarning[] = []

  for (const { type, regex } of PATTERNS) {
    for (const match of text.matchAll(regex)) {
      warnings.push({ type, match: match[0], offset: match.index ?? 0 })
    }
  }

  return warnings.sort((a, b) => a.offset - b.offset)
}
