import * as core from '@actions/core';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  AuthStorage,
  createAgentSession,
  createExtensionRuntime,
  createBashTool,
  createReadTool,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  type ResourceLoader,
  type Skill,
} from '@mariozechner/pi-coding-agent';
import { buildReviewSystemPrompt, loadReviewTemplate } from './prompt.js';
import type { ReviewConfig } from './types.js';

function loadDoraSkill({ workingDir }: { workingDir: string }): Skill | null {
  const skillPath = join(workingDir, '.dora', 'docs', 'SKILL.md');
  if (!existsSync(skillPath)) {
    core.warning('Dora SKILL.md not found -- agent will use dora without skill guidance');
    return null;
  }

  return {
    name: 'dora',
    description: 'Query codebase using dora CLI for code intelligence, symbol definitions, dependencies, and architectural analysis',
    filePath: skillPath,
    baseDir: join(workingDir, '.dora', 'docs'),
    source: 'action',
    disableModelInvocation: false,
  };
}

export async function runReview({ config }: { config: ReviewConfig }): Promise<string> {
  const [providerName, modelId] = parseModelString({ model: config.model });

  core.info(`Using model: ${providerName}/${modelId}`);

  const authStorage = AuthStorage.create();
  const modelRegistry = new ModelRegistry(authStorage);

  const model = modelRegistry.find(providerName, modelId);
  if (!model) {
    throw new Error(`Model not found: ${providerName}/${modelId}`);
  }

  const reviewTemplate = loadReviewTemplate({
    reviewTemplatePath: config.reviewTemplatePath,
    workingDir: config.workingDir,
    actionPath: config.actionPath,
  });

  const systemPrompt = buildReviewSystemPrompt({
    baseBranch: config.baseBranch,
    message: config.message,
    extraPrompt: config.extraPrompt,
    useDora: config.useDora,
    systemPromptPath: config.systemPromptPath,
    reviewTemplate,
    workingDir: config.workingDir,
    actionPath: config.actionPath,
  });

  const skills: Skill[] = [];
  if (config.useDora) {
    const doraSkill = loadDoraSkill({ workingDir: config.workingDir });
    if (doraSkill) {
      skills.push(doraSkill);
      core.info('Loaded dora skill');
    }
  } else {
    core.info('Dora disabled -- skipping skill load');
  }

  const settingsManager = SettingsManager.inMemory({
    compaction: { enabled: false },
    retry: { enabled: true, maxRetries: 3 },
  });

  const resourceLoader: ResourceLoader = {
    getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
    getSkills: () => ({ skills, diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => systemPrompt,
    getAppendSystemPrompt: () => [],
    getPathMetadata: () => new Map(),
    extendResources: () => {},
    reload: async () => {},
  };

  const { session } = await createAgentSession({
    cwd: config.workingDir,
    model,
    thinkingLevel: 'medium',
    authStorage,
    modelRegistry,
    resourceLoader,
    tools: [
      createReadTool(config.workingDir),
      createBashTool(config.workingDir),
    ],
    sessionManager: SessionManager.inMemory(),
    settingsManager,
  });

  let finalResponse = '';
  let currentToolName = '';

  session.subscribe((event) => {
    switch (event.type) {
      case 'turn_start':
        core.info('--- Turn started ---');
        break;

      case 'tool_execution_start':
        currentToolName = event.toolName;
        core.startGroup(`Tool: ${event.toolName}`);
        if (event.toolName === 'bash') {
          core.info(`Command: ${formatArgs({ args: event.args })}`);
        } else if (event.toolName === 'read') {
          core.info(`File: ${formatArgs({ args: event.args })}`);
        }
        break;

      case 'tool_execution_end':
        if (event.isError) {
          core.warning(`Tool ${event.toolName} failed`);
        }
        // Log truncated result for visibility
        const resultText = extractToolResultText({ result: event.result });
        if (resultText) {
          const truncated = resultText.length > 500
            ? resultText.slice(0, 500) + '... (truncated)'
            : resultText;
          core.info(truncated);
        }
        core.endGroup();
        currentToolName = '';
        break;

      case 'message_update':
        if (event.assistantMessageEvent.type === 'text_delta') {
          // Accumulate final response text
          finalResponse += event.assistantMessageEvent.delta;
        }
        break;

      case 'turn_end':
        core.info('--- Turn ended ---');
        break;
    }
  });

  core.startGroup('Running pi review agent');
  await session.prompt('Review this pull request.');
  core.endGroup();

  session.dispose();

  return finalResponse;
}

function parseModelString({ model }: { model: string }): [string, string] {
  const slashIndex = model.indexOf('/');
  if (slashIndex === -1) {
    return ['anthropic', model];
  }
  return [model.slice(0, slashIndex), model.slice(slashIndex + 1)];
}

function formatArgs({ args }: { args: Record<string, unknown> }): string {
  if ('command' in args && typeof args.command === 'string') {
    return args.command;
  }
  if ('path' in args && typeof args.path === 'string') {
    return args.path;
  }
  return JSON.stringify(args);
}

function extractToolResultText({ result }: { result: unknown }): string {
  if (!result || typeof result !== 'object') {
    return String(result ?? '');
  }

  // Tool results have { content: [{ type: "text", text: "..." }] }
  const r = result as Record<string, unknown>;
  if (Array.isArray(r.content)) {
    return r.content
      .filter((c: Record<string, unknown>) => c.type === 'text' && typeof c.text === 'string')
      .map((c: Record<string, unknown>) => c.text as string)
      .join('\n');
  }

  return JSON.stringify(result);
}
