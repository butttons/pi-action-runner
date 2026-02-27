# pi-action-runner

GitHub Action that runs AI-powered PR reviews using [pi](https://github.com/badlogic/pi-mono) and [dora](https://github.com/butttons/dora).

Comment `@pi review` on a PR to trigger a structured code review posted as a reply.

## Setup

1. Base64-encode your pi `auth.json` and add it as a repository secret named `PI_AUTH`:

```bash
base64 -i ~/.pi/agent/auth.json | pbcopy
```

2. Add the workflow to your repo:

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
| `pi_auth` | Yes | -- | Base64-encoded pi `auth.json` |
| `pi_model` | No | `anthropic/claude-opus-4-6` | Model in `provider/model-id` format |
| `dora_version` | No | `latest` | Dora CLI release version |
| `scip_install` | No | `bun install -g @sourcegraph/scip-typescript` | SCIP indexer install command. Empty string to skip. |
| `dora_pre_index` | No | -- | Commands to run after `dora init` but before indexing (e.g. install project deps) |
| `dora_index_command` | No | `dora index` | Override the index command |
| `extra_prompt` | No | -- | Additional instructions appended to every review |

### Language examples

**TypeScript/JavaScript** (default, no config needed):

```yaml
- uses: butttons/pi-action-runner@v0
  with:
    pi_auth: ${{ secrets.PI_AUTH }}
```

**Rust**:

```yaml
- uses: butttons/pi-action-runner@v0
  with:
    pi_auth: ${{ secrets.PI_AUTH }}
    scip_install: 'cargo install rust-analyzer'
```

**Python**:

```yaml
- uses: butttons/pi-action-runner@v0
  with:
    pi_auth: ${{ secrets.PI_AUTH }}
    scip_install: 'pip install scip-python'
    dora_pre_index: 'pip install -e .'
```

**No SCIP indexer** (dora still provides file-level analysis):

```yaml
- uses: butttons/pi-action-runner@v0
  with:
    pi_auth: ${{ secrets.PI_AUTH }}
    scip_install: ''
```

## How it works

1. Validates the commenter is a repo owner/member.
2. Installs dora CLI and the SCIP indexer.
3. Runs `dora init`, optional pre-index setup, then `dora index`.
4. Runs pi with bash and read tools. pi uses `git diff`, `dora changes`, `dora file`, `dora rdeps`, and other commands to gather context.
5. Posts a structured review comment on the PR.

Each step logs to GitHub Actions output for full visibility into the review process.

## Review output

Reviews follow a fixed structure:

- **Summary** -- what the PR does and why.
- **Risk Assessment** -- LOW, MEDIUM, or HIGH with justification.
- **Issues** -- bugs, security, correctness problems with severity and file locations.
- **Suggestions** -- improvements worth considering.
- **Architecture** -- structural concerns, only when applicable.

## Requirements

- GitHub Actions runner: `ubuntu-latest`
- Repository secret: `PI_AUTH` (base64 pi auth.json)
- The action installs its own dependencies (bun, dora, scip-typescript).

## License

MIT
