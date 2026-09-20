<template>
  <UContainer class="max-w-2xl py-10">
    <h1 class="text-2xl font-bold">평가하기</h1>
    <p class="mt-1 text-sm text-muted">평가를 완료하면 크레딧 1점이 적립됩니다.</p>

    <!-- 로딩 -->
    <USkeleton v-if="claimPending" class="mt-6 h-48 w-full rounded-lg" />

    <!-- 클레임 없음 → 큐 비어있음 또는 클레임 시도 -->
    <template v-else-if="!claim">
      <UAlert
        v-if="claimError"
        color="info"
        icon="i-heroicons-inbox"
        title="현재 평가 대기 중인 자소서가 없습니다. 잠시 후 다시 시도해 주세요."
        class="mt-6"
      />
      <div v-else class="mt-8 text-center">
        <UIcon name="i-heroicons-document-text" class="mx-auto mb-3 size-12 text-dimmed" />
        <p class="text-sm text-muted">평가할 자소서를 가져옵니다.</p>
        <UButton class="mt-4" color="primary" variant="solid" :loading="claiming" @click="claimNext">
          평가 시작
        </UButton>
      </div>
    </template>

    <!-- 클레임 있음 → 평가 폼 -->
    <template v-else>
      <UCard class="mt-6">
        <template #header>
          <div class="flex items-start justify-between">
            <div>
              <h2 class="text-lg font-semibold">{{ submission?.title }}</h2>
              <p class="mt-0.5 text-sm text-muted">
                {{ submission?.jobMajor }} · {{ submission?.jobMinor }} · {{ submission?.experienceBand }}
              </p>
            </div>
          </div>
        </template>
        <div class="whitespace-pre-wrap text-base leading-relaxed">{{ submission?.bodyText }}</div>
      </UCard>

      <div class="mt-8">
        <h2 class="text-lg font-semibold">평가 작성</h2>

        <UAlert
          v-if="reviewError"
          color="error"
          icon="i-heroicons-exclamation-circle"
          :title="reviewError"
          class="mt-3"
        />

        <form class="mt-4 space-y-4" @submit.prevent="submitReview">
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="직무 적합성 (1~5)" name="scoreRelevance">
              <USelect v-model.number="review.scoreRelevance" aria-label="직무 적합성 점수" :items="SCORE_OPTIONS" required class="w-full" />
            </UFormField>
            <UFormField label="논리 구조 (1~5)" name="scoreLogic">
              <USelect v-model.number="review.scoreLogic" aria-label="논리 구조 점수" :items="SCORE_OPTIONS" required class="w-full" />
            </UFormField>
            <UFormField label="구체성 (1~5)" name="scoreSpecificity">
              <USelect v-model.number="review.scoreSpecificity" aria-label="구체성 점수" :items="SCORE_OPTIONS" required class="w-full" />
            </UFormField>
            <UFormField label="가독성 (1~5)" name="scoreReadability">
              <USelect v-model.number="review.scoreReadability" aria-label="가독성 점수" :items="SCORE_OPTIONS" required class="w-full" />
            </UFormField>
          </div>

          <UFormField label="코멘트 (50자 이상)" name="comment">
            <UTextarea v-model="review.comment" :rows="5" placeholder="구체적인 피드백을 작성해 주세요." required class="w-full" />
            <p :class="['mt-1 text-sm', review.comment.length < 50 ? 'text-error' : 'text-dimmed']">
              {{ review.comment.length }} / 50자
            </p>
          </UFormField>

          <div class="flex justify-end">
            <UButton
              type="submit"
              color="primary"
              variant="solid"
              :loading="submitting"
              :disabled="review.comment.length < 50"
            >
              평가 제출
            </UButton>
          </div>
        </form>
      </div>
    </template>
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const toast = useToast()
const SCORE_OPTIONS = [1, 2, 3, 4, 5]

type Claim = { id: string; submissionId: string; claimedAt: string; status: string }
type Submission = { id: string; title: string; bodyText: string; jobMajor: string; jobMinor: string; experienceBand: string }

const claim = ref<Claim | null>(null)
const submission = ref<Submission | null>(null)
const claiming = ref(false)
const submitting = ref(false)
const claimError = ref(false)
const reviewError = ref('')

const review = reactive({
  scoreRelevance: 3,
  scoreLogic: 3,
  scoreSpecificity: 3,
  scoreReadability: 3,
  comment: '',
})

const ERROR_MESSAGES: Record<string, string> = {
  COMPLETENESS_FAILED: '모든 항목에 점수를 입력하고, 코멘트를 50자 이상 작성해 주세요.',
  REVIEW_ALREADY_EXISTS: '이미 제출한 평가입니다.',
}

// 기존 클레임 확인
const { pending: claimPending } = await useAsyncData('current-claim', async () => {
  const res = await $fetch<{ claim: Claim | null }>('/api/queue/current-claim')
  if (res.claim && res.claim.status === 'claimed') {
    claim.value = res.claim
    const sub = await $fetch<Submission>(`/api/submissions/${res.claim.submissionId}`)
    submission.value = sub
  }
  return res
})

async function claimNext() {
  claiming.value = true
  claimError.value = false
  try {
    const res = await $fetch<{ claim: Claim; submission: Submission }>('/api/queue/claim', { method: 'POST' })
    claim.value = res.claim
    submission.value = res.submission
  } catch (e: unknown) {
    const err = e as { data?: { error?: { code?: string } } }
    if (err.data?.error?.code === 'QUEUE_EMPTY') {
      claimError.value = true
    }
  } finally {
    claiming.value = false
  }
}

async function submitReview() {
  submitting.value = true
  reviewError.value = ''
  try {
    await $fetch('/api/reviews', {
      method: 'POST',
      body: { queueClaimId: claim.value!.id, ...review },
    })
    toast.add({ title: '평가가 제출되었습니다. 크레딧 1점이 적립되었습니다.', color: 'success' })
    navigateTo('/me')
  } catch (e: unknown) {
    const err = e as { data?: { error?: { code?: string } } }
    const code = err.data?.error?.code ?? ''
    reviewError.value = ERROR_MESSAGES[code] ?? '요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
  } finally {
    submitting.value = false
  }
}
</script>
