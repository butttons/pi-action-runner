export type Command = 'review';

export type ParsedComment = {
  command: Command;
  message: string;
};

export type ReviewConfig = {
  prNumber: number;
  baseBranch: string;
  headBranch: string;
  repoOwner: string;
  repoName: string;
  model: string;
  extraPrompt: string;
  message: string;
  workingDir: string;
  useDora: boolean;
  systemPromptPath: string;
  reviewTemplatePath: string;
  actionPath: string;
};
