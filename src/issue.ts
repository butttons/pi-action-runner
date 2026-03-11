import { runAgent } from './agent.js';
import { buildIssueSystemPrompt, buildIssuePrompt } from './prompt.js';
import type { IssueConfig } from './types.js';

export async function runIssue({ config }: { config: IssueConfig }): Promise<string> {
  const systemPrompt = buildIssueSystemPrompt({ config });
  const userPrompt = buildIssuePrompt({ config });

  return runAgent({ config, systemPrompt, userPrompt });
}
