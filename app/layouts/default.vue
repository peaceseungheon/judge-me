<template>
  <div class="min-h-screen">
    <header class="border-b border-default">
      <UContainer class="flex h-14 items-center justify-between">
        <NuxtLink to="/" class="text-lg font-bold text-primary">재판정</NuxtLink>
        <nav class="flex items-center gap-4">
          <template v-if="loggedIn">
            <NuxtLink to="/submissions/new" class="text-sm text-muted hover:text-primary">
              자소서 등록
            </NuxtLink>
            <NuxtLink to="/queue" class="text-sm text-muted hover:text-primary">
              평가하기
            </NuxtLink>
            <NuxtLink to="/me" class="text-sm text-muted hover:text-primary">
              마이페이지
            </NuxtLink>
            <UButton color="neutral" variant="outline" size="sm" :loading="loggingOut" @click="logout">
              로그아웃
            </UButton>
          </template>
          <template v-else>
            <NuxtLink to="/auth/login">
              <UButton color="neutral" variant="ghost" size="sm">로그인</UButton>
            </NuxtLink>
            <NuxtLink to="/auth/signup">
              <UButton color="primary" variant="solid" size="sm">가입하기</UButton>
            </NuxtLink>
          </template>
          <UColorModeButton />
        </nav>
      </UContainer>
    </header>
    <main>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const { loggedIn, clear } = useUserSession()
const loggingOut = ref(false)
const toast = useToast()

async function logout() {
  loggingOut.value = true
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await clear()
    navigateTo('/auth/login')
  } catch {
    toast.add({ title: '로그아웃 중 오류가 발생했습니다.', color: 'error' })
  } finally {
    loggingOut.value = false
  }
}
</script>
