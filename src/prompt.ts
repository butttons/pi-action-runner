import { readFileSync } from 'fs';
import { join } from 'path';

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
}: {
  baseBranch: string;
  message: string;
  extraPrompt: string;
  useDora: boolean;
  systemPromptPath: string;
  reviewTemplate: string;
  workingDir: string;
  actionPath: string;
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
    sections.push(
      '',
      '## Reviewer Instructions',
      message,
    );
  }

  if (extraPrompt) {
    sections.push(
      '',
      '## Additional Context',
      extraPrompt,
    );
  }

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
