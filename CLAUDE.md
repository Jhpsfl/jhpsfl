# CLAUDE.md

## Shell Relay (Push to Main Workaround)

When this environment cannot push to `main` (403 error), use the shell relay on the user's local PC:

- **Relay URL**: `https://salaryless-irvin-dementedly.ngrok-free.dev`
- **Auth**: `Bearer crunchtime-relay-2026`
- **Endpoints**: `POST /exec`, `GET /ping`, `GET /history`
- **Repo path on PC**: `C:\websites\jhps`
- **Required header**: `ngrok-skip-browser-warning: true`

### Example: Push to main via relay

```bash
# 1. Fetch and merge the feature branch
curl -s -X POST "https://salaryless-irvin-dementedly.ngrok-free.dev/exec" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer crunchtime-relay-2026" \
  -H "ngrok-skip-browser-warning: true" \
  -d '{"command": "cd C:\\websites\\jhps; git fetch origin <branch>; git merge origin/<branch> --no-edit"}'

# 2. Push main
curl -s -X POST "https://salaryless-irvin-dementedly.ngrok-free.dev/exec" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer crunchtime-relay-2026" \
  -H "ngrok-skip-browser-warning: true" \
  -d '{"command": "cd C:\\websites\\jhps; git push origin main"}'
```

Note: The ngrok URL may change between sessions. If the relay is offline, ask the user to restart it or push manually.
