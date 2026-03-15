# Changelog

All notable changes to this project will be documented in this file.

## v0.0.5 - 2026-03-15

### Added

- **Obsidian vault integration** - Connect an Obsidian vault to give the agent access to documentation and architecture notes
  - New inputs: `obsidian_vault_repo`, `obsidian_vault_name`, `obsidian_token`, `obsidian_prompt`
  - Vault is cloned to `/home/runner/obi-vaults/{vault-name}/`
  - Agent can query vault using `obi` CLI with the `obi` skill
  - Vault cached by commit SHA for performance
- Support for inline PR comments, issues, and discussions (not just PR reviews)
- `api_key` input for static API key authentication (alternative to `pi_auth`)
- `use_dora` input to make dora code intelligence optional
- Caching for bun, action dependencies, dora, and project node_modules
- Customizable system prompt and review template via inputs

### Changed

- Expanded action to support multiple trigger types beyond PR reviews
- Improved caching strategy with commit SHA-based cache keys

### Fixed

- Use `$HOME` expansion correctly in GitHub Actions environment
- Gate job on `@pi` mention to avoid spurious runner starts
- Match `@pi` mention anywhere in body, not just at line start

## v0.0.1-alpha - 2026-02-27

### Added

- Initial release of pi-action-runner
- PR review automation with `@pi review` trigger
- Dora code intelligence integration
- Support for custom models via `pi_model` input
