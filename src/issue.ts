import * as core from '@actions/core';
import { runAgent, loadObiSkill } from './agent.js';
import { buildIssueSystemPrompt, buildIssuePrompt } from './prompt.js';
import type { IssueConfig } from './types.js';

export async function runIssue({ config }: { config: IssueConfig }): Promise<string> {
  const systemPrompt = buildIssueSystemPrompt({ config });
  const userPrompt = buildIssuePrompt({ config });

  const skills = [];
  if (config.obsidianVaultName) {
    const obiSkill = loadObiSkill({ actionPath: config.actionPath });
    if (obiSkill) {
      skills.push(obiSkill);
      core.info('Loaded obi skill');
    }
  }

  return runAgent({ config, systemPrompt, userPrompt, skills });
}
