<template>
  <UContainer class="py-20 text-center">
    <h1 class="text-2xl font-bold">재판정</h1>
    <p class="mt-3 text-base text-muted">자소서를 등록하고 상호 평가로 신뢰도 높은 피드백을 받으세요.</p>
    <div class="mt-8 flex justify-center gap-3">
      <NuxtLink to="/auth/signup">
        <UButton color="primary" variant="solid">시작하기</UButton>
      </NuxtLink>
      <NuxtLink to="/auth/login">
        <UButton color="neutral" variant="outline">로그인</UButton>
      </NuxtLink>
    </div>
  </UContainer>
</template>

<script setup lang="ts">
const { loggedIn } = useUserSession()
if (loggedIn.value) {
  navigateTo('/me')
}
</script>
