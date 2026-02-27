/**
 * Review output template.
 *
 * Pi's response must conform to this structure. The prompt enforces it.
 * We wrap it with metadata for the posted comment.
 */
export function wrapReviewComment({
  body,
  model,
  prNumber,
}: {
  body: string;
  model: string;
  prNumber: number;
}): string {
  return [
    body,
    '',
    '---',
    `<sub>Reviewed by pi (${model}) | PR #${prNumber}</sub>`,
  ].join('\n');
}

/**
 * The structured output format pi must produce.
 * Embedded in the prompt as the required output shape.
 */
export const REVIEW_OUTPUT_FORMAT = `## Review

### Summary
<!-- One short paragraph: what does this PR do and why. -->

### Risk Assessment
<!-- Format: **[LOW | MEDIUM | HIGH]** -- one sentence justification. -->

### Issues
<!-- Bulleted list. Each item:
- **[critical | warning | nit]** \`file:line\` -- description
If none, write "No issues found." -->

### Suggestions
<!-- Bulleted list. Each item:
- \`file\` -- suggestion
If none, write "No suggestions." -->

### Architecture
<!-- Only include if the PR changes structure, patterns, or cross-cutting concerns.
One short paragraph. Omit this section entirely if not applicable. -->`;
