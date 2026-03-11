import type { ParsedTrigger } from './types.js';

// Matches "@pi review [optional message]" -- only valid on PR comments
const REVIEW_PATTERN = /^@pi\s+review(?:\s+(.*))?$/is;

// Matches "@pi [optional message]" -- general trigger for all other contexts
const MENTION_PATTERN = /^@pi(?:\s+(.*))?$/is;

export function parseReviewTrigger({ body }: { body: string }): ParsedTrigger | null {
  const trimmed = body.trim();
  const match = trimmed.match(REVIEW_PATTERN);
  if (!match) return null;
  return { command: 'review', message: match[1]?.trim() ?? '' };
}

export function parseMentionTrigger({
  body,
  command,
}: {
  body: string;
  command: 'comment' | 'issue' | 'discussion';
}): ParsedTrigger | null {
  const trimmed = body.trim();

  // If it starts with "@pi review" it's not a general mention
  if (REVIEW_PATTERN.test(trimmed)) return null;

  const match = trimmed.match(MENTION_PATTERN);
  if (!match) return null;

  return { command, message: match[1]?.trim() ?? '' };
}

export function containsPiMention({ body }: { body: string }): boolean {
  return /@pi\b/i.test(body);
}
