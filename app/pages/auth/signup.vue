<template>
  <UContainer class="max-w-md py-16">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-bold">가입하기</h1>
      </template>

      <UAlert
        v-if="errorMsg"
        color="error"
        icon="i-heroicons-exclamation-circle"
        :title="errorMsg"
        class="mb-4"
      />

      <form class="space-y-4" @submit.prevent="submit">
        <UFormField label="이메일" name="email">
          <UInput v-model="form.email" type="email" placeholder="you@example.com" required class="w-full" />
        </UFormField>
        <UFormField label="비밀번호" name="password">
          <UInput v-model="form.password" type="password" placeholder="8자 이상" required class="w-full" />
        </UFormField>
        <UFormField label="직군 대분류" name="jobMajor">
          <USelect v-model="form.jobMajor" aria-label="직군 대분류" :items="JOB_MAJORS" placeholder="선택" required class="w-full" @update:model-value="form.jobMinor = ''" />
        </UFormField>
        <UFormField label="직군 소분류" name="jobMinor">
          <USelect
            v-model="form.jobMinor"
            aria-label="직군 소분류"
            :items="jobMinors"
            :disabled="!form.jobMajor"
            placeholder="대분류를 먼저 선택하세요"
            required
            class="w-full"
          />
        </UFormField>
        <UFormField label="경력" name="experienceBand">
          <USelect v-model="form.experienceBand" aria-label="경력" :items="EXPERIENCE_BANDS" placeholder="선택" required class="w-full" />
        </UFormField>
        <UButton type="submit" color="primary" variant="solid" class="w-full" :loading="pending">
          가입하기
        </UButton>
      </form>

      <template #footer>
        <p class="text-center text-sm text-neutral-500">
          이미 계정이 있으신가요?
          <NuxtLink to="/auth/login" class="text-primary hover:underline">로그인</NuxtLink>
        </p>
      </template>
    </UCard>
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({ middleware: [] })

const { fetch: refreshSession } = useUserSession()

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

const form = reactive({ email: '', password: '', jobMajor: '', jobMinor: '', experienceBand: '' })
const pending = ref(false)
const errorMsg = ref('')

const jobMinors = computed(() => JOB_MINORS_BY_MAJOR[form.jobMajor] ?? [])

const ERROR_MESSAGES: Record<string, string> = {
  DUPLICATE_EMAIL: '이미 가입된 이메일입니다.',
}

async function submit() {
  pending.value = true
  errorMsg.value = ''
  try {
    await $fetch('/api/auth/signup', { method: 'POST', body: form })
    await refreshSession()
    navigateTo('/me')
  } catch (e: unknown) {
    const err = e as { data?: { error?: { code?: string; message?: string } } }
    const code = err.data?.error?.code ?? ''
    errorMsg.value = ERROR_MESSAGES[code] ?? '요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
  } finally {
    pending.value = false
  }
}
</script>
