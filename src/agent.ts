import * as core from '@actions/core';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  createAgentSession,
  createBashTool,
  createReadTool,
  DefaultResourceLoader,
  getAgentDir,
  ModelRuntime,
  SessionManager,
  SettingsManager,
  type Skill,
  type ResourceDiagnostic,
} from '@earendil-works/pi-coding-agent';
import type { BaseConfig } from './types.js';

type RunAgentParams = {
  config: BaseConfig;
  systemPrompt: string;
  userPrompt: string;
  skills?: Skill[];
};

function parseModelString({ model }: { model: string }): [string, string] {
  const slashIndex = model.indexOf('/');
  if (slashIndex === -1) {
    return ['anthropic', model];
  }
  return [model.slice(0, slashIndex), model.slice(slashIndex + 1)];
}

function formatArgs({ args }: { args: Record<string, unknown> }): string {
  if ('command' in args && typeof args.command === 'string') return args.command;
  if ('path' in args && typeof args.path === 'string') return args.path;
  return JSON.stringify(args);
}

function extractToolResultText({ result }: { result: unknown }): string {
  if (!result || typeof result !== 'object') return String(result ?? '');
  const r = result as Record<string, unknown>;
  if (Array.isArray(r.content)) {
    return r.content
      .filter((c: Record<string, unknown>) => c.type === 'text' && typeof c.text === 'string')
      .map((c: Record<string, unknown>) => c.text as string)
      .join('\n');
  }
  return JSON.stringify(result);
}

function extractFinalResponse({ session }: { session: { getLastAssistantText: () => string | undefined; messages: unknown } }): string {
  const last = session.getLastAssistantText();
  if (last && last.trim()) return last;

  // Fallback: scan raw messages for the last assistant text block
  const messages = session.messages as readonly unknown[];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as { role?: string; content?: unknown[] } | undefined;
    if (!msg || msg.role !== 'assistant' || !Array.isArray(msg.content)) continue;

    const textParts = (msg.content as Array<{ type?: string; text?: string }>)
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text as string);

    if (textParts.length > 0 && textParts.join('\n').trim()) return textParts.join('\n');
  }

  core.warning('No assistant text found in session messages');
  return '';
}

export function loadDoraSkill({ workingDir }: { workingDir: string }): Skill | null {
  const skillPath = join(workingDir, '.dora', 'docs', 'SKILL.md');
  if (!existsSync(skillPath)) {
    core.warning('Dora SKILL.md not found -- agent will proceed without dora skill guidance');
    return null;
  }
  return {
    name: 'dora',
    description:
      'Query codebase using dora CLI for code intelligence, symbol definitions, dependencies, and architectural analysis',
    filePath: skillPath,
    baseDir: join(workingDir, '.dora', 'docs'),
    sourceInfo: {
      path: skillPath,
      source: 'action',
      scope: 'project',
      origin: 'top-level',
      baseDir: join(workingDir, '.dora', 'docs'),
    },
    disableModelInvocation: false,
  };
}

export function loadObiSkill({ actionPath }: { actionPath: string }): Skill | null {
  const skillPath = join(actionPath, 'skills', 'obi', 'SKILL.md');
  if (!existsSync(skillPath)) {
    core.warning('Obi SKILL.md not found -- agent will proceed without obi skill guidance');
    return null;
  }
  return {
    name: 'obi',
    description:
      'Query Obsidian vaults via obi CLI for documentation, architecture notes, and project conventions',
    filePath: skillPath,
    baseDir: join(actionPath, 'skills', 'obi'),
    sourceInfo: {
      path: skillPath,
      source: 'action',
      scope: 'project',
      origin: 'top-level',
      baseDir: join(actionPath, 'skills', 'obi'),
    },
    disableModelInvocation: false,
  };
}

