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
    `<sub>pi (${model}) | PR #${prNumber}</sub>`,
  ].join('\n');
}

export const REVIEW_OUTPUT_FORMAT = `## Review

### Summary
<!-- One sentence: what this PR does. -->

### Risk
<!-- **LOW** | **MEDIUM** | **HIGH** -- one sentence why. -->

### Issues
<!-- Each item is one line:
- **critical** \`file.ts:42\` -- description
- **warning** \`file.ts:17\` -- description
- **nit** \`file.ts:5\` -- description
Write "None." if clean. -->

### Suggestions
<!-- Each item is one line:
- \`file.ts\` -- suggestion
Write "None." if nothing worth suggesting. -->

### Architecture
<!-- One sentence if the PR changes structure or cross-cutting patterns. Omit entirely if not applicable. -->`;
