import { Command } from 'commander';
import { GithubService } from './services/github.service';
import { AIService } from './services/ai.service';
import * as cliProgress from 'cli-progress';
import * as fs from 'fs/promises';
import { ConfigManager } from './managers/config.manager';

const program = new Command();

program
  .name('github-summary')
  .description('GitHub 활동 내역을 기반으로 월별 요약 생성')
  .option('-u, --username <username>', 'GitHub 사용자 이름')
  .option('-y, --year <year>', '요약할 연도', (value) => parseInt(value, 10))
  // .option('-y, --year <year>', '요약할 연도', (value) => parseInt(value, 10), process.env.YEAR ? parseInt(process.env.YEAR, 10) : undefined) 
  // -> ConfigManager handles default year logic if needed, but for now let's keep CLI arg priority logic simple in action.
  .option('-o, --output <output>', '출력 파일 경로')
  .action(async (options) => {
    try {
        const configManager = new ConfigManager();
        const config = await configManager.loadOrPrompt(options.year);

        let { username, year, output } = options;

        // 1. Username priority: CLI arg -> Config -> Error
        if (!username) {
            username = config.GITHUB_USERNAME;
        }

        if (!username) {
            // Should be unreachable due to ConfigManager prompt but safe guard
            console.error("오류: GitHub 사용자 이름을 찾을 수 없습니다.");
            process.exit(1);
        }
        
        // 2. Year priority: CLI arg -> Config(env) -> Current Year
        if (!year) {
            if (config.YEAR) {
                year = parseInt(config.YEAR, 10);
            } else {
                 console.log("연도가 지정되지 않아 2025년으로 설정되었습니다.");
                 year = 2025
            }
        }

        const githubToken = config.GITHUB_TOKEN;
        const geminiApiKey = config.GEMINI_API_KEY;

        if (!githubToken || !geminiApiKey) {
            // Should be unreachable
            console.error("오류: 필수 설정이 누락되었습니다.");
            process.exit(1);
        }
        
        // Worker Size Configuration
        const workerSize = parseInt(config.WORKER_SIZE || '6', 10);

        const githubService = new GithubService(githubToken);
        const aiService = new AIService(geminiApiKey);

        // Initialize MultiBar
        const multibar = new cliProgress.MultiBar({
            clearOnComplete: false,
            hideCursor: true,
            format: ' {bar} | {month} | {status} | {value}/{total}'
        }, cliProgress.Presets.shades_grey);

        console.log(`${year}년 ${username}님에 대한 비동기 요약 생성을 시작합니다... (동시 작업 수: ${workerSize})`);

        const months = Array.from({ length: 12 }, (_, i) => i + 1);
        const bars: Map<number, cliProgress.SingleBar> = new Map();

        // Create bars for all months
        months.forEach(m => {
            const bar = multibar.create(100, 0, { month: `${m}월`, status: '대기 중' });
            bars.set(m, bar);
        });

        const processSingleMonth = async (m: number) => {
            const bar = bars.get(m);
            if (!bar) return { month: m, summary: null };

            // Step 1: Fetching
            bar.update(10, { status: 'Github 데이터 수집 중' });
            const activities = await githubService.fetchActivitiesByMonth(username, year, m);
            
            bar.update(50, { status: `활동 ${activities.length}개 발견` });

            if (activities.length === 0) {
                    bar.update(100, { status: '활동 없음' });
                return { month: m, summary: null };
            }

            // Step 2: Summarizing
            bar.update(60, { status: 'AI 회고록 생성 중' });
            const summary = await aiService.generateMonthlySummary(m, activities);
            
            bar.update(100, { status: '완료' });
            return { month: m, summary };
        };

        const batchSize = workerSize;
        const finalResults: { month: number, summary: string | null }[] = [];

        for (let i = 0; i < months.length; i += batchSize) {
            const batch = months.slice(i, i + batchSize);
            const batchPromises = batch.map(m => processSingleMonth(m));
            const batchResults = await Promise.all(batchPromises);
            finalResults.push(...batchResults);
        }
        
        finalResults.sort((a, b) => a.month - b.month);

        let markdownContent = `# ${year}년 ${username} 회고록\n\n`;

        for (const res of finalResults) {
            if (!res.summary) continue;
            const monthSection = `## ${year}년 ${res.month}월\n${res.summary}\n\n`;
            markdownContent += monthSection;
        }

        const finalOutputPath = output || `summary-${year}-${username}.md`;
        await fs.writeFile(finalOutputPath, markdownContent, 'utf-8');
        
        multibar.stop();
        console.log(`\n✅ 완료! 요약 파일이 생성되었습니다: ${finalOutputPath}`);

    } catch (error) {
        // multibar might not be defined if error happens early, but if it is we should stop it
        // hard to access multibar here cleanly without moving declarations up. 
        // For now simple console error.
        console.error("오류 발생:", error);
        process.exit(1);
    }
  });

program.parse(process.argv);
