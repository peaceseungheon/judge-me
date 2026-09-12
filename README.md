# 재판정 / Judge Me

품앗이 크레딧 구조 기반 자소서 크라우드 심사 플랫폼. 제품 요구사항은
[`docs/PRD.md`](docs/PRD.md), API 명세는 [`docs/api-spec.md`](docs/api-spec.md),
데이터 모델은 [`docs/data-model.md`](docs/data-model.md)를 참고한다.

작업 전 [`AGENTS.md`](AGENTS.md)와 [`docs/guidelines/stack/typescript.md`](docs/guidelines/stack/typescript.md)를 먼저 읽는다.

## 개발 환경 준비

1. Node.js `.nvmrc`에 명시된 버전 이상 설치
2. `.env.example`을 복사해 `.env` 생성, `NUXT_SESSION_PASSWORD`를 임의의 32자 이상 문자열로 교체
3. 로컬 PostgreSQL 실행: `docker compose up -d db` (호스트 포트 5433)
4. 의존성 설치 및 마이그레이션 적용:
   ```bash
   npm install
   npx prisma migrate dev
   ```

## 실행

```bash
npm run dev       # 개발 서버 (http://localhost:3000)
npm run build     # 프로덕션 빌드
npm run lint      # ESLint
npm run test      # Vitest (로컬 DB 필요)
```
