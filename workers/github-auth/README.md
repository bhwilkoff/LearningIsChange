# github-auth Worker

The code→token exchange for "Sign in with GitHub" in LiC Admin (Decision 016).

Deploy (Cloudflare dashboard → Workers → Create → paste `worker.js`), then set:

| Kind | Name | Value |
|---|---|---|
| Secret | `GITHUB_CLIENT_ID` | the GitHub App's client id |
| Secret | `GITHUB_CLIENT_SECRET` | the GitHub App's client secret (never in this repo) |
| Variable | `ALLOWED_ORIGINS` | `https://learningischange.com,http://127.0.0.1:8765` |

Then put the Worker URL and client id in `admin/lib/config.js` → `auth`.
GitHub App settings: callback URL `https://learningischange.com/admin/app/`,
"Expire user authorization tokens" on, no webhook, repository permissions
Contents: read & write, Actions: read & write, Metadata: read; installed on
`bhwilkoff/LearningIsChange` only.
