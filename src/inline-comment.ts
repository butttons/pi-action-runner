import * as core from '@actions/core';
import { runAgent, loadObiSkill } from './agent.js';
import { buildInlineCommentSystemPrompt, buildInlineCommentPrompt } from './prompt.js';
import type { InlineCommentConfig } from './types.js';

export async function runInlineComment({
  config,
}: {
  config: InlineCommentConfig;
}): Promise<string> {
  const systemPrompt = buildInlineCommentSystemPrompt({ config });
  const userPrompt = buildInlineCommentPrompt({ config });

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
