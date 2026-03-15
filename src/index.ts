import * as core from '@actions/core';
import * as github from '@actions/github';
import { parseReviewTrigger, parseMentionTrigger, containsPiMention } from './parse.js';
import { runReview } from './review.js';
import { runInlineComment } from './inline-comment.js';
import { runIssue } from './issue.js';
import { runDiscussion } from './discussion.js';
import {
  wrapReviewComment,
  wrapInlineComment,
  wrapIssueComment,
  wrapDiscussionComment,
} from './template.js';
import type { ReviewConfig, InlineCommentConfig, IssueConfig, DiscussionConfig } from './types.js';

type Octokit = ReturnType<typeof github.getOctokit>;

function getBaseInputs() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is required');

  const model = core.getInput('pi_model') || 'opencode-go/kimi-k2.5';
  const apiKey = core.getInput('api_key') || '';
  const actionPath = core.getInput('action_path') || '';
  const workingDir = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const obsidianVaultName = process.env.INPUT_OBSIDIAN_VAULT_NAME || '';
  const obsidianPrompt = process.env.INPUT_OBSIDIAN_PROMPT || '';

  if (!apiKey && !core.getInput('pi_auth')) {
    throw new Error('Either api_key or pi_auth must be provided');
  }

  return { token, model, apiKey, actionPath, workingDir, obsidianVaultName, obsidianPrompt };
}

function isOwnerOrMember({ association }: { association: string }): boolean {
  return association === 'OWNER' || association === 'MEMBER' || association === 'COLLABORATOR';
}

// ---------------------------------------------------------------------------
// issue_comment on a PR -> review or inline (PR-level comment only)
// ---------------------------------------------------------------------------

async function handlePrComment({ octokit }: { octokit: Octokit }): Promise<void> {
  const payload = github.context.payload;
  const comment = payload.comment;

  if (!comment?.body) {
    core.info('Skipping: no comment body');
    return;
  }

  if (!isOwnerOrMember({ association: comment.author_association ?? '' })) {
    core.info(`Skipping: author_association is ${comment.author_association}`);
    return;
  }

  const { token, model, apiKey, actionPath, workingDir, obsidianVaultName, obsidianPrompt } = getBaseInputs();
  const octokit2 = github.getOctokit(token);
  const ctx = github.context;

  // Try @pi review first
  const reviewTrigger = parseReviewTrigger({ body: comment.body });
  if (reviewTrigger) {
    core.info(`Trigger: review | message: ${reviewTrigger.message || '(none)'}`);

    await octokit2.rest.reactions.createForIssueComment({
      ...ctx.repo,
      comment_id: comment.id,
      content: 'eyes',
    });

    const issueNumber: number = payload.issue?.number ?? 0;

    const { data: pr } = await octokit2.rest.pulls.get({
      ...ctx.repo,
      pull_number: issueNumber,
    });

    const reviewConfig: ReviewConfig = {
      prNumber: issueNumber,
      baseBranch: pr.base.ref,
      headBranch: pr.head.ref,
      repoOwner: ctx.repo.owner,
      repoName: ctx.repo.repo,
      model,
      apiKey,
      extraPrompt: core.getInput('extra_prompt') || '',
      message: reviewTrigger.message,
      workingDir,
      useDora: core.getInput('use_dora') !== 'false',
      systemPromptPath: core.getInput('system_prompt') || '',
      reviewTemplatePath: core.getInput('review_template') || '',
      actionPath,
      obsidianVaultName,
      obsidianPrompt,
    };

    const body = await runReview({ config: reviewConfig });
    const wrapped = wrapReviewComment({ body, model, prNumber: reviewConfig.prNumber });

    await octokit2.rest.issues.createComment({
      ...ctx.repo,
      issue_number: reviewConfig.prNumber,
      body: wrapped,
    });

    core.info('Review posted');
    return;
  }

  core.info('Skipping: PR comment does not match @pi review pattern');
}

// ---------------------------------------------------------------------------
// pull_request_review_comment -> inline comment on a file
// ---------------------------------------------------------------------------

