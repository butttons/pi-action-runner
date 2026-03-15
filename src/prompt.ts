import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { InlineCommentConfig, IssueConfig, DiscussionConfig } from './types.js';

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

export function loadReviewTemplate({
  reviewTemplatePath,
  workingDir,
  actionPath,
}: {
  reviewTemplatePath: string;
  workingDir: string;
  actionPath: string;
}): string {
  if (reviewTemplatePath) {
    return readFileSync(join(workingDir, reviewTemplatePath), 'utf-8');
  }
  return readFileSync(join(actionPath, 'prompts', 'review-template.md'), 'utf-8');
}

export function buildReviewSystemPrompt({
  baseBranch,
  message,
  extraPrompt,
  useDora,
  systemPromptPath,
  reviewTemplate,
  workingDir,
  actionPath,
  obsidianVaultName,
  obsidianPrompt,
}: {
  baseBranch: string;
  message: string;
  extraPrompt: string;
  useDora: boolean;
  systemPromptPath: string;
  reviewTemplate: string;
  workingDir: string;
  actionPath: string;
  obsidianVaultName: string;
  obsidianPrompt: string;
}): string {
  let basePrompt: string;

  if (systemPromptPath) {
    basePrompt = readFileSync(join(workingDir, systemPromptPath), 'utf-8');
  } else {
    const defaultFile = useDora ? 'system-dora.md' : 'system-git.md';
    basePrompt = readFileSync(join(actionPath, 'prompts', defaultFile), 'utf-8');
  }

  basePrompt = basePrompt.replaceAll('{base_branch}', baseBranch);

  const sections = [basePrompt];

  if (message) {
    sections.push('', '## Reviewer Instructions', message);
  }

  if (extraPrompt) {
    sections.push('', '## Additional Context', extraPrompt);
  }

  maybeAddObsidianSection({
    sections,
    vaultName: obsidianVaultName,
    prompt: obsidianPrompt,
  });

  sections.push(
    '',
    '## Output',
    '',
    'After gathering all context, output ONLY this markdown. Nothing else.',
    '',
    reviewTemplate,
  );

  return sections.join('\n');
}

function maybeAddObsidianSection({
  sections,
  vaultName,
  prompt,
}: {
  sections: string[];
  vaultName: string;
  prompt: string;
}): void {
  if (!vaultName) return;

  sections.push(
    '',
    '## Obsidian Vault Access',
    '',
    `You have access to an Obsidian vault named: ${vaultName}`,
    '',
    'Use the `obi` CLI tool to query documentation, architecture notes, and project conventions.',
    'Common commands:',
    `- \`obi map --vault "${vaultName}"\` - see vault structure`,
    `- \`obi read "path/to/note.md" --vault "${vaultName}"\` - read a note`,
    `- \`obi search "term" --vault "${vaultName}"\` - search content`,
    `- \`obi query --type worker --vault "${vaultName}"\` - filter by frontmatter type`,
    '',
    `Always use --vault "${vaultName}" in obi commands.`,
  );

  if (prompt) {
    sections.push('', '## Vault Usage Instructions', prompt);
  }
}

// ---------------------------------------------------------------------------
// Inline comment
// ---------------------------------------------------------------------------

export function buildInlineCommentSystemPrompt({
  config,
}: {
  config: InlineCommentConfig;
}): string {
  const customPath = join(config.workingDir, '.pi', 'prompts', 'inline-comment.md');
  if (existsSync(customPath)) {
    return readFileSync(customPath, 'utf-8');
  }

  const sections = [
    'You are a precise code assistant responding to an inline comment left on a pull request.',
    '',
    '## Context',
    '',
    `File: \`${config.filePath}\``,
    `PR: #${config.prNumber}`,
    `Base branch: \`${config.baseBranch}\``,
    '',
    '## Diff hunk',
    '```diff',
    config.diffHunk,
    '```',
    '',
    '## Comment',
    config.commentBody,
    '',
    '## Workflow',
    '',
    '1. Read the full file at `' + config.filePath + '` to understand the complete context.',
    '2. Use `grep -rn` or `find` to trace any references to symbols touched in the diff hunk.',
    '3. Only then answer the comment.',
    '',
    '## Rules',
    '',
    '- Answer directly and concisely. No preamble.',
    '- Base every claim on code you have read.',
    '- No speculation.',
    '- If the comment asks for a change, explain whether it is safe and what the impact would be.',
    '- Keep the reply short enough to fit a GitHub comment.',
  ];

  if (config.message) {
    sections.push('', '## Additional instructions from reviewer', config.message);
  }

  maybeAddObsidianSection({
    sections,
    vaultName: config.obsidianVaultName,
    prompt: config.obsidianPrompt,
  });

  return sections.join('\n');
}

