# pi-action-runner

GitHub Action that runs AI-powered automation using [pi](https://github.com/badlogic/pi-mono) and optionally [dora](https://github.com/butttons/dora) for code intelligence.

Mention `@pi` anywhere on GitHub to trigger a response:

| Where | Trigger | What happens |
|---|---|---|
| PR comment | `@pi review` | Structured code review posted on the PR |
| PR file comment | `@pi <question>` | Reads the file in context, replies in the thread |
| Issue | `@pi <question>` | Explores the codebase, replies in the issue |
| Discussion | `@pi <question>` | Explores the codebase, replies in the discussion |

Only repository owners, members, and collaborators can trigger the action.

## Setup

### 1. Add a secret

**Option A: API key (recommended)** -- static, never expires.

Add your provider API key as a repository secret (Settings > Secrets and variables > Actions). For example, `ANTHROPIC_KEY` or `OPENAI_KEY`.

**Option B: pi auth.json** -- uses your local pi OAuth session. May need periodic rotation.

```bash
base64 -i ~/.pi/agent/auth.json | pbcopy
```

Add as `PI_AUTH` secret.

### 2. Add the workflow

```yaml
# .github/workflows/pi.yml
name: Pi
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  issues:
    types: [opened, edited]
  discussion:
    types: [created, edited]
  discussion_comment:
    types: [created]

jobs:
  pi:
    if: |
      contains(github.event.comment.body, '@pi') ||
      contains(github.event.issue.body, '@pi') ||
      contains(github.event.discussion.body, '@pi')
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      issues: write
      discussions: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          ref: >-
            ${{
              github.event.pull_request.head.sha ||
              (github.event.issue.pull_request && format('refs/pull/{0}/merge', github.event.issue.number)) ||
              github.sha
            }}

      - uses: butttons/pi-action-runner@main
        with:
          pi_auth: ${{ secrets.PI_AUTH }}
          # api_key: ${{ secrets.ANTHROPIC_KEY }}
          # pi_model: 'anthropic/claude-sonnet-4'
```

## Usage

### PR review

Comment on any PR:

```
@pi review
```

With additional context:

```
@pi review focus on error handling and edge cases
```

### Inline file comment

On the Files Changed tab of a PR, leave a comment on any line:

```
@pi is this safe to call concurrently?
```

```
@pi what happens if this returns null?
```

The agent reads the full file for context before responding.

### Issue

Mention `@pi` anywhere in an issue body when opening it, or in a follow-up comment:

```
We need to migrate the storage layer to D1.

@pi can you map out what currently exists and what would need to change?
```

The agent explores the codebase and posts a grounded reply.

### Discussion

Mention `@pi` in a discussion body or reply:

```
Thinking about moving all rendering to the edge.

@pi what parts of the codebase would be hardest to migrate and why?
```

## Inputs

| Input | Default | Description |
|---|---|---|
| `api_key` | -- | API key for the model provider. Preferred over `pi_auth`. |
| `pi_auth` | -- | Base64-encoded pi `auth.json`. Fallback when `api_key` is not set. |
| `pi_model` | `opencode-go/kimi-k2.5` | Model in `provider/model-id` format. |
| `use_dora` | `true` | Enable dora code intelligence. |
| `dora_version` | `latest` | Dora CLI version tag. |
| `scip_install` | `bun install -g @sourcegraph/scip-typescript` | SCIP indexer install command. Set to empty string to skip. |
| `dora_pre_index` | -- | Commands to run after `dora init` but before indexing (e.g. install project deps). |
| `dora_index_command` | `dora index` | Override the dora index command. |
| `project_lockfile` | -- | Path to your project lockfile (e.g. `pnpm-lock.yaml`). When set, `node_modules` is cached across runs. |
| `system_prompt` | -- | Path to a custom system prompt for PR reviews (relative to repo root). |
| `review_template` | -- | Path to a custom review output template (relative to repo root). |
| `extra_prompt` | -- | Additional instructions appended to every review prompt. |
| `obsidian_vault_repo` | -- | GitHub repo containing an Obsidian vault (e.g., `owner/repo`). |
| `obsidian_vault_name` | -- | Vault name for `obi --vault` flag (defaults to repo name). |
| `obsidian_token` | -- | GitHub token for private vault repos (defaults to `GITHUB_TOKEN`). |
| `obsidian_prompt` | -- | Additional instructions for using the obsidian vault via `obi` CLI. |

Either `api_key` or `pi_auth` must be provided. When both are set, `api_key` takes precedence.

## Examples

### Monorepo with pnpm

```yaml
- uses: butttons/pi-action-runner@main
  with:
    pi_auth: ${{ secrets.PI_AUTH }}
    project_lockfile: 'pnpm-lock.yaml'
    dora_pre_index: 'pnpm install --frozen-lockfile'
```

### Large codebase (increase Node heap for dora indexing)

```yaml
- uses: butttons/pi-action-runner@main
  with:
    api_key: ${{ secrets.ANTHROPIC_KEY }}
    dora_index_command: 'NODE_OPTIONS="--max-old-space-size=6144" dora index'
```

### Rust project

```yaml
- uses: butttons/pi-action-runner@main
  with:
    api_key: ${{ secrets.API_KEY }}
    scip_install: 'cargo install rust-analyzer'
```

### Python project

```yaml
- uses: butttons/pi-action-runner@main
  with:
    api_key: ${{ secrets.API_KEY }}
    scip_install: 'pip install scip-python'
    dora_pre_index: 'pip install -e .'
```

### Without dora

Uses `git diff`, `grep`, `find`, and direct file reading only. Faster setup, no indexing.

```yaml
- uses: butttons/pi-action-runner@main
  with:
    api_key: ${{ secrets.API_KEY }}
    use_dora: 'false'
```

### With Obsidian vault

Connect an Obsidian vault from another repo to give the agent access to documentation and architecture notes:

```yaml
- uses: butttons/pi-action-runner@main
  with:
    api_key: ${{ secrets.API_KEY }}
    obsidian_vault_repo: 'myorg/documentation'
    obsidian_token: ${{ secrets.VAULT_TOKEN }}  # for private vault repos
    obsidian_prompt: |
      Before making architectural decisions, check the vault for documented patterns.
      Search for relevant docs using `obi search` and read the full notes.
```

The agent can use the `obi` CLI to query the vault:
- `obi map --vault "VaultName"` - see vault structure
- `obi read "path/to/note.md" --vault "VaultName"` - read specific notes
- `obi search "term" --vault "VaultName"` - search content
- `obi query --type worker --vault "VaultName"` - filter by frontmatter type

### Different model

```yaml
- uses: butttons/pi-action-runner@main
  with:
    api_key: ${{ secrets.ANTHROPIC_KEY }}
    pi_model: 'anthropic/claude-sonnet-4'
```

## Customizing prompts

### PR review

The system prompt and output template for PR reviews are fully replaceable. Defaults are in [`prompts/`](./prompts/):

- [`prompts/system-dora.md`](./prompts/system-dora.md) -- used when dora is enabled
- [`prompts/system-git.md`](./prompts/system-git.md) -- used when dora is disabled
- [`prompts/review-template.md`](./prompts/review-template.md) -- output structure

Point the inputs to your own files:

```yaml
- uses: butttons/pi-action-runner@main
  with:
    api_key: ${{ secrets.API_KEY }}
    system_prompt: '.github/review-prompt.md'
    review_template: '.github/review-template.md'
```

Use `{base_branch}` in your system prompt -- it gets replaced with the PR's target branch (e.g. `main`).

### Inline comments, issues, discussions

Drop a markdown file in `.pi/prompts/` in your repo to override the default system prompt for each handler:

| File | Overrides |
|---|---|
| `.pi/prompts/inline-comment.md` | Inline PR file comment handler |
| `.pi/prompts/issue.md` | Issue handler |
| `.pi/prompts/discussion.md` | Discussion handler |

## Caching

The action caches the following automatically:

| What | Cache key |
|---|---|
| Bun binary | Managed by `setup-bun` |
| Action `node_modules` | Hash of `bun.lock` |
| dora + scip globals (`~/.bun`) | dora version + scip install command |
| Dora index (`.dora/`) | Commit SHA -- busted on every new commit |
| Project `node_modules` | Hash of `project_lockfile` -- only when `project_lockfile` is set |
| Obsidian vault (`.pi-vault/`) | Vault repo + commit SHA |

On a warm run (same commit, same deps), only the dora agent itself runs -- all installs and indexing are skipped.

## How it works

1. Validates the commenter is a repo owner, member, or collaborator.
2. Routes based on the GitHub event:
   - `issue_comment` on a PR → `@pi review` triggers a full review
   - `pull_request_review_comment` → reads the file, replies to the thread
   - `issues` / `issue_comment` on a plain issue → explores codebase, replies in the issue
   - `discussion` / `discussion_comment` → explores codebase, replies in the discussion
3. If dora is enabled: installs dora + SCIP indexer (cached), runs `dora init` + `dora index` (cached per commit).
4. Runs the pi agent with bash and read tools. The agent uses dora commands, `git diff`, `grep`, `find`, and direct file reading to gather context.
5. Posts the response via the appropriate GitHub API (REST for PRs/issues, GraphQL for discussions).

## Requirements

- GitHub Actions runner: `ubuntu-latest`
- One of: a provider API key or a base64-encoded pi `auth.json`

## License

MIT
