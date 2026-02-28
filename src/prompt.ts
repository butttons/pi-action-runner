import { REVIEW_OUTPUT_FORMAT } from './template.js';

function buildDoraWorkflow({ baseBranch }: { baseBranch: string }): string[] {
  return [
    '## Workflow',
    '',
    'Gather context in this order. Do ALL steps before writing the review.',
    '',
    '1. `git diff origin/' + baseBranch + '...HEAD -- . ":!*.lock" ":!*lock.json"` -- read the full diff.',
    '2. `dora changes origin/' + baseBranch + '` -- see changed files and impacted files.',
    '3. `dora map` -- get a high-level codebase overview.',
    '4. For each changed file:',
    '   - `dora file <path>` -- symbols, dependencies, dependents.',
    '   - `dora rdeps <path> --depth 2` -- what breaks if this file is wrong.',
    '5. For any symbol you need to understand better: `dora refs <symbol>`.',
    '6. Read specific files or sections only when the diff alone is insufficient.',
    '7. If the project has docs: `dora docs search <relevant term>`.',
  ];
}

function buildGitWorkflow({ baseBranch }: { baseBranch: string }): string[] {
  return [
    '## Workflow',
    '',
    'Gather context in this order. Do ALL steps before writing the review.',
    '',
    '1. `git diff origin/' + baseBranch + '...HEAD -- . ":!*.lock" ":!*lock.json"` -- read the full diff.',
    '2. `git diff origin/' + baseBranch + '...HEAD --name-only` -- list all changed files.',
    '3. For each changed file, read it to understand the full context around the changes.',
    '4. Use `grep -rn` or `find` to trace references, callers, and dependents of changed functions, types, or exports.',
    '5. Check for broken imports, missing updates to callers, or inconsistent type usage across the codebase.',
    '6. Read test files related to changed code if they exist.',
  ];
}

export function buildReviewSystemPrompt({
  baseBranch,
  message,
  extraPrompt,
  useDora,
}: {
  baseBranch: string;
  message: string;
  extraPrompt: string;
  useDora: boolean;
}): string {
  const workflow = useDora
    ? buildDoraWorkflow({ baseBranch })
    : buildGitWorkflow({ baseBranch });

  const sections = [
    'You are a senior code reviewer. Your job is to find real bugs, security holes, and design mistakes in a pull request.',
    '',
    ...workflow,
    '',
    '## Rules',
    '',
    '- Only report issues you can justify with evidence from the code.',
    '- No speculation about things outside the diff unless you can show concrete impact.',
    '- Reference exact file and line numbers from the diff.',
    '- One sentence per issue. No explanations unless the bug is non-obvious.',
    '- Do not comment on style, formatting, naming, or documentation.',
    '- Do not praise the code.',
    '- Do not suggest things that are "nice to have". Only flag things that are wrong or risky.',
    '- If the PR is clean, say so. Do not invent issues.',
  ];

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
    REVIEW_OUTPUT_FORMAT,
  );

  return sections.join('\n');
}