async function handleInlineComment({ octokit }: { octokit: Octokit }): Promise<void> {
  const payload = github.context.payload;
  const comment = payload.comment;

  if (!comment?.body) {
    core.info('Skipping: no comment body');
    return;
  }

  if (!containsPiMention({ body: comment.body })) {
    core.info('Skipping: no @pi mention');
    return;
  }

  if (!isOwnerOrMember({ association: comment.author_association ?? '' })) {
    core.info(`Skipping: author_association is ${comment.author_association}`);
    return;
  }

  const trigger = parseMentionTrigger({ body: comment.body, command: 'comment' });
  if (!trigger) {
    core.info('Skipping: could not parse mention trigger');
    return;
  }

  const { token, model, apiKey, actionPath, workingDir, obsidianVaultName, obsidianPrompt } = getBaseInputs();
  const octokit2 = github.getOctokit(token);
  const ctx = github.context;

  await octokit2.rest.reactions.createForPullRequestReviewComment({
    ...ctx.repo,
    comment_id: comment.id,
    content: 'eyes',
  });

  const prNumber: number = payload.pull_request?.number ?? payload.issue?.number ?? 0;

  const { data: pr } = await octokit2.rest.pulls.get({
    ...ctx.repo,
    pull_number: prNumber,
  });

  const inlineConfig: InlineCommentConfig = {
    prNumber,
    baseBranch: pr.base.ref,
    commentId: comment.id,
    commentBody: comment.body,
    filePath: comment.path ?? '',
    diffHunk: comment.diff_hunk ?? '',
    line: comment.line ?? comment.original_line ?? null,
    message: trigger.message,
    repoOwner: ctx.repo.owner,
    repoName: ctx.repo.repo,
    model,
    apiKey,
    workingDir,
    actionPath,
    obsidianVaultName,
    obsidianPrompt,
  };

  core.info(`Trigger: comment | file: ${inlineConfig.filePath} | message: ${trigger.message || '(none)'}`);

  const body = await runInlineComment({ config: inlineConfig });
  const wrapped = wrapInlineComment({
    body,
    model,
    prNumber,
    filePath: inlineConfig.filePath,
  });

  await octokit2.rest.pulls.createReplyForReviewComment({
    ...ctx.repo,
    pull_number: prNumber,
    comment_id: comment.id,
    body: wrapped,
  });

  core.info('Inline comment reply posted');
}

// ---------------------------------------------------------------------------
// issues (opened / edited) or issue_comment (on a plain issue)
// ---------------------------------------------------------------------------

async function handleIssue({ octokit }: { octokit: Octokit }): Promise<void> {
  const payload = github.context.payload;
  const ctx = github.context;

  // Determine the trigger body and whether we're on an issue comment or the issue itself
  const isIssueComment = ctx.eventName === 'issue_comment';
  const triggerBody: string = isIssueComment
    ? (payload.comment?.body ?? '')
    : (payload.issue?.body ?? '');

  if (!containsPiMention({ body: triggerBody })) {
    core.info('Skipping: no @pi mention');
    return;
  }

  const association: string = isIssueComment
    ? (payload.comment?.author_association ?? '')
    : (payload.issue?.author_association ?? '');

  if (!isOwnerOrMember({ association })) {
    core.info(`Skipping: author_association is ${association}`);
    return;
  }

  const trigger = parseMentionTrigger({ body: triggerBody, command: 'issue' });
  if (!trigger) {
    core.info('Skipping: could not parse mention trigger');
    return;
  }

  const { token, model, apiKey, actionPath, workingDir, obsidianVaultName, obsidianPrompt } = getBaseInputs();
  const octokit2 = github.getOctokit(token);

  // React on the comment or the issue itself
  if (isIssueComment && payload.comment?.id) {
    await octokit2.rest.reactions.createForIssueComment({
      ...ctx.repo,
      comment_id: payload.comment.id,
      content: 'eyes',
    });
  }

  const issue = payload.issue;
  const issueConfig: IssueConfig = {
    issueNumber: issue?.number ?? 0,
    issueTitle: issue?.title ?? '',
    issueBody: issue?.body ?? '',
    commentBody: isIssueComment ? (payload.comment?.body ?? null) : null,
    message: trigger.message,
    repoOwner: ctx.repo.owner,
    repoName: ctx.repo.repo,
    model,
    apiKey,
    workingDir,
    actionPath,
    obsidianVaultName,
    obsidianPrompt,
  };

  core.info(`Trigger: issue #${issueConfig.issueNumber} | message: ${trigger.message || '(none)'}`);

  const body = await runIssue({ config: issueConfig });
  const wrapped = wrapIssueComment({ body, model, issueNumber: issueConfig.issueNumber });

  await octokit2.rest.issues.createComment({
    ...ctx.repo,
    issue_number: issueConfig.issueNumber,
    body: wrapped,
  });

  core.info('Issue reply posted');
}

