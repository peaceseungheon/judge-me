# 재판정 / Judge Me — 데이터 모델

> Nuxt.js + TypeScript + 관리형 PostgreSQL 환경 기준. 1인 개발자가 즉시 구현에 착수할 수 있도록 테이블·컬럼·제약을 명세한다.

---

## 도메인 개요

```
users
  ├── submissions (1:N)
  │     ├── queue_claims (1:N)
  │     │     └── reviews (1:1)
  │     │           └── trust_checklist_responses (1:1, 제출자가 작성)
  │     └── priority_passes (0:1 활성 상한)
  └── credit_ledger_entries (1:N, 불변 원장)
```

---

## Enum 정의

### job_major (직군 대분류)

```sql
CREATE TYPE job_major AS ENUM (
  '개발', '디자인', '마케팅', '기획', '영업', 'HR'
);
```

### job_minor (직군 소분류)

```sql
CREATE TYPE job_minor AS ENUM (
  -- 개발
  '프론트엔드', '백엔드', '풀스택', '모바일', '데이터·AI', 'DevOps·인프라',
  -- 디자인
  'UX·UI', '그래픽·브랜딩', '프로덕트 디자인',
  -- 마케팅
  '퍼포먼스', '브랜드·콘텐츠', '그로스',
  -- 기획
  '프로덕트 기획', '서비스 기획',
  -- 영업
  '영업', '비즈니스 개발',
  -- HR
  '채용', '인사·조직문화'
);
```

### experience_band (연차 구간)

```sql
CREATE TYPE experience_band AS ENUM (
  '신입', '1~3년', '4~7년', '8년+'
);
```

### submission_lane (제출물 레인)

```sql
CREATE TYPE submission_lane AS ENUM (
  'general',   -- 일반(무료), 동시 건수 제한 없음
  'priority'   -- 우선매칭권(유료), 사용자당 동시 활성 1건 상한
);
```

### submission_status

```sql
CREATE TYPE submission_status AS ENUM (
  'open',    -- 평가 진행 중
  'closed'   -- 3인 완료 또는 수동 종료
);
```

### claim_status

```sql
CREATE TYPE claim_status AS ENUM (
  'claimed',   -- 큐에서 점유됨
  'reviewed',  -- 평가 제출 완료
  'abandoned'  -- 평가 없이 포기 (수동 CS 처리)
);
```

### credit_event_type (크레딧 원장 이벤트 유형)

```sql
CREATE TYPE credit_event_type AS ENUM (
  'signup_bonus',     -- 가입 보너스 +5
  'submission_debit', -- 자소서 등록 차감 −3
  'review_credit'     -- 평가 완료 즉시 지급 +1
);
```

### priority_pass_status

```sql
CREATE TYPE priority_pass_status AS ENUM (
  'active',     -- 현재 활성
  'completed',  -- 3인 완료로 종료
  'cancelled'   -- 수동 취소
);
```

---

## 테이블 명세

### users

