import { GoogleGenerativeAI } from "@google/generative-ai";
import { Activity } from "../types";

export class AIService {
    private genAI: GoogleGenerativeAI;
    private model: any;

    private readonly SYSTEM_PROMPT = `
당신은 개발자의 회고록 작성을 돕는 AI 어시스턴트입니다.
주어진 Github 활동 내역을 바탕으로 해당 월의 "핵심 작업 및 성과"를 요약해 주세요.

규칙:
1. 한국어로 작성하세요.
2. 단순히 커밋 메시지를 나열하지 말고, 어떤 작업을 했는지 의미 있는 단위로 그룹화하여 설명하세요.
3. 가능하다면 저장소(Repository) 별로 나누어 정리해도 좋습니다.
4. 기술적인 성취나 중요한 버그 수정, 새로운 기능 구현 등을 강조하세요.
5. 문체는 "~함", "~했음" 등의 개조식이나 깔끔한 문장으로 작성하세요.
6. 각 작업 설명 시 해당 작업이 수행된 프로젝트명(Repository 이름)을 명시하거나 포함시켜 설명하세요.
`;

    constructor(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ 
            model: "gemini-3-flash-preview",
            systemInstruction: this.SYSTEM_PROMPT
        });
    }

    async generateMonthlySummary(month: number, activities: Activity[]): Promise<string> {
        if (activities.length === 0) {
            return "활동 내역이 없습니다.";
        }

        const prompt = this.createPrompt(month, activities);
        
        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error("Error generating summary:", error);
            // Fallback error message or handling
            return "요약 생성 중 오류가 발생했습니다. (API Error)";
        }
    }

    private createPrompt(month: number, activities: Activity[]): string {
        const activitiesText = activities.map(a => 
            `- [${a.type.toUpperCase()}] ${a.title} (Repo: ${a.repo})`
        ).join("\n");

        return `
다음은 ${month}월의 Github 활동 내역입니다.

활동 내역:
${activitiesText}
`;
    }
}
