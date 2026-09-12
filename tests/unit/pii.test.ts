import { describe, expect, it } from 'vitest'
import { detectPiiWarnings } from '../../server/utils/pii'

describe('detectPiiWarnings', () => {
  it('이메일, 전화번호, URL을 각각 감지한다', () => {
    const text = '연락처는 test@example.com 이고 010-1234-5678로도 받습니다. https://example.com/portfolio 참고.'
    const warnings = detectPiiWarnings(text)

    expect(warnings.map(w => w.type)).toEqual(['email', 'phone', 'url'])
    expect(warnings[0].match).toBe('test@example.com')
    expect(warnings[1].match).toBe('010-1234-5678')
    expect(warnings[2].match).toBe('https://example.com/portfolio')
  })

  it('PII가 없으면 빈 배열을 반환한다', () => {
    expect(detectPiiWarnings('평범한 자소서 본문입니다.')).toEqual([])
  })

  it('offset 기준으로 정렬한다', () => {
    const text = '010-1234-5678 그리고 test@example.com'
    const warnings = detectPiiWarnings(text)
    expect(warnings[0].type).toBe('phone')
    expect(warnings[1].type).toBe('email')
    expect(warnings[0].offset).toBeLessThan(warnings[1].offset)
  })
})
