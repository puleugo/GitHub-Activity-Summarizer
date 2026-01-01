import { Octokit } from "octokit";
import { Activity } from "../types";
import dayjs from "dayjs";

export class GithubService {
    private octokit: Octokit;

    constructor(token?: string) {
        this.octokit = new Octokit({ auth: token });
    }

    async fetchActivitiesByMonth(username: string, year: number, month: number): Promise<Activity[]> {
        const startDate = dayjs(`${year}-${month}-01`).startOf('month').format('YYYY-MM-DD');
        const endDate = dayjs(`${year}-${month}-01`).endOf('month').format('YYYY-MM-DD');

        
        try {
            const [commits, prs, issues] = await Promise.all([
                this.searchCommits(username, startDate, endDate),
                this.searchPRs(username, startDate, endDate),
                this.searchIssues(username, startDate, endDate)
            ]);
    
            const allActivities = [...commits, ...prs, ...issues].sort((a, b) => 
                new Date(a.date).getTime() - new Date(b.date).getTime()
            );
            
            return allActivities;
        } catch (error) {
            // console.error(`Failed to fetch activities for ${year}-${month}:`, error);
            return [];
        }
    }

    private async searchCommits(username: string, start: string, end: string): Promise<Activity[]> {
        const q = `author:${username} committer-date:${start}..${end}`;
        return this.search(q, 'commit', (item: any) => ({
            id: item.sha,
            type: 'commit',
            date: item.commit.author.date,
            title: item.commit.message.split('\n')[0],
            url: item.html_url,
            repo: item.repository.name
        }));
    }

    private async searchPRs(username: string, start: string, end: string): Promise<Activity[]> {
        const q = `author:${username} type:pr created:${start}..${end}`;
        return this.search(q, 'pr', (item: any) => ({
            id: String(item.id),
            type: 'pr',
            date: item.created_at,
            title: item.title,
            url: item.html_url,
            repo: this.extractRepoFromUrl(item.html_url)
        }));
    }

    private async searchIssues(username: string, start: string, end: string): Promise<Activity[]> {
        const q = `author:${username} type:issue created:${start}..${end}`;
        return this.search(q, 'issue', (item: any) => ({
            id: String(item.id),
            type: 'issue',
            date: item.created_at,
            title: item.title,
            url: item.html_url,
            repo: this.extractRepoFromUrl(item.html_url)
        }));
    }

    private async search(q: string, type: 'commit'|'pr'|'issue', mapper: (item: any) => Activity): Promise<Activity[]> {
        const items: Activity[] = [];
        let page = 1;
        const per_page = 100;

        try {
            while (true) {
                let response;
                // Add rate limiting handling or simple retry could be good, but for now basic search
                if (type === 'commit') {
                    response = await this.octokit.rest.search.commits({ q, per_page, page });
                } else {
                    response = await this.octokit.rest.search.issuesAndPullRequests({ q, per_page, page });
                }

                const data = response.data.items;
                items.push(...data.map(mapper));

                if (data.length < per_page || items.length >= 1000) break;
                page++;
                
                // Safety sleep for search api rate limit (30req/min)
                // If we page a lot, we need to sleep.
                if (page > 1) {
                     await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        } catch (error) {
            // console.error(`Error searching ${type}:`, error);
        }

        return items;
    }

    private extractRepoFromUrl(url: string): string {
         // https://github.com/owner/repo/issues/1
         const parts = url.split('/');
         if (parts.length >= 5) {
             return parts[4];
         }
         return 'unknown';
    }
}
