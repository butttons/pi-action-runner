# pi-action-runner

GitHub Action that runs AI-powered PR reviews using [pi](https://github.com/badlogic/pi-mono) and optionally [dora](https://github.com/butttons/dora) for code intelligence.

Comment `@pi review` on a PR to trigger a structured code review posted as a reply.

## Setup

### Option A: API key (recommended)

Use a static API key from your provider. Does not expire.

1. Add your API key as a repository secret named `API_KEY` (Settings > Secrets and variables > Actions).
2. Add the workflow:

```yaml
# .github/workflows/pi-review.yml
name: Pi Review
on:
  issue_comment:
    types: [created]

jobs:
  review:
    if: github.event.issue.pull_request && startsWith(github.event.comment.body, '@pi ')
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      issues: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          ref: refs/pull/${{ github.event.issue.number }}/merge

      - uses: butttons/pi-action-runner@v0
        with:
          api_key: ${{ secrets.API_KEY }}
```

### Option B: pi auth.json (fallback)

Use your local pi auth file. OAuth tokens rotate automatically, so the secret may need periodic updates.

```bash
base64 -i ~/.pi/agent/auth.json | pbcopy
```

Add as `PI_AUTH` secret, then:

```yaml
      - uses: butttons/pi-action-runner@v0
        with:
          pi_auth: ${{ secrets.PI_AUTH }}
```

## Usage

Comment on any PR:

```
@pi review
```

With additional context:

```
@pi review focus on error handling and edge cases
```

Only repository owners and members can trigger reviews.

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `api_key` | No | -- | API key for the model provider. Preferred auth method. |
| `pi_auth` | No | -- | Base64-encoded pi `auth.json`. Fallback if `api_key` is not set. |
| `pi_model` | No | `openai/gpt-4.1` | Model in `provider/model-id` format |
| `use_dora` | No | `true` | Enable dora code intelligence. Set to `false` to skip dora entirely. |
| `dora_version` | No | `latest` | Dora CLI release version |
| `scip_install` | No | `bun install -g @sourcegraph/scip-typescript` | SCIP indexer install command. Empty string to skip. |
| `dora_pre_index` | No | -- | Commands to run after `dora init` but before indexing (e.g. install project deps) |
| `dora_index_command` | No | `dora index` | Override the index command |
| `system_prompt` | No | -- | Path to a custom system prompt file (relative to repo root). See [Customizing prompts](#customizing-prompts). |
| `review_template` | No | -- | Path to a custom review output template file (relative to repo root). See [Customizing prompts](#customizing-prompts). |
| `extra_prompt` | No | -- | Additional instructions appended to every review |

Either `api_key` or `pi_auth` must be provided. When both are set, `api_key` takes precedence.

The `dora_version`, `scip_install`, `dora_pre_index`, and `dora_index_command` inputs are ignored when `use_dora` is `false`.

## Examples

### With dora (default)

**TypeScript/JavaScript** (no extra config needed):

```yaml
- uses: butttons/pi-action-runner@v0
  with:
    api_key: ${{ secrets.API_KEY }}
```

**Rust**:

```yaml
- uses: butttons/pi-action-runner@v0
  with:
    api_key: ${{ secrets.API_KEY }}
    scip_install: 'cargo install rust-analyzer'
```

**Python**:

```yaml
- uses: butttons/pi-action-runner@v0
  with:
    api_key: ${{ secrets.API_KEY }}
    scip_install: 'pip install scip-python'
    dora_pre_index: 'pip install -e .'
```

**Skip the SCIP indexer** (dora still provides file-level analysis):

```yaml
- uses: butttons/pi-action-runner@v0
  with:
    api_key: ${{ secrets.API_KEY }}
    scip_install: ''
```

### Without dora

Uses `git diff`, `grep`, `find`, and file reading for context gathering. No dora install, indexing, or SCIP tooling required.

```yaml
- uses: butttons/pi-action-runner@v0
  with:
    api_key: ${{ secrets.API_KEY }}
    use_dora: 'false'
```

### Different model

```yaml
- uses: butttons/pi-action-runner@v0
  with:
    api_key: ${{ secrets.ANTHROPIC_KEY }}
    pi_model: 'anthropic/claude-sonnet-4'
```

## Customizing prompts

The system prompt and review output template are fully replaceable. Default files are in [`prompts/`](./prompts/):

- [`prompts/system-dora.md`](./prompts/system-dora.md) -- default system prompt when dora is enabled
- [`prompts/system-git.md`](./prompts/system-git.md) -- default system prompt when dora is disabled
- [`prompts/review-template.md`](./prompts/review-template.md) -- default review output structure

To customize, copy a default file into your repo and point the input to it:

```yaml
- uses: butttons/pi-action-runner@v0
  with:
    api_key: ${{ secrets.API_KEY }}
    system_prompt: '.github/review-prompt.md'
    review_template: '.github/review-template.md'
```

### System prompt

Use `{base_branch}` anywhere in your prompt -- it gets replaced with the PR's target branch (e.g. `main`).

When `system_prompt` is set, it replaces the entire default prompt. The `use_dora` toggle has no effect on the prompt content in this case -- you control everything.

The `extra_prompt` input and the per-review comment message are still appended after your custom prompt.

### Review template

The review template defines the markdown structure the agent outputs. It gets appended to the system prompt under an "Output" heading with instructions to produce only that format.

## How it works

1. Validates the commenter is a repo owner/member.
2. If dora is enabled: installs dora CLI and the SCIP indexer, runs `dora init`, optional pre-index setup, then `dora index`.
3. Runs pi with bash and read tools. With dora, the agent uses `git diff`, `dora changes`, `dora file`, `dora rdeps`, and other dora commands. Without dora, it uses `git diff`, `grep`, `find`, and direct file reading.
4. Posts a structured review comment on the PR.

Each step logs to GitHub Actions output for full visibility into the review process.

## Review output

The default review template produces this structure:

- **Summary** -- what the PR does and why.
- **Risk Assessment** -- LOW, MEDIUM, or HIGH with justification.
- **Issues** -- bugs, security, correctness problems with severity and file locations.
- **Suggestions** -- improvements worth considering.
- **Architecture** -- structural concerns, only when applicable.

Override with `review_template` to use your own format.

## Requirements

- GitHub Actions runner: `ubuntu-latest`
- One of: `API_KEY` secret (static API key) or `PI_AUTH` secret (base64 pi auth.json)
- With dora enabled (default): the action installs bun, dora (`@butttons/dora`), and the SCIP indexer.
- With dora disabled: the action only installs bun.

## License

MIT
