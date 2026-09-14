<template>
  <UContainer class="max-w-2xl py-10">
    <h1 class="text-2xl font-bold">자소서 등록</h1>
    <p class="mt-1 text-sm text-neutral-500">크레딧 3점이 차감되며 평가자를 매칭합니다.</p>

    <UAlert
      v-if="errorMsg"
      color="error"
      icon="i-heroicons-exclamation-circle"
      :title="errorMsg"
      class="mt-4"
    />

    <UAlert
      v-for="w in piiWarnings"
      :key="w.offset"
      color="warning"
      icon="i-heroicons-exclamation-triangle"
      :title="`개인정보 패턴이 감지되었습니다: ${w.match}`"
      class="mt-3"
    />

    <form class="mt-6 space-y-4" @submit.prevent="submit">
      <UFormField label="제목" name="title">
        <UInput v-model="form.title" placeholder="자소서 제목 (100자 이하)" maxlength="100" required class="w-full" />
      </UFormField>

      <div class="flex gap-3">
        <UFormField label="직군 대분류" name="jobMajor" class="flex-1">
          <USelect v-model="form.jobMajor" :options="JOB_MAJORS" placeholder="선택" required class="w-full" @change="form.jobMinor = ''" />
        </UFormField>
        <UFormField label="직군 소분류" name="jobMinor" class="flex-1">
          <USelect
            v-model="form.jobMinor"
            :options="jobMinors"
            :disabled="!form.jobMajor"
            placeholder="대분류 선택 후"
            required
            class="w-full"
          />
        </UFormField>
        <UFormField label="경력" name="experienceBand" class="flex-1">
          <USelect v-model="form.experienceBand" :options="EXPERIENCE_BANDS" placeholder="선택" required class="w-full" />
        </UFormField>
      </div>

      <UFormField label="자소서 본문" name="bodyText">
        <UTextarea v-model="form.bodyText" :rows="16" autoresize placeholder="자소서 본문을 입력하세요. 이름·학교명 등 식별 가능한 정보는 직접 마스킹해 주세요." required class="w-full" />
      </UFormField>

      <div class="flex justify-end gap-3">
        <NuxtLink to="/me">
          <UButton color="neutral" variant="outline">취소</UButton>
        </NuxtLink>
        <UButton type="submit" color="primary" variant="solid" :loading="pending">
          등록하기
        </UButton>
      </div>
    </form>
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const toast = useToast()

const JOB_MAJORS = ['개발', '디자인', '마케팅', '기획', '영업', 'HR']
const EXPERIENCE_BANDS = ['신입', '1~3년', '4~7년', '8년+']
const JOB_MINORS_BY_MAJOR: Record<string, string[]> = {
  개발: ['프론트엔드', '백엔드', '풀스택', '모바일', '데이터·AI', 'DevOps·인프라'],
  디자인: ['UX·UI', '그래픽·브랜딩', '프로덕트 디자인'],
  마케팅: ['퍼포먼스', '브랜드·콘텐츠', '그로스'],
  기획: ['프로덕트 기획', '서비스 기획'],
  영업: ['영업', '비즈니스 개발'],
  HR: ['채용', '인사·조직문화'],
}

type PiiWarning = { type: string; match: string; offset: number }

const form = reactive({ title: '', bodyText: '', jobMajor: '', jobMinor: '', experienceBand: '', lane: 'general' as const })
const pending = ref(false)
const errorMsg = ref('')
const piiWarnings = ref<PiiWarning[]>([])

const jobMinors = computed(() => JOB_MINORS_BY_MAJOR[form.jobMajor] ?? [])

const ERROR_MESSAGES: Record<string, string> = {
  INSUFFICIENT_CREDITS: '크레딧 잔액이 부족합니다. 평가를 완료하면 크레딧이 적립됩니다.',
}

async function submit() {
  pending.value = true
  errorMsg.value = ''
  piiWarnings.value = []
  try {
    const res = await $fetch<{ submission: { id: string }; piiWarnings: PiiWarning[] }>('/api/submissions', {
      method: 'POST',
      body: form,
    })
    piiWarnings.value = res.piiWarnings ?? []
    toast.add({ title: '자소서가 등록되었습니다.', color: 'success' })
    navigateTo('/me')
  } catch (e: unknown) {
    const err = e as { data?: { error?: { code?: string } } }
    const code = err.data?.error?.code ?? ''
    errorMsg.value = ERROR_MESSAGES[code] ?? '요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
  } finally {
    pending.value = false
  }
}
</script>
