export function wrapReviewComment({
  body,
  model,
  prNumber,
}: {
  body: string;
  model: string;
  prNumber: number;
}): string {
  return [body, '', '---', `<sub>pi (${model}) | PR #${prNumber}</sub>`].join('\n');
}

export function wrapInlineComment({
  body,
  model,
  prNumber,
  filePath,
}: {
  body: string;
  model: string;
  prNumber: number;
  filePath: string;
}): string {
  return [body, '', '---', `<sub>pi (${model}) | PR #${prNumber} \`${filePath}\`</sub>`].join(
    '\n',
  );
}

export function wrapIssueComment({
  body,
  model,
  issueNumber,
}: {
  body: string;
  model: string;
  issueNumber: number;
}): string {
  return [body, '', '---', `<sub>pi (${model}) | Issue #${issueNumber}</sub>`].join('\n');
}

export function wrapDiscussionComment({
  body,
  model,
  discussionNumber,
}: {
  body: string;
  model: string;
  discussionNumber: number;
}): string {
  return [body, '', '---', `<sub>pi (${model}) | Discussion #${discussionNumber}</sub>`].join(
    '\n',
  );
}
