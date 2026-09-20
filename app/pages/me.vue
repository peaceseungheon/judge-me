<template>
  <UContainer class="py-10 lg:py-14">
    <div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-sm font-medium text-secondary">마이페이지</p>
        <h1 class="mt-1 text-2xl font-bold tracking-tight">내 평가 흐름</h1>
        <p class="mt-2 max-w-2xl text-sm text-muted">
          등록한 자소서의 3인 평가 진행률과 내가 완료한 평가 내역을 확인합니다.
        </p>
        <p
          v-if="dashboard"
          class="mt-3 text-sm text-toned"
        >
          {{ dashboard.profile.email }} · {{ dashboard.profile.jobMajor }} / {{ dashboard.profile.jobMinor }} · {{ dashboard.profile.experienceBand }}
        </p>
      </div>
      <div class="flex gap-3">
        <UButton color="neutral" variant="outline" to="/queue">
          평가하기
        </UButton>
        <UButton color="primary" variant="solid" to="/submissions/new">
          자소서 등록
        </UButton>
      </div>
    </div>

    <UAlert
      v-if="error"
      color="error"
      icon="i-heroicons-exclamation-circle"
      title="마이페이지 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
      class="mt-6"
    />

    <div v-if="pending" class="mt-8 grid gap-4 md:grid-cols-3">
      <USkeleton v-for="n in 3" :key="n" class="h-32 w-full rounded-lg" />
    </div>

    <template v-else-if="dashboard">
      <section class="mt-8 grid gap-4 md:grid-cols-3">
        <UCard>
          <p class="text-sm text-muted">보유 크레딧</p>
          <p class="mt-3 text-3xl font-bold tracking-tight">{{ dashboard.profile.creditBalance }}</p>
          <p class="mt-2 text-sm text-muted">자소서 등록은 3점, 평가 완료는 1점입니다.</p>
        </UCard>

        <UCard>
          <p class="text-sm text-muted">등록한 자소서</p>
          <p class="mt-3 text-3xl font-bold tracking-tight">{{ submissions.length }}</p>
          <p class="mt-2 text-sm text-muted">진행률은 정보 라벨이며 등록을 잠그지 않습니다.</p>
        </UCard>

        <UCard>
          <p class="text-sm text-muted">완료한 평가</p>
          <p class="mt-3 text-3xl font-bold tracking-tight">{{ reviews.length }}</p>
          <p class="mt-2 text-sm text-muted">완결성 기준 통과 시 크레딧이 즉시 지급됩니다.</p>
        </UCard>
      </section>

      <section class="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold tracking-tight">내 자소서</h2>
            <UButton color="neutral" variant="ghost" size="sm" to="/submissions/new">
              새로 등록
            </UButton>
          </div>

          <div v-if="submissions.length === 0" class="mt-4 rounded-lg border border-dashed border-default py-16 text-center">
            <UIcon name="i-heroicons-inbox" class="mx-auto mb-3 size-10 text-dimmed" />
            <p class="text-sm text-muted">등록된 자소서가 없습니다.</p>
            <UButton class="mt-4" color="primary" to="/submissions/new">
              자소서 등록하기
            </UButton>
          </div>

          <div v-else class="mt-4 space-y-3">
            <UCard v-for="submission in submissions" :key="submission.id">
              <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <h3 class="font-semibold tracking-tight">{{ submission.title }}</h3>
                    <UBadge color="neutral" variant="subtle">
                      {{ progressLabel(submission.reviewerCount) }}
                    </UBadge>
                    <UBadge :color="submission.status === 'closed' ? 'success' : 'secondary'" variant="subtle">
                      {{ submission.status === 'closed' ? '완료' : '진행 중' }}
                    </UBadge>
                  </div>
                  <p class="mt-2 text-sm text-muted">
                    {{ submission.jobMajor }} · {{ submission.jobMinor }} · {{ submission.experienceBand }}
                  </p>
                  <p class="mt-1 text-sm text-muted">
                    {{ formatDate(submission.createdAt) }}
                  </p>
                </div>
                <div class="min-w-32 text-left sm:text-right">
                  <p class="text-sm font-medium text-highlighted">
                    {{ submission.reviewerCount }}명 평가 완료
                  </p>
                  <div class="mt-2 h-2 overflow-hidden rounded-full bg-elevated">
                    <div
                      class="h-full rounded-full bg-secondary transition-all"
                      :style="{ width: `${progressPercent(submission.reviewerCount)}%` }"
                    />
                  </div>
                </div>
              </div>
            </UCard>
          </div>
        </div>

        <aside>
          <h2 class="text-lg font-semibold tracking-tight">내가 쓴 평가</h2>

          <div v-if="reviews.length === 0" class="mt-4 rounded-lg border border-dashed border-default py-16 text-center">
            <UIcon name="i-heroicons-document-check" class="mx-auto mb-3 size-10 text-dimmed" />
            <p class="text-sm text-muted">작성한 평가가 없습니다.</p>
            <UButton class="mt-4" color="primary" to="/queue">
              평가 시작
            </UButton>
          </div>

          <div v-else class="mt-4 space-y-3">
            <UCard v-for="review in reviews" :key="review.id">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="text-sm font-medium">평가 제출 완료</p>
                  <p class="mt-1 text-sm text-muted">{{ formatDate(review.submittedAt) }}</p>
                </div>
                <UBadge color="success" variant="subtle">
                  +1 크레딧
                </UBadge>
              </div>
              <p class="mt-3 line-clamp-3 text-sm text-toned">
                {{ review.comment }}
              </p>
            </UCard>
          </div>
        </aside>
      </section>
    </template>
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

type UserProfile = {
  id: string
  email: string
  jobMajor: string
  jobMinor: string
  experienceBand: string
  creditBalance: number
  trustScore: number
  createdAt: string
}

type SubmissionSummary = {
  id: string
  title: string
  jobMajor: string
  jobMinor: string
  experienceBand: string
  lane: 'general' | 'priority'
  reviewerCount: number
  status: 'open' | 'closed'
  createdAt: string
}

type ReviewSummary = {
  id: string
  submissionId: string
  scoreRelevance: number
  scoreLogic: number
  scoreSpecificity: number
  scoreReadability: number
  comment: string
  submittedAt: string
}

const { data: dashboard, pending, error } = await useAsyncData('me-dashboard', async () => {
  const requestFetch = useRequestFetch()
  const [profile, submissionList, reviewList] = await Promise.all([
    requestFetch<UserProfile>('/api/users/me'),
    requestFetch<{ submissions: SubmissionSummary[], total: number }>('/api/submissions/mine'),
    requestFetch<{ reviews: ReviewSummary[], total: number }>('/api/reviews/mine')
  ])

  return {
    profile,
    submissions: submissionList.submissions,
    reviews: reviewList.reviews
  }
})

const submissions = computed(() => dashboard.value?.submissions ?? [])
const reviews = computed(() => dashboard.value?.reviews ?? [])

function progressLabel(reviewerCount: number) {
  return `${Math.min(reviewerCount, 3)}/3`
}

function progressPercent(reviewerCount: number) {
  return Math.min(reviewerCount, 3) / 3 * 100
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value))
}
</script>
