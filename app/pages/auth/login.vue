<template>
  <UContainer class="max-w-md py-16">
    <UCard>
      <template #header>
        <h1 class="text-2xl font-bold">로그인</h1>
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
          <UInput v-model="form.password" type="password" placeholder="••••••••" required class="w-full" />
        </UFormField>
        <UButton type="submit" color="primary" variant="solid" class="w-full" :loading="pending">
          로그인
        </UButton>
      </form>

      <template #footer>
        <p class="text-center text-sm text-muted">
          계정이 없으신가요?
          <NuxtLink to="/auth/signup" class="text-primary hover:underline">가입하기</NuxtLink>
        </p>
      </template>
    </UCard>
  </UContainer>
</template>

<script setup lang="ts">
definePageMeta({ middleware: [] })

const { fetch: refreshSession } = useUserSession()
const form = reactive({ email: '', password: '' })
const pending = ref(false)
const errorMsg = ref('')

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 올바르지 않습니다.',
}

async function submit() {
  pending.value = true
  errorMsg.value = ''
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: form })
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
