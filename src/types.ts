export type Command = 'review' | 'comment' | 'issue' | 'discussion';

export type ParsedTrigger =
  | { command: 'review'; message: string }
  | { command: 'comment'; message: string }
  | { command: 'issue'; message: string }
  | { command: 'discussion'; message: string };

export type BaseConfig = {
  repoOwner: string;
  repoName: string;
  model: string;
  apiKey: string;
  workingDir: string;
  actionPath: string;
  obsidianVaultName: string;
  obsidianPrompt: string;
};

export type ReviewConfig = BaseConfig & {
  prNumber: number;
  baseBranch: string;
  headBranch: string;
  extraPrompt: string;
  message: string;
  useDora: boolean;
  systemPromptPath: string;
  reviewTemplatePath: string;
};

export type InlineCommentConfig = BaseConfig & {
  prNumber: number;
  baseBranch: string;
  commentId: number;
  commentBody: string;
  filePath: string;
  diffHunk: string;
  line: number | null;
  message: string;
};

export type IssueConfig = BaseConfig & {
  issueNumber: number;
  issueTitle: string;
  issueBody: string;
  commentBody: string | null;
  message: string;
};

export type DiscussionConfig = BaseConfig & {
  discussionNumber: number;
  discussionTitle: string;
  discussionBody: string;
  commentBody: string | null;
  discussionNodeId: string;
  commentNodeId: string | null;
  message: string;
};