export function buildInlineCommentPrompt({ config }: { config: InlineCommentConfig }): string {
  return config.commentBody;
}

// ---------------------------------------------------------------------------
// Issue
// ---------------------------------------------------------------------------

export function buildIssueSystemPrompt({ config }: { config: IssueConfig }): string {
  const customPath = join(config.workingDir, '.pi', 'prompts', 'issue.md');
  if (existsSync(customPath)) {
    return readFileSync(customPath, 'utf-8');
  }

  const sections = [
    'You are a technical assistant helping the repository owner gather context and think through work described in a GitHub issue.',
    '',
    '## Your job',
    '',
    'Read the issue, explore the codebase to understand the current state of things, and write a reply that:',
    '- Summarises what exists in the codebase relevant to the issue.',
    '- Identifies any blockers, dependencies, or risks.',
    '- Outlines concrete next steps if applicable.',
    '- Answers any explicit questions in the issue.',
    '',
    '## Issue',
    '',
    `Title: ${config.issueTitle}`,
    `Number: #${config.issueNumber}`,
    '',
    config.issueBody,
  ];

  if (config.commentBody) {
    sections.push('', '## Triggering comment', '', config.commentBody);
  }

  if (config.message) {
    sections.push('', '## Additional instructions', config.message);
  }

  maybeAddObsidianSection({
    sections,
    vaultName: config.obsidianVaultName,
    prompt: config.obsidianPrompt,
  });

  sections.push(
    '',
    '## Rules',
    '',
    '- Ground every claim in code you have actually read.',
    '- No speculation.',
    '- Be concise. Use bullet points and code references where helpful.',
    '- Do not repeat the issue back verbatim.',
    '- Output only your reply, ready to post as a GitHub comment.',
  );

  return sections.join('\n');
}

export function buildIssuePrompt({ config }: { config: IssueConfig }): string {
  return `Investigate the codebase and reply to issue #${config.issueNumber}: "${config.issueTitle}".`;
}

// ---------------------------------------------------------------------------
// Discussion
// ---------------------------------------------------------------------------

export function buildDiscussionSystemPrompt({ config }: { config: DiscussionConfig }): string {
  const customPath = join(config.workingDir, '.pi', 'prompts', 'discussion.md');
  if (existsSync(customPath)) {
    return readFileSync(customPath, 'utf-8');
  }

  const sections = [
    'You are a technical assistant contributing to a GitHub Discussion.',
    '',
    '## Your job',
    '',
    'Read the discussion, explore any relevant parts of the codebase, and write a reply that contributes meaningfully.',
    'Match the tone of the discussion -- if it is exploratory, be exploratory; if it asks for concrete answers, give them.',
    '',
    '## Discussion',
    '',
    `Title: ${config.discussionTitle}`,
    `Number: #${config.discussionNumber}`,
    '',
    config.discussionBody,
  ];

  if (config.commentBody) {
    sections.push('', '## Triggering comment', '', config.commentBody);
  }

  if (config.message) {
    sections.push('', '## Additional instructions', config.message);
  }

  maybeAddObsidianSection({
    sections,
    vaultName: config.obsidianVaultName,
    prompt: config.obsidianPrompt,
  });

  sections.push(
    '',
    '## Rules',
    '',
    '- Ground claims in code or documentation you have read.',
    '- Be concise and direct.',
    '- Do not repeat what has already been said.',
    '- Output only your reply, ready to post as a GitHub Discussion comment.',
  );

  return sections.join('\n');
}

export function buildDiscussionPrompt({ config }: { config: DiscussionConfig }): string {
  return `Read the discussion "#${config.discussionTitle}" and contribute a reply.`;
}
