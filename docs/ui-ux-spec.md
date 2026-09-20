# 재판정 UI/UX 컴포넌트 사용 규칙

> Nuxt UI 기반 디자인 시스템 준수 기준. 화면을 새로 만들거나 수정할 때 이 문서를 먼저 읽는다.

---

## 1. 컬러 / 타이포그래피 / 스페이싱 토큰

### 1-1. 컬러

`app.config.ts`에 정의된 시맨틱 컬러를 사용한다. 임의의 Tailwind 원색 클래스(`blue-500`, `amber-300` 등)를 화면 컴포넌트에 직접 쓰지 않는다.

| 역할 | 토큰 | 기본값 | 용도 |
|------|------|--------|------|
| Primary | `primary` | blue (라이트: blue-700 / 다크: blue-300) | 주요 CTA 버튼, 링크, 포커스 링 |
| Secondary / Accent | `secondary` | amber | 강조 뱃지, 상태 하이라이트 |
| Neutral | `neutral` | slate | 배경, 보더, 텍스트 기본 |
| Success | `success` | green | 성공 알림, 완료 상태 |
| Warning | `warning` | amber | PII 경고, 주의 메시지 |
| Error | `error` | red | 폼 에러, 실패 알림 |
| Info | `info` | sky | 안내 메시지, 큐 비어있음 등 |

**다크모드**: `app.config.ts`와 `main.css`의 `.dark` 오버라이드를 통해 자동으로 전환된다. 개별 컴포넌트에서 `dark:` 변형 클래스를 추가할 때는 위 토큰 변수를 기준으로 한다.

### 1-2. 타이포그래피

`main.css`에서 `--font-sans: 'Inter', 'Noto Sans KR', ui-sans-serif, system-ui, sans-serif`로 선언된다.

| 용도 | 클래스 | 크기 / 굵기 |
|------|--------|-------------|
| 페이지 제목 | `text-2xl font-bold` | 24px / 700 |
| 섹션 제목 | `text-lg font-semibold` | 18px / 600 |
| 본문 | `text-base` | 16px / 400 |
| 보조 텍스트 / 라벨 | `text-sm text-neutral-500` | 14px / 400 |
| 경고·에러 메시지 | `text-sm text-error` | 14px / 400 |

이모지·캐주얼 카피를 쓰지 않는다. 동사는 명확하고 간결하게 ("등록하기", "평가 시작", "제출" 등).

### 1-3. 스페이싱

Tailwind 4 기본 스케일(4px 기준)을 사용한다.

| 용도 | 클래스 |
|------|--------|
| 페이지 외곽 여백 | `px-4 md:px-8`, `py-6 md:py-10` |
| 카드 내부 패딩 | `p-4` ~ `p-6` |
| 폼 필드 간격 | `space-y-4` |
| 버튼 그룹 간격 | `gap-3` |
| 섹션 간격 | `mt-8` ~ `mt-12` |

---

## 2. 화면 요소별 Nuxt UI 컴포넌트 매핑

핵심 루프 화면(가입/로그인, 자소서 등록, 평가 큐, 평가 제출, 마이페이지)에서 사용하는 컴포넌트 매핑표.

| 화면 요소 | Nuxt UI 컴포넌트 | 주요 props |
|-----------|-----------------|------------|
| 페이지 컨테이너 | `UContainer` | `class="max-w-2xl"` |
| 카드 | `UCard` | `ui.body` 슬롯 사용 |
| 주요 CTA 버튼 | `UButton` | `color="primary"` `variant="solid"` |
| 보조 버튼 | `UButton` | `color="neutral"` `variant="outline"` |
| 텍스트 입력 | `UInput` | `color` 에러 시 `"error"` |
| 비밀번호 입력 | `UInput` | `type="password"` |
| 긴 텍스트 입력 (자소서 본문) | `UTextarea` | `rows="16"` `autoresize` |
| 선택 필드 (직군/연차) | `USelect` | `value-key`, `option-attribute` |
| 별점 / 점수 슬라이더 (1~5) | `URadioGroup` | `orientation="horizontal"` |
| 알림 토스트 | `useToast()` | `add({ title, color })` |
| 에러 배너 | `UAlert` | `color="error"` `icon="i-heroicons-exclamation-circle"` |
| 정보 배너 | `UAlert` | `color="info"` |
| 경고 배너 (PII) | `UAlert` | `color="warning"` |
| 진행률 라벨 | `UBadge` | `color="neutral"` `variant="subtle"` |
| 로딩 스피너 | `UIcon` + `animate-spin` 또는 `USkeleton` | 아이템 목록엔 Skeleton |
| 내비게이션 | `UNavigationMenu` | 최상위 앱 헤더에 사용 |
| 모달 (확인) | `UModal` | 파괴적 액션 확인 시만 |
| 폼 래퍼 | `UForm` | `schema` + `state` 바인딩 |
| 폼 필드 | `UFormField` | `label` `name` `error` |

---

## 3. 로딩 / 에러 / 빈 상태 공통 처리 패턴

모든 비동기 API 호출에서 세 가지 UI 상태를 명시적으로 처리한다.

### 3-1. 로딩

