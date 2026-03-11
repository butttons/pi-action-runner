import * as core from '@actions/core';
import { runAgent, loadDoraSkill } from './agent.js';
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

  return runAgent({
    config,
    systemPrompt,
    userPrompt: 'Review this pull request.',
    skills,
  });
}
