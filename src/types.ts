export type ActivityType = 'commit' | 'pr' | 'issue';

export interface Activity {
    id: string;
    type: ActivityType;
    date: string; // ISO 8601
    title: string; // Commit message or PR/Issue title
    url: string;
    repo: string; // repo name
}

export interface MonthlySummary {
    month: number;
    activities: Activity[];
    summary?: string;
}