export async function runAgent({
  config,
  systemPrompt,
  userPrompt,
  skills = [],
}: RunAgentParams): Promise<string> {
  const [providerName, modelId] = parseModelString({ model: config.model });
  core.info(`Using model: ${providerName}/${modelId}`);

  const modelRuntime = await ModelRuntime.create();
  if (config.apiKey) {
    await modelRuntime.setRuntimeApiKey(providerName, config.apiKey);
  }
  const model = modelRuntime.getModel(providerName, modelId);
  if (!model) throw new Error(`Model not found: ${providerName}/${modelId}`);

  const agentDir = getAgentDir();
  core.info(`Agent directory: ${agentDir}`);

  // Use SettingsManager.create to read from ~/.pi/agent/settings.json
  const settingsManager = SettingsManager.create(config.workingDir, agentDir);

  // Merge manually loaded skills (dora, obi) with package skills
  const skillsOverride = (result: { skills: Skill[]; diagnostics: ResourceDiagnostic[] }) => {
    const mergedSkills = [...result.skills, ...skills];
    if (skills.length > 0) {
      core.info(`Merged ${skills.length} manually loaded skills with ${result.skills.length} package skills`);
    }
    return { skills: mergedSkills, diagnostics: result.diagnostics };
  };

  const resourceLoader = new DefaultResourceLoader({
    cwd: config.workingDir,
    agentDir,
    settingsManager,
    systemPrompt,
    skillsOverride,
  });
  await resourceLoader.reload();

  // Check loaded extensions
  const extensionsResult = resourceLoader.getExtensions();
  if (extensionsResult.extensions.length > 0) {
    core.info(`Loaded ${extensionsResult.extensions.length} extensions:`);
    for (const ext of extensionsResult.extensions) {
      core.info(`  - ${ext.path} (${ext.tools.size} tools)`);
      for (const toolName of ext.tools.keys()) {
        core.info(`      * ${toolName}`);
      }
    }
  } else {
    core.info('No extensions loaded');
  }
  if (extensionsResult.errors.length > 0) {
    core.warning(`Extension errors: ${extensionsResult.errors.map(e => e.error).join(', ')}`);
  }

  // Log all skills (manual + packages)
  const allSkills = resourceLoader.getSkills().skills;
  if (allSkills.length > 0) {
    core.info(`Total skills available: ${allSkills.length}`);
    for (const skill of allSkills) {
      core.info(`  - ${skill.name}: ${skill.description.slice(0, 80)}...`);
    }
  }

  const { session } = await createAgentSession({
    cwd: config.workingDir,
    model,
    thinkingLevel: 'medium',
    modelRuntime,
    resourceLoader,
    tools: ['read', 'bash'],
    sessionManager: SessionManager.inMemory(),
    settingsManager,
  });

  session.subscribe((event) => {
    switch (event.type) {
      case 'turn_start':
        core.info('--- Turn started ---');
        break;
      case 'tool_execution_start':
        core.startGroup(`Tool: ${event.toolName}`);
        if (event.toolName === 'bash') core.info(`Command: ${formatArgs({ args: event.args })}`);
        else if (event.toolName === 'read') core.info(`File: ${formatArgs({ args: event.args })}`);
        else core.info(`Args: ${formatArgs({ args: event.args })}`);
        break;
      case 'tool_execution_end':
        if (event.isError) core.warning(`Tool ${event.toolName} failed`);
        const resultText = extractToolResultText({ result: event.result });
        if (resultText) {
          const truncated =
            resultText.length > 500 ? resultText.slice(0, 500) + '... (truncated)' : resultText;
          core.info(truncated);
        }
        core.endGroup();
        break;
      case 'turn_end':
        core.info('--- Turn ended ---');
        break;
    }
  });

  // Durable run: retry transient failures / empty responses so the action
  // almost never ends with nothing to post.
  const maxAttempts = 3;
  let lastError: unknown = null;
  let finalResponse = '';

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        core.startGroup(`Running pi agent (attempt ${attempt}/${maxAttempts})`);
        await session.prompt(userPrompt);
        core.endGroup();

        finalResponse = extractFinalResponse({ session });
        if (finalResponse.trim()) return finalResponse;

        core.warning(`Attempt ${attempt}: agent returned empty response`);
        lastError = new Error('Agent returned an empty response');
      } catch (error) {
        core.endGroup();
        const message = error instanceof Error ? error.message : String(error);
        core.warning(`Attempt ${attempt} failed: ${message}`);
        lastError = error;
      }
    }
  } finally {
    session.dispose();
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'Agent failed'));
}
