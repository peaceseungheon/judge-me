import 'dotenv/config'
import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'node',
    // 통합 테스트가 하나의 로컬 Postgres를 공유하므로, 파일 단위 병렬 실행 시
    // 서로 다른 테스트 파일의 제출물/큐 데이터가 태그 매칭 큐에서 뒤섞인다.
    fileParallelism: false
  }
})
