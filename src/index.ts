import * as core from '@actions/core';
import * as github from '@actions/github';
import { parseComment } from './parse.js';
import { runReview } from './review.js';
import { wrapReviewComment } from './template.js';
import type { ReviewConfig } from './types.js';

async function run(): Promise<void> {
  try {
    const context = github.context;

    if (context.eventName !== 'issue_comment') {
      core.info(`Skipping: event is ${context.eventName}, not issue_comment`);
      return;
    }

    const payload = context.payload;
    if (!payload.comment || !payload.issue?.pull_request) {
      core.info('Skipping: not a PR comment');
      return;
    }

    const parsed = parseComment({ body: payload.comment.body ?? '' });
    if (!parsed) {
      core.info('Skipping: comment does not match @pi <command> pattern');
      return;
    }

    const commenterAssociation = payload.comment.author_association;
    const isOwner = commenterAssociation === 'OWNER' || commenterAssociation === 'MEMBER';
    if (!isOwner) {
      core.info(`Skipping: commenter association is ${commenterAssociation}, not OWNER or MEMBER`);
      return;
    }

    core.info(`Command: ${parsed.command}, Message: ${parsed.message || '(none)'}`);

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GITHUB_TOKEN is required');
    }

    const octokit = github.getOctokit(token);
    const { data: pr } = await octokit.rest.pulls.get({
      ...context.repo,
      pull_number: payload.issue.number,
    });

    const workingDir = process.env.GITHUB_WORKSPACE ?? process.cwd();
    const model = core.getInput('pi_model') || 'openai/gpt-5.3-codex';
    const apiKey = core.getInput('api_key') || '';
    const useDora = core.getInput('use_dora') !== 'false';
    const systemPromptPath = core.getInput('system_prompt') || '';
    const reviewTemplatePath = core.getInput('review_template') || '';
    const extraPrompt = core.getInput('extra_prompt') || '';
    const actionPath = core.getInput('action_path') || '';

    if (!apiKey && !core.getInput('pi_auth')) {
      throw new Error('Either api_key or pi_auth must be provided');
    }

    const reviewConfig: ReviewConfig = {
      prNumber: payload.issue.number,
      baseBranch: pr.base.ref,
      headBranch: pr.head.ref,
      repoOwner: context.repo.owner,
      repoName: context.repo.repo,
      model,
      apiKey,
      extraPrompt,
      message: parsed.message,
      workingDir,
      useDora,
      systemPromptPath,
      reviewTemplatePath,
      actionPath,
    };

    const reviewBody = await runReview({ config: reviewConfig });

    const comment = wrapReviewComment({
      body: reviewBody,
      model,
      prNumber: reviewConfig.prNumber,
    });

    await octokit.rest.issues.createComment({
      ...context.repo,
      issue_number: reviewConfig.prNumber,
      body: comment,
    });

    core.info('Review posted');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(message);
  }
}

run();
