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
