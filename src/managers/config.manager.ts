import inquirer from 'inquirer';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

export interface AppConfig {
    GITHUB_USERNAME: string;
    GITHUB_TOKEN: string;
    GEMINI_API_KEY: string;
    YEAR?: string;
    WORKER_SIZE?: string;
}

export class ConfigManager {
    private envPath: string;

    constructor() {
        this.envPath = path.resolve(process.cwd(), '.env');
        dotenv.config({ path: this.envPath });
    }

    async loadOrPrompt(cliYear?: number): Promise<AppConfig> {
        let config: Partial<AppConfig> = {
            GITHUB_USERNAME: process.env.GITHUB_USERNAME,
            GITHUB_TOKEN: process.env.GITHUB_TOKEN,
            GEMINI_API_KEY: process.env.GEMINI_API_KEY,
            YEAR: process.env.YEAR,
            WORKER_SIZE: process.env.WORKER_SIZE
        };

        let isDirty = false;

        // 1. Detect GitHub Username
        if (!config.GITHUB_USERNAME) {
            config.GITHUB_USERNAME = await this.detectGitUsername();
        }
        if (!config.GITHUB_USERNAME) {
            const answer = await inquirer.prompt([{
                type: 'input',
                name: 'username',
                message: 'GitHub 사용자 이름을 입력하세요:',
                validate: (input: string) => input.length > 0 ? true : '사용자 이름은 필수입니다.'
            }]);
            config.GITHUB_USERNAME = answer.username;
            isDirty = true;
        }

        // 2. Detect GitHub Token
        if (!config.GITHUB_TOKEN) {
            config.GITHUB_TOKEN = await this.detectGhToken();
            if (config.GITHUB_TOKEN) {
                console.log('ℹ️  GitHub CLI(gh)에서 인증 정보를 자동으로 가져왔습니다.');
            }
        }
        if (!config.GITHUB_TOKEN) {
            const answer = await inquirer.prompt([{
                type: 'password',
                name: 'token',
                message: 'GitHub Personal Access Token을 입력하세요 (repo 권한 필요):',
                mask: '*',
                validate: (input: string) => input.length > 0 ? true : '토큰은 필수입니다.'
            }]);
            config.GITHUB_TOKEN = answer.token;
            isDirty = true;
        }

        // 3. Prompt for Gemini API Key
        if (!config.GEMINI_API_KEY) {
            console.log('\nℹ️  Google Gemini API Key가 필요합니다.');
            console.log('   (무료로 발급받을 수 있습니다: https://aistudio.google.com/app/apikey#:~:text=API%20키%20만들기)');
            console.log('   (💡 링크를 열면 "API 키 만들기" 버튼이 하이라이트 됩니다!)\n');

            const openBrowser = await this.askYesNo('   발급 페이지를 브라우저에서 여시겠습니까?');

            if (openBrowser) {
                // Highlights "API 키 만들기" or "Create API Key" if possible, but user asked for Korean specific.
                // Using URL encoding for 'API 키 만들기'
                await this.openUrl('https://aistudio.google.com/app/apikey#:~:text=API%20%ED%82%A4%20%EB%A7%8C%EB%93%A4%EA%B8%B0');
            }

            const answer = await inquirer.prompt([{
                type: 'password',
                name: 'apiKey',
                message: 'Google Gemini API Key를 입력하세요:',
                mask: '*',
                validate: (input: string) => input.length > 0 ? true : 'API Key는 필수입니다.'
            }]);
            config.GEMINI_API_KEY = answer.apiKey;
            isDirty = true;
        }

        // 4. Prompt for Year if missing
        if (!config.YEAR) {
            if (cliYear) {
                config.YEAR = String(cliYear);
                isDirty = true;
            } else {
                const currentYear = 2025
                const answer = await inquirer.prompt([{
                    type: 'input',
                    name: 'year',
                    message: `요약할 연도를 입력하세요 (기본값: ${currentYear}):`,
                    default: String(currentYear),
                    validate: (input: string) => /^\d{4}$/.test(input) ? true : '4자리 연도를 입력해주세요.'
                }]);
                config.YEAR = answer.year;
                isDirty = true;
            }
        }

        // 5. Auto-save if dirty
        if (isDirty) {
            await this.saveToEnv(config as AppConfig);
        }

        return config as AppConfig;
    }

