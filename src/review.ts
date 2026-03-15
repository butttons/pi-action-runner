import * as core from '@actions/core';
import { runAgent, loadDoraSkill, loadObiSkill } from './agent.js';
import { buildReviewSystemPrompt, loadReviewTemplate } from './prompt.js';
import type { ReviewConfig } from './types.js';

export async function runReview({ config }: { config: ReviewConfig }): Promise<string> {
  const reviewTemplate = loadReviewTemplate({
    reviewTemplatePath: config.reviewTemplatePath,
    workingDir: config.workingDir,
    actionPath: config.actionPath,
  });

  const systemPrompt = buildReviewSystemPrompt({
    baseBranch: config.baseBranch,
    message: config.message,
    extraPrompt: config.extraPrompt,
    useDora: config.useDora,
    systemPromptPath: config.systemPromptPath,
    reviewTemplate,
    workingDir: config.workingDir,
    actionPath: config.actionPath,
    obsidianVaultName: config.obsidianVaultName,
    obsidianPrompt: config.obsidianPrompt,
  });

  const skills = [];
  if (config.useDora) {
    const doraSkill = loadDoraSkill({ workingDir: config.workingDir });
    if (doraSkill) {
      skills.push(doraSkill);
      core.info('Loaded dora skill');
    }
  } else {
    core.info('Dora disabled -- skipping skill load');
  }

  if (config.obsidianVaultName) {
    const obiSkill = loadObiSkill({ actionPath: config.actionPath });
    if (obiSkill) {
      skills.push(obiSkill);
      core.info('Loaded obi skill');
    }
  }

  return runAgent({
    config,
    systemPrompt,
    userPrompt: 'Review this pull request.',
    skills,
  });
}
