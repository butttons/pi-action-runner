import { runAgent } from './agent.js';
import { buildInlineCommentSystemPrompt, buildInlineCommentPrompt } from './prompt.js';
import type { InlineCommentConfig } from './types.js';

export async function runInlineComment({
  config,
}: {
  config: InlineCommentConfig;
}): Promise<string> {
  const systemPrompt = buildInlineCommentSystemPrompt({ config });
  const userPrompt = buildInlineCommentPrompt({ config });

  return runAgent({ config, systemPrompt, userPrompt });
}
