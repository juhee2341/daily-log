# daily-log 브랜드 가이드 (웹)

한 시간씩 같이 남기는 기록 서비스. 별명은 "델로그". 정식 표기는 `daily-log`(영문), "데일리로그"(한글).

## 파일
- `tokens.css`: 컬러 CSS 변수. 사이트 전역 스타일에 import.
- `logo-wordmark.svg`: 밝은 배경용 로고타입 (글자는 윤곽선이라 폰트 불필요).
- `logo-wordmark-on-dark.svg`: 어두운 배경용.
- `favicon.svg`: 파비콘 (검정 둥근 타일에 d와 하이픈). 작은 크기에서도 읽히게 단순화.
- `favicon-32.png`, `apple-touch-icon.png`(180), `icon-512.png`: 래스터 아이콘.

## 로고 규칙
- 로고타입은 Fraunces 600 `daily-log`. 하이픈만 둥근 알약(테라코타 `#B96750`)으로 바꿈. 글자는 검정 `#1C1917`.
- 어두운 배경에서는 글자 `#FAF6F1`, 알약 `#D98B73`.
- 아이콘은 d + 알약 하이픈. d 모노그램을 "dl"처럼 만들지 말 것(이미 폐기).
- 헤더 로고 높이는 24~32px 권장.

## 컬러 역할
| 역할 | 값 | 용도 |
|---|---|---|
| 글자 | `#1C1917` | 제목, 본문 |
| 보조 글자 | `#5C5650` | 설명, 시간 |
| 강조 | `#263D50` | 링크, 선택, 배지, 포커스 링 |
| 로고 | `#B96750` | 로고, 큰 도형. **글자로 쓰지 않음** |
| 버튼 | `#A5563F` | 버튼 배경. 글자는 흰색 |
| 배경 | `#FAF6F1` | 페이지 |
| 카드 / 선 | `#FFFFFF` / `#E5DBD0` | 카드 면, 구분선 |
| 연한 면 | `#F3E3DC` | 배지, 안내 상자 (글자는 검정) |

원칙: 글자는 검정, 강조는 네이비, 테라코타는 로고와 버튼 면에만.

## 적용 체크리스트
1. `tokens.css`를 import하고 하드코딩된 색을 변수로 교체.
2. `<head>`에 파비콘 연결:
   ```html
   <link rel="icon" href="/favicon.svg" type="image/svg+xml">
   <link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
   <link rel="apple-touch-icon" href="/apple-touch-icon.png">
   <meta name="theme-color" content="#FAF6F1">
   ```
3. 헤더에 `logo-wordmark.svg` 사용 (`<img alt="daily-log">`).
4. 링크는 `--color-accent`, 버튼은 `--color-button` + `--color-on-button`.
5. 텍스트 대비 4.5:1 이상 유지.

## 이 저장소에 적용한 방식
- 토큰: `src/app/tokens.css`. Tailwind·shadcn 변수와 이름이 겹쳐서(`--color-accent`, `--color-border` 등) **`--dl-` 접두사**로 옮겼다. 값은 원본과 같다.
- shadcn 의미 변수 연결 (`src/app/globals.css`): `primary` = 버튼, `secondary` = 연한 면(배지·안내 상자), `ring` = 네이비, `muted` = 선 색을 배경에 섞은 중립 면(스켈레톤·비활성 탭).
- 추가 유틸리티: `highlight`(네이비 — 선택된 탭·칩, 진행 막대, 텍스트 링크), `brand`(테라코타 — 큰 도형 전용).
- 아이콘: `public/` (favicon.svg·favicon-32·apple-touch-icon·icon-192·icon-512). 안드로이드 maskable용 `icon-maskable-512.png`는 배경을 꽉 채우고 마크를 안전 영역 안에 줄여 새로 만들었다.
- 로고: `<Logo />` (`src/components/brand/Logo.tsx`) — 홈 헤더 30px, 초대 화면 24px.
- 본문 글꼴은 아직 시스템 글꼴(iOS는 Apple SD 산돌고딕). Noto Sans KR은 목업용 임시 글꼴이라 적용하지 않았다.