```vue
<template>
  <!-- 단일 항목(카드) -->
  <USkeleton v-if="pending" class="h-32 w-full rounded-lg" />

  <!-- 목록 -->
  <div v-if="pending" class="space-y-3">
    <USkeleton v-for="n in 3" :key="n" class="h-16 w-full rounded-md" />
  </div>

  <!-- 버튼 인라인 -->
  <UButton :loading="pending" @click="submit">제출</UButton>
</template>
```

- `useFetch` / `useAsyncData`의 `pending` 값을 직접 사용한다.
- 전체 페이지 스피너 대신 영역별 Skeleton을 쓴다.

### 3-2. 에러

```vue
<template>
  <UAlert
    v-if="error"
    color="error"
    icon="i-heroicons-exclamation-circle"
    :title="error.data?.error?.message ?? '요청 처리 중 오류가 발생했습니다.'"
  />
</template>
```

- API 응답 에러 코드별 메시지 매핑:

| 코드 | 표시 메시지 |
|------|-------------|
| `INSUFFICIENT_CREDITS` | "크레딧 잔액이 부족합니다. 평가를 완료하면 크레딧이 적립됩니다." |
| `QUEUE_EMPTY` | "현재 평가 대기 중인 자소서가 없습니다. 잠시 후 다시 시도해 주세요." |
| `COMPLETENESS_FAILED` | "모든 항목에 점수를 입력하고, 코멘트를 50자 이상 작성해 주세요." |
| `DUPLICATE_EMAIL` | "이미 가입된 이메일입니다." |
| `REVIEW_ALREADY_EXISTS` | "이미 제출한 평가입니다." |
| 기타 서버 오류 | "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." |

- 폼 제출 에러는 `UAlert`로 폼 상단에 표시한다. `useToast()`는 비파괴적 성공/완료 알림에만 쓴다.

### 3-3. 빈 상태

```vue
<template>
  <div v-if="!pending && items.length === 0" class="py-16 text-center text-neutral-500">
    <UIcon name="i-heroicons-inbox" class="mx-auto mb-3 size-10 opacity-40" />
    <p class="text-sm">등록된 자소서가 없습니다.</p>
    <UButton class="mt-4" color="primary" to="/submissions/new">자소서 등록하기</UButton>
  </div>
</template>
```

빈 상태별 안내 문구:

| 화면 | 안내 문구 |
|------|-----------|
| 마이페이지 — 제출물 없음 | "등록된 자소서가 없습니다." |
| 평가 큐 — 큐 비어있음 | "현재 평가 대기 중인 자소서가 없습니다." |
| 마이페이지 — 작성한 평가 없음 | "작성한 평가가 없습니다." |

---

## 4. 폼 검증 규칙

`UForm`과 Valibot/Zod 스키마를 함께 사용한다. 클라이언트 측 검증은 화면 즉시 피드백용이며, 최종 권한은 서버에 있다.

### 4-1. 가입 폼 (`POST /api/auth/signup`)

| 필드 | 규칙 |
|------|------|
| `email` | 이메일 형식, 필수 |
| `password` | 8자 이상, 필수 |
| `jobMajor` | enum 6개 중 선택, 필수 |
| `jobMinor` | `jobMajor`에 속하는 소분류 선택, 필수 |
| `experienceBand` | enum 4개 중 선택, 필수 |

`jobMinor`는 `jobMajor` 선택 시 해당 소분류만 노출되도록 동적으로 필터링한다.

### 4-2. 자소서 등록 폼 (`POST /api/submissions`)

| 필드 | 규칙 |
|------|------|
| `title` | 1자 이상, 100자 이하, 필수 |
| `bodyText` | 1자 이상, 필수 |
| `jobMajor` | enum 6개 중 선택, 필수 |
| `jobMinor` | 해당 대분류 소분류, 필수 |
| `experienceBand` | enum 4개 중 선택, 필수 |
| `lane` | `'general'` 고정 (MVP에서 priority 레인 UI 미노출) |

PII 경고(`piiWarnings`)는 서버 응답 후 `UAlert color="warning"`으로 비차단 표시한다. 등록 자체를 막지 않는다.

### 4-3. 평가 제출 폼 (`POST /api/reviews`)

| 필드 | 규칙 |
|------|------|
| `scoreRelevance` | 1~5 정수, 필수 |
| `scoreLogic` | 1~5 정수, 필수 |
| `scoreSpecificity` | 1~5 정수, 필수 |
| `scoreReadability` | 1~5 정수, 필수 |
| `comment` | 50자 이상, 필수 |

`comment` 길이는 실시간 카운터(`현재 글자 수 / 50자`)로 표시한다. 50자 미만이면 제출 버튼을 비활성화(`disabled`)하고 `text-sm text-error`로 안내한다.

### 4-4. 공통 규칙

- 필수 필드 누락 시 해당 `UFormField`의 `error` prop에 메시지를 전달한다. 폼 전체 에러 배너와 중복 표시하지 않는다.
- 제출 중(`pending`)에는 버튼을 `loading` 상태로 설정하고 중복 제출을 막는다.
- 로그인 폼은 별도 스키마 없이 `required` 속성으로 처리해도 무방하다(간단한 이메일+비밀번호).
