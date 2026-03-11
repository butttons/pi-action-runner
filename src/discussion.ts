import { runAgent } from './agent.js';
import { buildDiscussionSystemPrompt, buildDiscussionPrompt } from './prompt.js';
import type { DiscussionConfig } from './types.js';

export async function runDiscussion({ config }: { config: DiscussionConfig }): Promise<string> {
  const systemPrompt = buildDiscussionSystemPrompt({ config });
  const userPrompt = buildDiscussionPrompt({ config });

  return runAgent({ config, systemPrompt, userPrompt });
}
