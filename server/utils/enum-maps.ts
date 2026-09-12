import { z } from 'zod'
import {
  JobMajor as PrismaJobMajor,
  JobMinor as PrismaJobMinor,
  ExperienceBand as PrismaExperienceBand
} from '../../generated/prisma/enums'
import { apiError } from './errors'

/**
 * docs/api-spec.md / docs/data-model.md의 enum은 한글 리터럴이 와이어 포맷이다.
 * Prisma 스키마의 enum 멤버는 식별자 제약(공백·"·" 등 불허) 때문에 영문 식별자를
 * 쓰고 @map으로 DB 값을 한글로 매핑했다 — 이 파일은 그 사이 변환을 전담한다.
 */
function defineEnumMap<const Pairs extends readonly (readonly [string, string])[]>(pairs: Pairs) {
  type Wire = Pairs[number][0]
  type Prisma = Pairs[number][1]

  const toPrismaMap = new Map(pairs) as Map<Wire, Prisma>
  const fromPrismaMap = new Map(pairs.map(([wire, prisma]) => [prisma, wire])) as Map<Prisma, Wire>
  const wireValues = pairs.map(([wire]) => wire) as [Wire, ...Wire[]]

  return {
    zodEnum: z.enum(wireValues),
    toPrisma(wire: Wire): Prisma {
      const value = toPrismaMap.get(wire)
      if (value === undefined) apiError(400, 'INVALID_ENUM_VALUE', `알 수 없는 값입니다: ${wire}`)
      return value
    },
    fromPrisma(prisma: Prisma): Wire {
      const value = fromPrismaMap.get(prisma)
      if (value === undefined) throw new Error(`매핑되지 않은 Prisma enum 값: ${prisma}`)
      return value
    }
  }
}

export const jobMajorMap = defineEnumMap([
  ['개발', PrismaJobMajor.DEV],
  ['디자인', PrismaJobMajor.DESIGN],
  ['마케팅', PrismaJobMajor.MARKETING],
  ['기획', PrismaJobMajor.PLANNING],
  ['영업', PrismaJobMajor.SALES],
  ['HR', PrismaJobMajor.HR]
] as const)

export const jobMinorMap = defineEnumMap([
  ['프론트엔드', PrismaJobMinor.FRONTEND],
  ['백엔드', PrismaJobMinor.BACKEND],
  ['풀스택', PrismaJobMinor.FULLSTACK],
  ['모바일', PrismaJobMinor.MOBILE],
  ['데이터·AI', PrismaJobMinor.DATA_AI],
  ['DevOps·인프라', PrismaJobMinor.DEVOPS_INFRA],
  ['UX·UI', PrismaJobMinor.UX_UI],
  ['그래픽·브랜딩', PrismaJobMinor.GRAPHIC_BRAND],
  ['프로덕트 디자인', PrismaJobMinor.PRODUCT_DESIGN],
  ['퍼포먼스', PrismaJobMinor.PERFORMANCE],
  ['브랜드·콘텐츠', PrismaJobMinor.BRAND_CONTENT],
  ['그로스', PrismaJobMinor.GROWTH],
  ['프로덕트 기획', PrismaJobMinor.PRODUCT_PLAN],
  ['서비스 기획', PrismaJobMinor.SERVICE_PLAN],
  ['영업', PrismaJobMinor.SALES_MINOR],
  ['비즈니스 개발', PrismaJobMinor.BIZ_DEV],
  ['채용', PrismaJobMinor.RECRUITING],
  ['인사·조직문화', PrismaJobMinor.PEOPLE_CULTURE]
] as const)

export const experienceBandMap = defineEnumMap([
  ['신입', PrismaExperienceBand.ENTRY],
  ['1~3년', PrismaExperienceBand.YEARS_1_3],
  ['4~7년', PrismaExperienceBand.YEARS_4_7],
  ['8년+', PrismaExperienceBand.YEARS_8_UP]
] as const)

type WireJobMajor = z.infer<typeof jobMajorMap.zodEnum>
type WireJobMinor = z.infer<typeof jobMinorMap.zodEnum>

const JOB_MINORS_BY_MAJOR: Record<WireJobMajor, readonly WireJobMinor[]> = {
  개발: ['프론트엔드', '백엔드', '풀스택', '모바일', '데이터·AI', 'DevOps·인프라'],
  디자인: ['UX·UI', '그래픽·브랜딩', '프로덕트 디자인'],
  마케팅: ['퍼포먼스', '브랜드·콘텐츠', '그로스'],
  기획: ['프로덕트 기획', '서비스 기획'],
  영업: ['영업', '비즈니스 개발'],
  HR: ['채용', '인사·조직문화']
}

/** jobMinor가 jobMajor 소속인지 검증한다 (api-spec.md: "jobMinor는 jobMajor와 일치해야 함"). */
export function assertJobMinorMatchesMajor(jobMajor: WireJobMajor, jobMinor: WireJobMinor) {
  if (!JOB_MINORS_BY_MAJOR[jobMajor].includes(jobMinor)) {
    apiError(400, 'JOB_MINOR_MISMATCH', `${jobMinor}은(는) ${jobMajor} 소속 소분류가 아닙니다.`)
  }
}
