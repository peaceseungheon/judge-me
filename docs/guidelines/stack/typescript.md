# TypeScript (Nuxt.js) 스택 지침

이 문서는 PRD(`docs/PRD.md` §1)에서 확정된 스택 결정을 반영한다. 이 저장소의 웹 서비스 코드(프론트엔드·서버 API·DB 접근 계층) 전체가 이 지침의 적용 대상이다.

## 개요

Nuxt.js(Vue 3) 기반 풀스택 웹 애플리케이션. 별도 백엔드 서버 없이 Nuxt의 Nitro 서버 엔진(`server/api/`)으로 REST API를 구현하고, 같은 프로젝트의 페이지에서 소비한다. 데이터베이스는 관리형 PostgreSQL, 배포는 관리형 PaaS를 사용한다.

## 버전·도구체인

- 런타임: Node.js 22 LTS (`.nvmrc`로 고정)
- 패키지 매니저: npm (저장소 기본, `package-lock.json` 커밋)
- 프레임워크: Nuxt 3 (최신 stable), Vue 3, TypeScript strict 모드
- ORM: Prisma — `docs/data-model.md`의 enum·제약을 TypeScript 타입과 마이그레이션으로 그대로 매핑할 수 있어 채택. CHECK 제약처럼 Prisma DSL이 표현하지 못하는 항목은 생성된 마이그레이션 SQL을 수정해 보완한다.
- 인증: 세션 쿠키(HttpOnly, sealed cookie) — `nuxt-auth-utils` 사용. `docs/api-spec.md` Open Question #3(세션 쿠키 vs JWT)에 대한 구현 단계 결정이며, 모바일 앱이 없고 별도 API 소비자가 없는 현재 범위에서 JWT의 토큰 갱신·폐기 복잡도가 불필요하기 때문이다.

## 프로젝트 구조 규약

```
app/                      # 페이지, 컴포넌트, 레이아웃 (Nuxt app 디렉토리)
server/
  api/                    # REST 엔드포인트, api-spec.md의 경로와 1:1 대응
  utils/                  # 서버 전용 공유 유틸(세션, PII 검사, 에러 응답 등)
prisma/
  schema.prisma
  migrations/
tests/
  unit/                   # DB 불필요한 순수 로직 테스트
  integration/            # Prisma + 테스트 DB 필요한 테스트
```

- 신규 API 엔드포인트는 `server/api/<api-spec.md 경로>.ts`에 배치한다. 예: `POST /api/reviews` → `server/api/reviews.post.ts`.
- 여러 엔드포인트가 공유하는 로직(크레딧 원장 기록, 완결성 검증 등)은 `server/utils/`에 함수로 추출하고 각 핸들러에서 호출한다.

## 네이밍 표기 규칙

- 파일: kebab-case (`queue-claim.ts`), Nuxt 라우팅 파일은 Nuxt 컨벤션(`[id].get.ts`)을 그대로 따른다.
- 타입·인터페이스: PascalCase (`PiiWarning`), enum도 PascalCase.
- 함수·변수: camelCase.
- 상수: UPPER_SNAKE_CASE (모듈 스코프 상수에 한함).
- DB 컬럼: `docs/data-model.md`대로 snake_case 유지. Prisma 필드는 camelCase로 선언하고 `@map("snake_case_name")`으로 매핑한다.

## 포맷·린트 도구와 설정

- ESLint: `@nuxt/eslint` 모듈 기본 설정 사용. 설정 파일 `eslint.config.mjs`.
- 포맷터는 별도 도입하지 않고 ESLint의 스타일 규칙에 위임한다(도구 중복 방지).
- 실행: `npm run lint`

## 테스트 프레임워크와 실행 명령

- 프레임워크: Vitest (`@nuxt/test-utils` 연동).
- 파일 위치: 대상 파일과 같은 디렉토리에 `*.test.ts`, 또는 `tests/` 아래 대응 경로.
- 전체 실행: `npm run test`
- 단일 파일 실행: `npm run test -- <파일 경로>`
- DB가 필요한 통합 테스트는 로컬 Docker Postgres(`docker compose up -d db`)를 전제로 하며, DB 없이는 스킵한다.

## 빌드·실행 명령

- 개발 서버: `npm run dev` (사전 조건: `.env`의 `DATABASE_URL` 설정, `npx prisma migrate dev` 1회 실행)
- 빌드: `npm run build`
- 프로덕션 실행: `npm run preview` (로컬 검증용), 실제 배포는 관리형 PaaS의 빌드 파이프라인에 위임.
- DB 마이그레이션 적용: `npx prisma migrate deploy`

## 의존성 관리 규칙

- 새 의존성 추가 전 반드시 표준 라이브러리·Nuxt 내장 기능·이미 설치된 패키지로 해결 가능한지 먼저 검토한다.
- 의존성 추가는 `package.json`에 정확한 버전 범위를 명시하고, 추가 사유를 해당 PR 설명에 남긴다.
- 사용하지 않게 된 의존성은 발견 즉시 제거한다.

## 언어 특화 안티패턴

- Prisma 클라이언트를 요청마다 `new PrismaClient()`로 생성하지 않는다 — `server/utils/prisma.ts`의 싱글턴을 재사용한다(연결 풀 고갈 방지).
- 크레딧 잔액 갱신을 `SELECT` 후 애플리케이션 계산으로 처리하지 않는다 — 반드시 `$transaction` 내 `SELECT ... FOR UPDATE` 또는 원자적 `UPDATE ... SET balance = balance + delta`로 처리한다(`docs/data-model.md` 트랜잭션 무결성 요약 참조).
- 큐 클레임을 애플리케이션 레벨 락(뮤텍스, 인메모리 큐)으로 처리하지 않는다 — `FOR UPDATE SKIP LOCKED` 원자적 쿼리만 사용한다.
- `any` 타입으로 API 요청 바디를 받지 않는다 — zod 등으로 파싱·검증한 뒤 타입을 좁힌다.
