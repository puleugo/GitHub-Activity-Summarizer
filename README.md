<p align="center">
  <img src="assets/og-image.png" alt="GitHub Activity Summarizer Open Graph Image" width="100%" />
</p>

# GitHub Activity Summarizer (AI Powered)

![Distant Planetarium Banner](assets/og-image.png)

**GitHub 활동 내역을 월별로 조회하고 Google Gemini AI를 활용하여 요약 회고록을 생성하는 CLI 도구입니다.**

## 📖 소개 (Introduction)

이 프로젝트는 개발자의 GitHub 활동(Commit, Pull Request, Issue 등)을 자동으로 수집하고, 이를 LLM(Large Language Model)인 Google Gemini에게 전달하여 월별 회고록을 작성해주는 도구입니다.

매달 어떤 개발 활동을 했는지 자동으로 정리하여, 연말 회고나 이력서 작성 등에 활용할 수 있는 자료를 만들어줍니다.

## ✨ 주요 기능 (Features)

- **자동 데이터 수집**: GitHub API를 통해 지정된 연도의 월별 활동 데이터를 자동으로 가져옵니다.
- **AI 기반 요약**: 구글 Gemini 모델을 사용하여 단순한 활동 나열이 아닌, 의미 있는 문장으로 요약된 회고록을 생성합니다.
- **Markdown 리포트**: 읽기 좋은 Markdown 형식(`.md`)으로 결과물을 저장합니다.
- **CLI 인터페이스**: 간편한 명령줄 인터페이스를 제공하며, 파라미터로 유연하게 설정을 변경할 수 있습니다.

## 🚀 시작하기 (Getting Started)

### 필요 조건 (Prerequisites)

이 도구를 사용하기 위해서는 다음이 필요합니다:

*   Node.js (v18 이상 권장)
*   **GitHub Personal Access Token**: GitHub API 사용을 위해 필요합니다. (권한: `repo`, `user` 등 기본적인 읽기 권한)
*   **Google Gemini API Key**: AI 요약 생성을 위해 필요합니다. [Google AI Studio](https://aistudio.google.com/)에서 발급받을 수 있습니다.

### 설치 (Installation)

1.  프로젝트를 클론하거나 다운로드합니다.
2.  의존성 패키지를 설치합니다.

```bash
npm install
```

### 환경 변수 설정 (Configuration)

프로젝트 루트 디렉토리에 `.env` 파일을 생성하고 다음 변수들을 설정해주세요.

```bash
# .env 파일 예시

GITHUB_TOKEN=your_github_personal_access_token_here
GEMINI_API_KEY=your_gemini_api_key_here

# 기본 설정 (선택 사항 - CLI 옵션으로 입력하지 않을 경우 사용됨)
GITHUB_USERNAME=your_github_username
YEAR=2024
```

## 💻 사용 방법 (Usage)

### 기본 실행

아래 명령어로 스크립트를 실행할 수 있습니다.

```bash
# CLI 옵션으로 사용자명과 연도 지정
npm start -- -u <username> -y <year>
```

**예시:**

```bash
npm start -- -u limchaesung -y 2024
```

### 옵션 설명 (Options)

| 옵션 | 단축명 | 설명 | 예시 |
| --- | --- | --- | --- |
| `--username` | `-u` | 대상 GitHub 사용자 이름 (필수. .env에 설정되어 있으면 생략 가능) | `-u octocat` |
| `--year` | `-y` | 요약할 대상 연도 (필수. .env에 설정되어 있으면 생략 가능) | `-y 2024` |
| `--output` | `-o` | 결과물이 저장될 파일 경로 (기본값: `summary-{year}-{username}.md`) | `-o my-report.md` |

### 결과물 (Output)

실행이 완료되면, 프로젝트 루트(또는 지정한 경로)에 Markdown 파일이 생성됩니다.

**파일 내용 예시:**

```markdown
# 2024년 limchaesung 회고록

## 2024년 1월
- **주요 활동**: 오픈소스 프로젝트 기여 및 알고리즘 문제 풀이 진행
- **상세 내용**: ... (AI가 생성한 요약 내용) ...

...
```

## 🛠️ 기술 스택 (Tech Stack)

- **Runtime**: Node.js, TypeScript
- **CLI**: Commander.js
- **API**: Octokit (GitHub), Google Generative AI (Gemini)
- **Utils**: Day.js, Dotenv

---
Authored by Lim Chaesung
