# 리팩터링 진행 상황 보고서

> 이 문서는 `REFACTORING_PLAN.md`를 기준으로 현재까지의 진행 상황과 남은 과제를 추적합니다.

### Phase 1: 아키텍처 기반 구축 (완료)

이 단계의 목표는 **DB 접근을 메인 프로세스로 중앙화**하고, **계층형 아키텍처의 뼈대를 구축**하는 것이었습니다. 이 목표는 성공적으로 달성되었습니다.

-   **[✓] DB 접근 단일화:**
    -   `dataService.js`와 웹 백엔드의 DB 직접 접근 코드를 모두 제거했습니다.
    -   이제 모든 DB 접근은 메인 프로세스의 `Repository` 계층을 통해서만 안전하게 이루어집니다.

-   **[✓] Repository 패턴 도입:**
    -   `userRepository`, `systemSettingsRepository`, `presetRepository` 등 공통 데이터 관리를 위한 저장소 계층을 성공적으로 구현하고 적용했습니다.

-   **[✓] Service 역할 명확화:**
    -   `authService`를 도입하여 모든 인증 로직을 중앙에서 관리하도록 했습니다.
    -   `liveSummaryService` 등 기존 서비스들이 더 이상 직접 DB에 접근하지 않고 Repository에 의존하도록 수정했습니다.

### Phase 1.5: 인증 시스템 현대화 및 안정화 (완료)

1단계에서 구축한 뼈대 위에, 앱의 핵심인 인증 시스템을 더욱 견고하고 사용자 친화적으로 만드는 작업을 완료했습니다.

-   **[✓] 완전한 인증 생명주기 관리:**
    -   `authService`가 Firebase 로그인 시 가상 API 키를 **자동으로 발급/저장**하고, 로그아웃 시 **자동으로 삭제**하는 전체 흐름을 구현했습니다.

-   **[✓] 상태 관리 중앙화 및 전파:**
    -   `authService`가 **유일한 진실의 원천(Single Source of Truth)**이 되어, `isLoggedIn`과 `hasApiKey` 상태를 명확히 구분하여 관리합니다.
    -   `user-state-changed`라는 단일 이벤트를 통해 모든 UI 컴포넌트가 일관된 상태 정보를 받도록 데이터 흐름을 정리했습니다.

-   **[✓] 레거시 코드 제거:**
    -   `windowManager`와 여러 렌더러 파일에 흩어져 있던 레거시 인증 로직, API 키 캐싱, 불필요한 IPC 핸들러들을 모두 제거하여 코드베이스를 깔끔하게 정리했습니다.

-   **[✓] 사용자 경험 최적화:**
    -   로그인 세션을 영속화하여 **자동 로그인**을 구현했으며, 느린 네트워크 요청을 **비동기 백그라운드 처리**하여 UI 반응성을 극대화했습니다.

---

### Phase 2: 기능별 모듈화 및 레거시 코드 완전 제거 (진행 예정)

핵심 아키텍처가 안정화된 지금, 남아있는 기술 부채를 청산하고 앱 전체에 일관된 구조를 적용하는 마지막 단계를 진행합니다.

#### 1. `renderer.js` 책임 분산 및 제거 (최우선 과제)

-   **최종 목표:** 거대 파일 `renderer.js` (1100+줄)를 완전히 제거하여, 각 기능의 UI 로직이 독립적인 모듈에서 관리되도록 합니다.
-   **현황:** 현재 `renderer.js`는 `ask` 기능의 AI 메시지 전송, `listen` 기능의 오디오/스크린 캡처 및 전처리, 상태 관리 등 여러 책임이 복잡하게 얽혀있습니다.
-   **수행 작업:**
    1.  **`ask` 기능 책임 이전:**
        -   `renderer.js`의 `sendMessage`, `PICKLE_GLASS_SYSTEM_PROMPT`, 관련 유틸 함수(`formatRealtimeConversationHistory`, `getCurrentScreenshot` 등)를 `features/ask/askService.js` (또는 유사 모듈)로 이전합니다.
        -   `liveSummaryService.js`의 `save-ask-message` IPC 핸들러 로직을 `features/ask/repositories/askRepository.js`를 사용하는 `askService.js`로 이동시킵니다.
    2.  **`listen` 기능 책임 이전:**
        -   `renderer.js`의 `startCapture`, `stopCapture`, `setupMicProcessing` 등 오디오/스크린 캡처 및 처리 관련 로직을 `features/listen/` 폴더 내의 적절한 파일 (예: `listenView.js` 또는 신규 `listenCaptureService.js`)로 이전합니다.
    3.  **`renderer.js` 최종 제거:**
        -   위 1, 2번 작업이 완료되어 `renderer.js`에 더 이상 의존하는 코드가 없을 때, 이 파일을 프로젝트에서 **삭제**합니다.

#### 2. `listen` 기능 심화 리팩터링

-   **목표:** 거대해진 `liveSummaryService.js`를 단일 책임 원칙에 따라 여러 개의 작은 서비스로 분리하여 유지보수성을 극대화합니다.
-   **수행 작업:**
    -   `sttService.js`: STT 세션 연결 및 데이터 스트리밍을 전담합니다.
    -   `analysisService.js`: STT 텍스트를 받아 AI 모델에게 분석/요약을 요청하는 로직을 전담합니다.
    -   `listenService.js`: 상위 서비스로서, `sttService`와 `analysisService`를 조율하고 전체 "Listen" 기능의 상태를 관리하는 **조정자(Orchestrator)** 역할을 수행합니다.

#### 3. `windowManager` 모듈화

-   **목표:** 비대해진 `windowManager.js`의 책임들을 기능별로 분리하여, 각 모듈이 자신의 창 관련 로직만 책임지도록 구조를 개선합니다.
-   **현황:** 현재 `windowManager.js`는 모든 창의 생성, 위치 계산, 단축키 등록, IPC 핸들링 등 너무 많은 역할을 수행하고 있습니다.
-   **수행 작업:**
    -   **`windowLayoutManager.js`:** 여러 창의 위치를 동적으로 계산하고 배치하는 로직을 분리합니다.
    -   **`shortcutManager.js`:** 전역 단축키를 등록하고 관리하는 로직을 분리합니다.
    -   **`featureWindowManager.js` (가칭):** `ask`, `listen` 등 각 기능 창의 생성/소멸 및 관련 IPC 핸들러를 관리하는 로직을 분리합니다.
    -   `windowManager.js`: 최상위 관리자로서, `header` 창과 각 하위 관리자 모듈을 총괄하는 역할만 남깁니다.

---

### Phase 3: 최종 정리 및 고도화 (향후)

-   **[ ] 전체 기능 회귀 테스트:** 모든 리팩터링 완료 후, 앱의 모든 기능이 의도대로 동작하는지 검증합니다.
-   **[ ] 코드 클린업:** 디버깅용 `console.log`, 불필요한 주석 등을 최종적으로 정리합니다.
-   **[ ] 문서 최신화:** `IPC_CHANNELS.md`를 포함한 모든 관련 문서를 최종 아키텍처에 맞게 업데이트합니다. 