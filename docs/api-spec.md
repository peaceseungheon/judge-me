# 재판정 / Judge Me — API 스펙

> Nuxt.js (Vue 기반) + TypeScript 서버 라우트 기준 REST API 명세. 모든 요청/응답 본문은 JSON이며, 인증은 세션 쿠키(HttpOnly) 또는 Bearer 토큰 중 구현 단계에서 선택한다.

---

## 공통 규칙

### Base URL

```
/api
```

### 인증

인증이 필요한 엔드포인트는 `🔒` 표시. 미인증 요청 시 `401 Unauthorized`.

### 개인정보(PII) 처리 방침

- **마스킹 책임**: 자소서 본문의 식별정보(이름, 학교명, 회사명 등) 마스킹 책임은 작성자에게 있다.
- **시스템 보증 범위**: 시스템은 '완전 익명 보장' 표현을 사용하지 않는다.
- **PII 경고**: 이메일·전화번호·URL 등 고신뢰도 정규식 패턴에 한정해 비차단(non-blocking) 경고를 제출 응답에 포함한다. 자동 마스킹 및 NER 기반 검출은 MVP 범위 밖이다.
- **경고 형식**: 하단 `PiiWarning` 타입 정의 참조.

### 공통 에러 응답

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "사람이 읽을 수 있는 설명"
  }
}
```

| HTTP 상태 | 발생 조건 예시                        |
| ------- | -------------------------------- |
| 400     | 요청 바디 유효성 오류                     |
| 401     | 미인증                              |
| 403     | 권한 없음 (타인 리소스 접근 등)              |
| 404     | 리소스 없음                           |
| 409     | 충돌 (크레딧 부족, 중복 클레임, 활성 우선매칭권 한도) |
| 422     | 완결성 검증 실패 (평가 제출 시)              |

---

## 인증 (Auth)

### POST /api/auth/signup — 회원가입

가입 즉시 크레딧 5점 지급. `users.credit_balance = 5`, `credit_ledger_entries` (signup_bonus, +5) INSERT.

**요청 바디**

```typescript
{
  email: string;          // 이메일 형식
  password: string;       // 8자 이상
  jobMajor: JobMajor;     // enum: '개발'|'디자인'|'마케팅'|'기획'|'영업'|'HR'
  jobMinor: JobMinor;     // enum: 17개 소분류 중 1개 (jobMajor와 일치해야 함)
  experienceBand: ExperienceBand; // enum: '신입'|'1~3년'|'4~7년'|'8년+'
}
```

**응답 201**

```typescript
{
  user: {
    id: string;
    email: string;
    jobMajor: JobMajor;
    jobMinor: JobMinor;
    experienceBand: ExperienceBand;
    creditBalance: number; // 5
  }
}
```

**에러**
- `409 DUPLICATE_EMAIL`: 이미 등록된 이메일

---

### POST /api/auth/login — 로그인

**요청 바디**

```typescript
{
  email: string;
  password: string;
}
```

**응답 200**

```typescript
{
  user: {
    id: string;
    email: string;
    jobMajor: JobMajor;
    jobMinor: JobMinor;
    experienceBand: ExperienceBand;
    creditBalance: number;
  }
}
```

---

### POST /api/auth/logout 🔒

**응답 204** (본문 없음)

---

## 사용자 (Users)

### GET /api/users/me 🔒 — 내 프로필 및 크레딧 잔액

**응답 200**

```typescript
{
  id: string;
  email: string;
  jobMajor: JobMajor;
  jobMinor: JobMinor;
  experienceBand: ExperienceBand;
  creditBalance: number;
  trustScore: number;  // 0.00 ~ 100.00
  createdAt: string;   // ISO8601
}
```

---

## 자소서 제출물 (Submissions)

### POST /api/submissions 🔒 — 자소서 등록

크레딧 3점 차감. 잔액 부족 시 409. PII 경고는 비차단으로 응답 본문에 포함.

**요청 바디**

```typescript
{
  title: string;          // 제목
  bodyText: string;       // 본문 (1자 이상)
  jobMajor: JobMajor;
  jobMinor: JobMinor;
  experienceBand: ExperienceBand;
  lane: 'general' | 'priority'; // priority는 priority_pass 생성과 함께 처리
}
```

**응답 201**

```typescript
{
  submission: {
    id: string;
    title: string;
    jobMajor: JobMajor;
    jobMinor: JobMinor;
    experienceBand: ExperienceBand;
    lane: 'general' | 'priority';
    reviewerCount: number;  // 0
    status: 'open' | 'closed';
    createdAt: string;
  };
  creditBalance: number;  // 차감 후 잔액
  piiWarnings: PiiWarning[];  // 비차단 경고, 빈 배열이면 없음
}
```

```typescript
// PiiWarning
{
  type: 'email' | 'phone' | 'url';
  match: string;  // 감지된 패턴 (마스킹 안 함)
  offset: number; // 본문 내 위치
}
```

**에러**
- `409 INSUFFICIENT_CREDITS`: 크레딧 잔액 부족
- `409 PRIORITY_PASS_LIMIT`: priority 레인 선택 시 이미 활성 우선매칭권 1건 존재

---

### GET /api/submissions/mine 🔒 — 내 제출물 목록

**쿼리 파라미터**

```
status?: 'open' | 'closed'
page?: number  // 기본 1
limit?: number // 기본 20
```

**응답 200**

```typescript
{
  submissions: Array<{
    id: string;
    title: string;
    jobMajor: JobMajor;
    jobMinor: JobMinor;
    experienceBand: ExperienceBand;
    lane: 'general' | 'priority';
    reviewerCount: number;
    status: 'open' | 'closed';
    createdAt: string;
  }>;
  total: number;
  page: number;
  limit: number;
}
```

---

### GET /api/submissions/:id/progress 🔒 — 제출물 진행률 조회

본인 제출물의 3인 매칭 진행률을 조회한다. 평가자는 조회 불가.

**응답 200**

```typescript
{
  submissionId: string;
  reviewerCount: number;    // 완료된 평가 수 (0~3)
  targetCount: 3;           // 소프트 보장 목표 (고정)
  progressLabel: string;    // 예: "1/3 평가 완료"
  status: 'open' | 'closed';
}
```

**에러**
- `403 NOT_SUBMITTER`: 해당 제출물의 소유자가 아님

---

### GET /api/submissions/:id 🔒 — 제출물 상세

본인 제출물이거나 해당 제출물의 클레임 평가자만 조회 가능.

**응답 200**

```typescript
{
  id: string;
  title: string;
  bodyText: string;
  jobMajor: JobMajor;
  jobMinor: JobMinor;
  experienceBand: ExperienceBand;
  lane: 'general' | 'priority';
  reviewerCount: number;
  status: 'open' | 'closed';
  createdAt: string;
  // 본인 제출물일 때만 포함
  reviews?: Array<{
    id: string;
    scoreRelevance: number;
    scoreLogic: number;
    scoreSpecificity: number;
    scoreReadability: number;
    comment: string;
    submittedAt: string;
    trustChecklistResponse?: {
      usedSpecifics: boolean;
      newPerspective: boolean;
      actionableAlternatives: boolean;
    };
  }>;
}
```

---

## 평가 큐 (Queue)

### POST /api/queue/claim 🔒 — 다음 평가 대상 클레임

평가자의 직군·연차 태그와 일치하는 제출물 중 FIFO 순서로 1건을 원자적으로 점유. 평가자 본인 제출물 또는 이미 평가한 제출물은 제외.

`SELECT FOR UPDATE SKIP LOCKED` 기반으로 동시 클레임 충돌을 처리한다.

**요청 바디** (없음)

**응답 201**

```typescript
{
  claim: {
    id: string;
    submissionId: string;
    claimedAt: string;
  };
  submission: {
    id: string;
    title: string;
    bodyText: string;
    jobMajor: JobMajor;
    jobMinor: JobMinor;
    experienceBand: ExperienceBand;
  };
}
```

**에러**
- `404 QUEUE_EMPTY`: 일치하는 제출물 없음 (인접 태그 폴백 없이 빈 큐로 반환)

---

### GET /api/queue/current-claim 🔒 — 현재 클레임 확인

**응답 200**

```typescript
{
  claim: {
    id: string;
    submissionId: string;
    claimedAt: string;
    status: 'claimed' | 'reviewed';
  } | null;
}
```

---

## 평가 (Reviews)

### POST /api/reviews 🔒 — 평가 제출

완결성 검증(4축 전부 + 50자 이상 코멘트) 통과 시 즉시 크레딧 +1 지급. 단일 트랜잭션으로 처리.

**요청 바디**

```typescript
{
  queueClaimId: string;
  scoreRelevance: number;    // 1~5 (직무적합성)
  scoreLogic: number;        // 1~5 (논리구조)
  scoreSpecificity: number;  // 1~5 (구체성)
  scoreReadability: number;  // 1~5 (가독성)
  comment: string;           // 50자 이상
}
```

**응답 201**

```typescript
{
  review: {
    id: string;
    submissionId: string;
    submittedAt: string;
  };
  creditBalance: number;  // +1 지급 후 잔액
}
```

**에러**
- `422 COMPLETENESS_FAILED`: 점수 누락 또는 코멘트 50자 미만
- `404 CLAIM_NOT_FOUND`: 유효하지 않은 클레임
- `409 REVIEW_ALREADY_EXISTS`: 이미 제출한 평가

---

### GET /api/reviews/mine 🔒 — 내가 작성한 평가 목록

**쿼리 파라미터**

```
page?: number
limit?: number
```

**응답 200**

```typescript
{
  reviews: Array<{
    id: string;
    submissionId: string;
    scoreRelevance: number;
    scoreLogic: number;
    scoreSpecificity: number;
    scoreReadability: number;
    comment: string;
    submittedAt: string;
  }>;
  total: number;
}
```

---

## 신뢰점수 체크리스트 (Trust Checklist)

### POST /api/trust-checklist 🔒 — 체크리스트 응답 제출

평가받은 제출자만 제출 가능. 크레딧과 무관. `users.trust_score` 갱신.

**요청 바디**

```typescript
{
  reviewId: string;
  usedSpecifics: boolean;          // 구체적 사례·숫자 지적 여부
  newPerspective: boolean;         // 미처 생각 못한 관점 제시 여부
  actionableAlternatives: boolean; // 실행 가능한 대안 제시 여부
}
```

**응답 201**

```typescript
{
  trustChecklistResponse: {
    id: string;
    reviewId: string;
    createdAt: string;
  };
}
```

**에러**
- `403 NOT_SUBMITTER`: 해당 제출물의 소유자가 아님
- `409 ALREADY_RESPONDED`: 이미 응답함

---

## 우선매칭권 (Priority Passes)

### POST /api/priority-passes 🔒 — 우선매칭권 구매 및 활성화

사용자당 동시 활성 1건 상한. DB 유니크 부분 인덱스로 강제.

**요청 바디**

```typescript
{
  submissionId: string;  // general 레인으로 등록된 기존 제출물 또는 신규 등록 시 함께 처리
}
```

**응답 201**

```typescript
{
  priorityPass: {
    id: string;
    submissionId: string;
    status: 'active';
    expiresAt: string;  // created_at + 24시간
    createdAt: string;
  };
}
```

**에러**
- `409 PRIORITY_PASS_LIMIT`: 이미 활성 우선매칭권 1건 존재
- `404 SUBMISSION_NOT_FOUND`: 제출물 없음 또는 접근 권한 없음

---

## 크레딧 (Credits)

### GET /api/credits/balance 🔒 — 잔액 조회

**응답 200**

```typescript
{
  creditBalance: number;
}
```

---

### GET /api/credits/history 🔒 — 크레딧 원장 이력

**쿼리 파라미터**

```
page?: number
limit?: number
```

**응답 200**

```typescript
{
  entries: Array<{
    id: string;
    delta: number;          // +5, -3, +1
    eventType: 'signup_bonus' | 'submission_debit' | 'review_credit';
    refId: string | null;   // 관련 submission_id 또는 review_id
    createdAt: string;
  }>;
  total: number;
  currentBalance: number;
}
```

---

## TypeScript 타입 정의 (요약)

```typescript
type JobMajor = '개발' | '디자인' | '마케팅' | '기획' | '영업' | 'HR';