    private async detectGitUsername(): Promise<string | undefined> {
        try {
            const { stdout } = await execAsync('git config user.name');
             // This might return "Name Surname", but we usually want the handle. 
             // Actually git config user.name is often the display name.
             // Let's try `gh api user` if gh is available, or just fallback to prompt.
             // But the plan mentioned `git config user.name`. 
             // IMPORTANT: git config user.name is NOT the github handle usually.
             // Let's rely on `gh` mostly or just prompt.
             // Let's try `gh api user --jq .login` first.
             try {
                 const ghUser = await execAsync('gh api user --jq .login');
                 if (ghUser.stdout.trim()) return ghUser.stdout.trim();
             } catch (e) {
                 // gh failed
             }
             
             // If git config user.name is all we have, maybe it's better to just prompt 
             // because it might be "Hong Gil Dong" not "honggildong".
             // Let's skip git config user.name for now as it's unreliable for username/handle.
             return undefined;
        } catch (error) {
            return undefined;
        }
    }

    private async detectGhToken(): Promise<string | undefined> {
        try {
            const { stdout } = await execAsync('gh auth token');
            return stdout.trim();
        } catch (error) {
            return undefined;
        }
    }

    private async openUrl(url: string) {
        let command = '';
        switch (process.platform) {
            case 'darwin':
                command = `open "${url}"`;
                break;
            case 'win32':
                command = `start "${url}"`;
                break;
            default: // linux, etc
                command = `xdg-open "${url}"`;
                break;
        }

        try {
            await execAsync(command);
        } catch (error) {
            console.warn('⚠️  브라우저를 열지 못했습니다. 링크를 직접 클릭해주세요:', url);
        }
    }

    private async saveToEnv(config: AppConfig) {
        let envContent = '';
        try {
            envContent = await fs.readFile(this.envPath, 'utf-8');
        } catch (error) {
            // File doesn't exist, start fresh
        }

        const newEnv = this.updateEnvContent(envContent, config);
        await fs.writeFile(this.envPath, newEnv, 'utf-8');
        console.log('✅ .env 파일이 업데이트되었습니다.');
    }

    private updateEnvContent(content: string, config: AppConfig): string {
        const lines = content.split('\n');
        const keys = ['GITHUB_USERNAME', 'GITHUB_TOKEN', 'GEMINI_API_KEY', 'YEAR'] as const;
        const configMap = new Map<string, string>();
        
        keys.forEach(key => {
            if (config[key]) configMap.set(key, config[key]);
        });

        const newLines: string[] = [];
        const foundKeys = new Set<string>();

        // Update existing lines
        for (const line of lines) {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                if (configMap.has(key)) {
                    newLines.push(`${key}=${configMap.get(key)}`);
                    foundKeys.add(key);
                } else {
                    newLines.push(line);
                }
            } else {
                newLines.push(line);
            }
        }

        // Add missing keys
        configMap.forEach((value, key) => {
            if (!foundKeys.has(key)) {
                if (newLines.length > 0 && newLines[newLines.length - 1] !== '') {
                    newLines.push('');
                }
                newLines.push(`${key}=${value}`);
            }
        });

        return newLines.join('\n');
    }
    private askYesNo(message: string): Promise<boolean> {
        return new Promise((resolve) => {
            process.stdout.write(`${message} (Y/n) `);
            
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(true);
            }
            process.stdin.resume();
            process.stdin.setEncoding('utf8');

            const onData = (data: Buffer | string) => {
                const key = data.toString();
                
                // Ctrl+C
                if (key === '\u0003') { 
                    process.exit(1);
                }
                
                if (key.toLowerCase() === 'y') {
                    process.stdout.write('Yes\n');
                    cleanup();
                    resolve(true);
                } else if (key.toLowerCase() === 'n') {
                    process.stdout.write('No\n');
                    cleanup();
                    resolve(false);
                } 
                // Enter (Default to Yes)
                else if (key === '\r' || key === '\n') {
                    process.stdout.write('Yes\n');
                    cleanup();
                    resolve(true); 
                }
            };

            const cleanup = () => {
                process.stdin.removeListener('data', onData);
                if (process.stdin.isTTY) {
                    process.stdin.setRawMode(false);
                }
                process.stdin.pause();
            };

            process.stdin.on('data', onData);
        });
    }
}