// ---------------------------------------------------------------------------
// discussion or discussion_comment
// ---------------------------------------------------------------------------

async function handleDiscussion({ octokit }: { octokit: Octokit }): Promise<void> {
  const payload = github.context.payload;
  const ctx = github.context;

  const isDiscussionComment = ctx.eventName === 'discussion_comment';
  const triggerBody: string = isDiscussionComment
    ? (payload.comment?.body ?? '')
    : (payload.discussion?.body ?? '');

  if (!containsPiMention({ body: triggerBody })) {
    core.info('Skipping: no @pi mention');
    return;
  }

  // Discussions don't have author_association on the payload in the same way;
  // we trust the workflow-level `if:` condition to gate this.

  const trigger = parseMentionTrigger({ body: triggerBody, command: 'discussion' });
  if (!trigger) {
    core.info('Skipping: could not parse mention trigger');
    return;
  }

  const { token, model, apiKey, actionPath, workingDir, obsidianVaultName, obsidianPrompt } = getBaseInputs();
  const octokit2 = github.getOctokit(token);

  const discussion = payload.discussion;
  const discussionConfig: DiscussionConfig = {
    discussionNumber: discussion.number,
    discussionTitle: discussion.title ?? '',
    discussionBody: discussion.body ?? '',
    commentBody: isDiscussionComment ? (payload.comment?.body ?? null) : null,
    discussionNodeId: discussion.node_id ?? '',
    commentNodeId: isDiscussionComment ? (payload.comment?.node_id ?? null) : null,
    message: trigger.message,
    repoOwner: ctx.repo.owner,
    repoName: ctx.repo.repo,
    model,
    apiKey,
    workingDir,
    actionPath,
    obsidianVaultName,
    obsidianPrompt,
  };

  core.info(`Trigger: discussion #${discussionConfig.discussionNumber} | message: ${trigger.message || '(none)'}`);

  const body = await runDiscussion({ config: discussionConfig });
  const wrapped = wrapDiscussionComment({
    body,
    model,
    discussionNumber: discussionConfig.discussionNumber,
  });

  // GitHub Discussions require the GraphQL API to post comments
  await postDiscussionComment({
    octokit: octokit2,
    discussionNodeId: discussionConfig.discussionNodeId,
    replyToNodeId: discussionConfig.commentNodeId,
    body: wrapped,
  });

  core.info('Discussion reply posted');
}

async function postDiscussionComment({
  octokit,
  discussionNodeId,
  replyToNodeId,
  body,
}: {
  octokit: Octokit;
  discussionNodeId: string;
  replyToNodeId: string | null;
  body: string;
}): Promise<void> {
  if (replyToNodeId) {
    // Reply to a specific comment in the discussion
    await octokit.graphql(
      `mutation AddDiscussionComment($discussionId: ID!, $replyToId: ID!, $body: String!) {
        addDiscussionComment(input: {
          discussionId: $discussionId,
          replyToId: $replyToId,
          body: $body
        }) {
          comment { id }
        }
      }`,
      { discussionId: discussionNodeId, replyToId: replyToNodeId, body },
    );
  } else {
    // Top-level comment on the discussion
    await octokit.graphql(
      `mutation AddDiscussionComment($discussionId: ID!, $body: String!) {
        addDiscussionComment(input: {
          discussionId: $discussionId,
          body: $body
        }) {
          comment { id }
        }
      }`,
      { discussionId: discussionNodeId, body },
    );
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error('GITHUB_TOKEN is required');

    const octokit = github.getOctokit(token);
    const { eventName, payload } = github.context;

    core.info(`Event: ${eventName}`);

    // PR-level comment -> review
    if (eventName === 'issue_comment' && payload.issue?.pull_request) {
      await handlePrComment({ octokit });
      return;
    }

    // Inline PR file comment
    if (eventName === 'pull_request_review_comment') {
      await handleInlineComment({ octokit });
      return;
    }

    // Issue opened/edited body contains @pi, OR a comment on a plain issue
    if (
      (eventName === 'issues' && !payload.issue?.pull_request) ||
      (eventName === 'issue_comment' && !payload.issue?.pull_request)
    ) {
      await handleIssue({ octokit });
      return;
    }

    // Discussion created/edited or a discussion comment
    if (eventName === 'discussion' || eventName === 'discussion_comment') {
      await handleDiscussion({ octokit });
      return;
    }

    core.info(`Skipping: unhandled event ${eventName}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(message);
  }
}

run();
