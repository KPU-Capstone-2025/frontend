# Monittoring Frontend

<한국공학대학교 캡스톤> 중소기업 서버 리소스를 모니터링하고, 로그 분석과 알림 임계값 설정을 제공하는 모니또링 서비스의 프론트엔드입니다.

## Tech Stack

- React 19
- Vite
- React Router
- ESLint

## 주요 기능

- 회원가입 및 로그인
- 서버/컨테이너 리소스 대시보드
- CPU, 메모리, 디스크, 네트워크 실시간 차트
- 날짜별 리소스 요약 조회
- 로그 조회 및 AI 로그 분석
- 알림 임계값 설정
- 에이전트 설치 명령어 안내
- 챗봇을 통한 모니터링 질의

## 시작하기

### 1. 저장소 클론

```bash
git clone https://github.com/KPU-Capstone-2025/frontend.git
cd frontend
```

### 2. 패키지 설치

```bash
npm install
```

### 3. 개발 서버 실행

```bash
npm run dev
```

기본 실행 주소는 다음과 같습니다.

```text
http://localhost:5173
```

## 사용 가능한 스크립트

```bash
npm run dev
```

개발 서버를 실행합니다.

```bash
npm run build
```

프로덕션 빌드 파일을 생성합니다.

```bash
npm run preview
```

빌드 결과물을 로컬에서 미리 확인합니다.

```bash
npm run lint
```

ESLint로 코드 규칙을 검사합니다.

## 프로젝트 구조

```text
src
├─ app              # 앱 진입 라우터 설정
├─ assets           # 이미지 등 정적 리소스
├─ components       # 공통 UI 컴포넌트
├─ layouts          # 공용 레이아웃
├─ pages            # 화면 단위 페이지
│  ├─ AgentInstall
│  ├─ Alerts
│  ├─ Auth
│  ├─ Chatbot
│  ├─ Dashboard
│  ├─ Landing
│  ├─ Logs
│  └─ Servers
└─ services         # API 요청, 인증 저장소, mock 데이터
```

## API 연동

`VITE_API_BASE_URL`을 기준으로 백엔드 API를 호출합니다.

주요 연동 경로

- `POST /company/login`
- `POST /company/register`
- `GET /company/agent/{companyId}`
- `GET /dashboard/{companyId}/host`
- `GET /dashboard/container/{companyId}`
- `GET /dashboard/{companyId}/container/{containerName}/metrics`
- `GET /dashboard/{companyId}/metrics/monthly`
- `GET /dashboard/{companyId}/logs`
- `POST /dashboard/logs/analyze`
- `GET /rules/{companyId}`
- `POST /rules/update`
- `GET /servers/{companyId}`
- `POST /chat/ask`
- `GET /chat/history/{monitoringId}`