type JobMinor =
  // 개발
  | '프론트엔드' | '백엔드' | '풀스택' | '모바일' | '데이터·AI' | 'DevOps·인프라'
  // 디자인
  | 'UX·UI' | '그래픽·브랜딩' | '프로덕트 디자인'
  // 마케팅
  | '퍼포먼스' | '브랜드·콘텐츠' | '그로스'
  // 기획
  | '프로덕트 기획' | '서비스 기획'
  // 영업
  | '영업' | '비즈니스 개발'
  // HR
  | '채용' | '인사·조직문화';

type ExperienceBand = '신입' | '1~3년' | '4~7년' | '8년+';

interface PiiWarning {
  type: 'email' | 'phone' | 'url';
  match: string;
  offset: number;
}
```

---

## Open Questions

1. **첫 30일 지표 windowing/분모 규칙**: 성공 지표 집계 API(관리자용)는 windowing 정의 확정 후 구현한다.
2. **정성 코멘트 80자 초과율 목표치**: 내부 모니터링 쿼리로 추적하며, 별도 공개 API는 확정 후 추가한다.
3. **인증 방식**: 세션 쿠키(HttpOnly) vs. JWT Bearer 토큰을 구현 단계에서 결정한다. API 스펙은 어느 방식에도 호환된다.
