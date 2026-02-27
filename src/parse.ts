import type { ParsedComment, Command } from './types.js';

const VALID_COMMANDS: ReadonlySet<string> = new Set<Command>(['review']);

const PI_MENTION_PATTERN = /^@pi\s+(\S+)(?:\s+(.*))?$/s;

export function parseComment({ body }: { body: string }): ParsedComment | null {
  const trimmed = body.trim();
  const match = trimmed.match(PI_MENTION_PATTERN);

  if (!match) {
    return null;
  }

  const [, rawCommand, rawMessage] = match;

  if (!rawCommand || !VALID_COMMANDS.has(rawCommand)) {
    return null;
  }

  return {
    command: rawCommand as Command,
    message: rawMessage?.trim() ?? '',
  };
}
