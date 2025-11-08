# Vercel 배포 가이드

## 필수 환경변수 설정

Vercel 대시보드에서 다음 환경변수들을 설정해야 합니다:

### 데이터베이스
- `DATABASE_URL` - Neon 데이터베이스 연결 URL
- `POSTGRES_URL` - Neon 데이터베이스 연결 URL (DATABASE_URL과 동일)

### OpenAI
- `OPENAI_API_KEY` - OpenAI API 키

### NextAuth
- `AUTH_SECRET` - NextAuth 시크릿 키 (랜덤 문자열)
- `NEXTAUTH_URL` - 배포된 도메인 URL (예: https://your-app.vercel.app)

### WordPress OAuth (선택사항)
- `WP_SITE_URL` - WordPress 사이트 URL
- `WP_CLIENT_ID` - WordPress OAuth 클라이언트 ID
- `WP_CLIENT_SECRET` - WordPress OAuth 클라이언트 시크릿

### Redis (선택사항 - 스트림 재개 기능용)
- `REDIS_URL` - Redis 연결 URL
- 또는
- `UPSTASH_REDIS_REST_URL` - Upstash Redis REST URL
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis REST 토큰

## 빌드 설정

- **Build Command**: `npm run build` (기본값)
- **Output Directory**: `.next` (기본값)
- **Install Command**: `npm install` (기본값)

## 주의사항

1. **데이터베이스 마이그레이션**: 
   - 빌드 시 자동으로 실행되지 않습니다
   - 배포 후 수동으로 `npm run db:migrate` 실행하거나
   - Vercel의 Build Command에 추가하지 마세요 (빌드 실패 원인)

2. **환경변수**:
   - 모든 환경변수는 Vercel 대시보드에서 설정해야 합니다
   - `.env.local` 파일은 Git에 커밋되지 않으며, Vercel에서는 사용되지 않습니다

3. **Redis**:
   - Redis가 없어도 기본 기능은 정상 작동합니다
   - 스트림 재개 기능만 사용할 수 없습니다

## 배포 후 확인사항

1. 데이터베이스 마이그레이션 실행 확인
2. 환경변수 설정 확인
3. API 엔드포인트 동작 확인
4. AI 채팅 기능 테스트