```sql
CREATE TABLE users (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT        NOT NULL UNIQUE,
  password_hash   TEXT        NOT NULL,
  job_major       job_major   NOT NULL,
  job_minor       job_minor   NOT NULL,
  experience_band experience_band NOT NULL,
  credit_balance  INTEGER     NOT NULL DEFAULT 5 CHECK (credit_balance >= 0),
  trust_score     NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**주요 제약:**
- `credit_balance >= 0`: DB 레벨에서 음수 잔액 방지.
- `credit_balance` 갱신은 반드시 명시적 트랜잭션 내 `SELECT ... FOR UPDATE` 후 수행해 이중 차감을 방지한다.
- `trust_score`는 신뢰점수 체크리스트 응답 집계 결과. 크레딧과 독립적.

---

### submissions (자소서 제출물)

```sql
CREATE TABLE submissions (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID              NOT NULL REFERENCES users(id),
  title           TEXT              NOT NULL,
  body_text       TEXT              NOT NULL,
  job_major       job_major         NOT NULL,
  job_minor       job_minor         NOT NULL,
  experience_band experience_band   NOT NULL,
  lane            submission_lane   NOT NULL DEFAULT 'general',
  reviewer_count  INTEGER           NOT NULL DEFAULT 0 CHECK (reviewer_count >= 0 AND reviewer_count <= 3),
  status          submission_status NOT NULL DEFAULT 'open',
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- 매칭 큐 성능용 인덱스
CREATE INDEX idx_submissions_queue
  ON submissions (job_major, job_minor, experience_band, created_at)
  WHERE status = 'open';
```

**주요 제약:**
- `reviewer_count <= 3`: 3인 이상 배정 방지.
- 매칭 큐는 `job_major + job_minor + experience_band + created_at ASC` 순으로 FIFO 정렬.
- 동시 건수 제한: `general` 레인은 제한 없음. `priority` 레인은 애플리케이션 레이어에서 활성 priority_pass 1건 제한 확인.

---

### queue_claims (큐 클레임)

```sql
CREATE TABLE queue_claims (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   UUID         NOT NULL REFERENCES submissions(id),
  reviewer_id     UUID         NOT NULL REFERENCES users(id),
  status          claim_status NOT NULL DEFAULT 'claimed',
  claimed_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ,

  UNIQUE (submission_id, reviewer_id)  -- 동일 평가자 중복 클레임 방지
);

CREATE INDEX idx_queue_claims_submission ON queue_claims (submission_id);
```

**큐 설계 원칙:**
- **pull 방식**: 평가자가 직접 클레임을 요청하며, 시스템은 push 자동배정을 하지 않는다.
- **FIFO 강제**: `ORDER BY s.created_at ASC`로 등록 순서를 강제하며, 평가자의 임의 정렬·체리피킹 불가.
- **폴백 없는 빈 큐**: 일치 태그 제출물이 0건이면 인접 태그 폴백 없이 빈 결과를 반환한다.

**동시성 처리 (원자적 클레임):**

```sql
-- 다음 클레임 가능한 제출물을 원자적으로 점유하는 쿼리 패턴
WITH target AS (
  SELECT s.id
  FROM submissions s
  WHERE s.status = 'open'
    AND s.job_major = $evaluator_job_major
    AND s.job_minor = $evaluator_job_minor
    AND s.experience_band = $evaluator_experience_band
    AND s.user_id != $evaluator_id
    AND s.reviewer_count < 3
    AND NOT EXISTS (
      SELECT 1 FROM queue_claims qc
      WHERE qc.submission_id = s.id AND qc.reviewer_id = $evaluator_id
    )
  ORDER BY s.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED  -- 경합 처리 핵심
)
INSERT INTO queue_claims (submission_id, reviewer_id)
SELECT id, $evaluator_id FROM target
RETURNING *;
```

---

### reviews (평가)

```sql
CREATE TABLE reviews (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_claim_id      UUID        NOT NULL UNIQUE REFERENCES queue_claims(id),
  submission_id       UUID        NOT NULL REFERENCES submissions(id),
  reviewer_id         UUID        NOT NULL REFERENCES users(id),
  score_relevance     SMALLINT    NOT NULL CHECK (score_relevance BETWEEN 1 AND 5),
  score_logic         SMALLINT    NOT NULL CHECK (score_logic BETWEEN 1 AND 5),
  score_specificity   SMALLINT    NOT NULL CHECK (score_specificity BETWEEN 1 AND 5),
  score_readability   SMALLINT    NOT NULL CHECK (score_readability BETWEEN 1 AND 5),
  comment             TEXT        NOT NULL CHECK (char_length(comment) >= 50),
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**완결성 검증:**
- 4축 점수(`BETWEEN 1 AND 5`) + `char_length(comment) >= 50` 은 DB 제약으로 이중 보장.
- 애플리케이션에서도 제출 시점 동기 검증 후 통과 시 크레딧 +1 지급 트랜잭션 실행.

**평가 제출 후 처리 (단일 트랜잭션 내):**
1. `reviews` INSERT
2. `queue_claims.status = 'reviewed'`, `reviewed_at = NOW()` UPDATE
3. `submissions.reviewer_count += 1` UPDATE (3 도달 시 `status = 'closed'`)
4. `users.credit_balance += 1` WHERE `id = reviewer_id` (SELECT FOR UPDATE 선행)
5. `credit_ledger_entries` INSERT (type = 'review_credit')

---

### trust_checklist_responses (신뢰점수 체크리스트)

```sql
CREATE TABLE trust_checklist_responses (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id               UUID        NOT NULL UNIQUE REFERENCES reviews(id),
  submission_id           UUID        NOT NULL REFERENCES submissions(id),
  submitter_id            UUID        NOT NULL REFERENCES users(id),  -- 제출자(평가받은 사람)
  used_specifics          BOOLEAN     NOT NULL,  -- 구체적 사례·숫자 지적 여부
  new_perspective         BOOLEAN     NOT NULL,  -- 미처 생각 못한 관점 제시 여부
  actionable_alternatives BOOLEAN     NOT NULL,  -- 실행 가능한 대안 제시 여부
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**설계 원칙:**
- 크레딧과 완전히 분리. 이 테이블의 어떤 값도 크레딧 지급에 영향을 주지 않는다.
- `trust_score` 집계는 별도 배치 또는 응답 저장 시 `users.trust_score` 재계산으로 처리.

---

### credit_ledger_entries (크레딧 원장)

```sql
CREATE TABLE credit_ledger_entries (
  id          UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID              NOT NULL REFERENCES users(id),
  delta       INTEGER           NOT NULL,  -- +5, -3, +1
  event_type  credit_event_type NOT NULL,
  ref_id      UUID,             -- submission_id 또는 review_id 참조 (nullable)
  created_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_ledger_user ON credit_ledger_entries (user_id, created_at DESC);
```

**원장 불변 원칙:**
- DELETE/UPDATE 금지. 잔액은 `users.credit_balance`에 캐싱하며, 원장은 감사 목적으로만 사용.
- 크레딧 환수(clawback)는 구현하지 않는다.
- 만료 로직 없음(유효기간 무기한).

---

### priority_passes (우선매칭권)

```sql
CREATE TABLE priority_passes (
  id            UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID                 NOT NULL REFERENCES users(id),
  submission_id UUID                 NOT NULL UNIQUE REFERENCES submissions(id),
  status        priority_pass_status NOT NULL DEFAULT 'active',
  expires_at    TIMESTAMPTZ          NOT NULL,  -- activated_at + 24시간
  created_at    TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

-- 사용자당 활성 priority_pass 1건 상한을 위한 부분 인덱스
CREATE UNIQUE INDEX idx_priority_pass_active_per_user
  ON priority_passes (user_id)
  WHERE status = 'active';
```

**주요 제약:**
- `WHERE status = 'active'`의 유니크 부분 인덱스로 사용자당 동시 활성 1건 상한을 DB 레벨에서 강제.
- 일반(general) 레인 제출물 동시 건수는 제한 없음.
- 만료(expires_at 도달) 후 처리는 수동/CS 대응(MVP 범위 — 자동 환불·캐리오버 없음).

---

## 트랜잭션 무결성 요약

| 시나리오           | 처리 방법                                                |
| -------------- | ---------------------------------------------------- |
| 자소서 등록         | `credit_balance -= 3` (FOR UPDATE) + `submissions` INSERT + `credit_ledger_entries` INSERT — 단일 트랜잭션 |
| 큐 클레임          | `SELECT ... FOR UPDATE SKIP LOCKED` + `queue_claims` INSERT — 단일 트랜잭션 |
| 평가 제출          | `reviews` INSERT + `queue_claims` UPDATE + `submissions.reviewer_count` UPDATE + `credit_balance += 1` (FOR UPDATE) + `credit_ledger_entries` INSERT — 단일 트랜잭션 |
| 우선매칭권 동시 생성 경합 | `priority_passes (user_id) WHERE status='active'` 유니크 인덱스 위반 → 409 Conflict 반환 |

---

## Open Questions

1. **첫 30일 지표 windowing/분모 규칙**: `submissions.created_at` 기준 30일 rolling인지, 론칭일 고정 기간인지 확정 전까지 집계 쿼리 작성을 보류한다.
2. **정성 코멘트 80자 초과율 목표치**: 데이터 수집 후 확정. 현재는 `char_length(reviews.comment) > 80` 조건으로 집계만 준비한다.
