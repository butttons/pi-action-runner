import * as core from '@actions/core';
import { runAgent, loadObiSkill } from './agent.js';
import { buildDiscussionSystemPrompt, buildDiscussionPrompt } from './prompt.js';
import type { DiscussionConfig } from './types.js';

export async function runDiscussion({ config }: { config: DiscussionConfig }): Promise<string> {
  const systemPrompt = buildDiscussionSystemPrompt({ config });
  const userPrompt = buildDiscussionPrompt({ config });

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
