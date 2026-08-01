# Workflows

## pi-review.yml

AI code review dogfooding this action (`uses: ./`). Triggers on `@pi` mentions in PR/issue/discussion comments. Runs `kimi-coding/k3` with dora code intelligence, pi-kit extensions, and pouch CMS review memory.

### Auth

The action authenticates via the `PI_AUTH` repo secret: a base64-encoded pi `auth.json` containing a single `kimi-coding` API key entry. No OAuth, no expiry beyond key rotation.

To rotate (key lives in `/Users/yash/Work/zapify-mono/.env` as `KIMI_API_KEY`):

```bash
python3 - <<'EOF'
import json, base64, subprocess
key = [l.split('=', 1)[1].strip().strip('"').strip("'") for l in open('/Users/yash/Work/zapify-mono/.env') if l.startswith('KIMI_API_KEY=')][0]
auth = json.dumps({"kimi-coding": {"type": "api_key", "key": key}})
subprocess.run(['gh', 'secret', 'set', 'PI_AUTH', '-R', 'butttons/pi-action-runner'],
               input=base64.b64encode(auth.encode()), check=True)
EOF
```

Verify a key works:

```bash
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $KIMI_API_KEY" https://api.kimi.com/coding/v1/models
# 200 = valid
```

### Other secrets

- `POUCH_URL` -- pouch CMS instance (`https://pouch-git.mojo-web-tech.workers.dev`) used for review memory
- `POUCH_API_KEY` -- pouch key with `collection:read`, `content:read`, `content:write` scopes; backs the `reviews` and `findings` collections. Mint a new one via `POST $POUCH_URL/auth/keys` with `POUCH_JWT_SECRET` (in the zapify-mono `.env`). Expiry is the only lifecycle.

## example.yml / test.yml

- `example.yml` -- minimal reference usage of the published action (`butttons/pi-action-runner@v0`).
- `test.yml` -- smoke test of the checked-out action (`uses: ./`) on `@pi` mentions.
