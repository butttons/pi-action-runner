import * as core from '@actions/core';
import { runAgent, loadDoraSkill, loadObiSkill } from './agent.js';
import { buildPrQuestionSystemPrompt, buildPrQuestionPrompt } from './prompt.js';
import type { PrQuestionConfig } from './types.js';

export async function runPrQuestion({
  config,
}: {
  config: PrQuestionConfig;
}): Promise<string> {
  const systemPrompt = buildPrQuestionSystemPrompt({ config });
  const userPrompt = buildPrQuestionPrompt({ config });

  const skills = [];
  if (config.obsidianVaultName) {
    const obiSkill = loadObiSkill({ actionPath: config.actionPath });
    if (obiSkill) {
      skills.push(obiSkill);
      core.info('Loaded obi skill');
    }
  } else {
    // PR questions benefit from code intelligence when available.
    const doraSkill = loadDoraSkill({ workingDir: config.workingDir });
    if (doraSkill) {
      skills.push(doraSkill);
      core.info('Loaded dora skill');
    }
  }

  return runAgent({ config, systemPrompt, userPrompt, skills });
}
