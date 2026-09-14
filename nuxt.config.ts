// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@nuxt/eslint', 'nuxt-auth-utils'],
  colorMode: {
    classSuffix: '',
    preference: 'system',
    fallback: 'light'
  },
  css: ['~/assets/css/main.css'],
  typescript: { strict: true, typeCheck: true },
  nitro: { errorHandler: '~~/server/error.ts' },
  runtimeConfig: {
    // h3 세션 쿠키는 기본값이 secure:true라 로컬 http 개발 환경에서 쿠키가 전송되지 않는다.
    // 관리형 PaaS는 엣지에서 TLS를 종료하므로 프로덕션에서는 그대로 secure:true를 유지한다.
    session: {
      cookie: {
        secure: process.env.NODE_ENV === 'production'
      }
    }
  }
})
