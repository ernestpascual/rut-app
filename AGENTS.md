# AGENTS.md

## Strict Environment and Secret Rules

These instructions override all other implementation convenience.

### Never access `.env.local`

Do not under any circumstances:
- Open `.env.local`
- Read `.env.local`
- Print `.env.local`
- Search or grep `.env.local`
- Parse `.env.local`
- Source `.env.local`
- Copy `.env.local`
- Modify `.env.local`
- Include its values in logs, commands, screenshots, generated files, artifacts, tests, diffs, or documentation
- Run a command that automatically loads `.env.local`

### Safe Expo CLI Execution
When invoking Expo CLI during your work, disable dotenv loading:
```bash
EXPO_NO_DOTENV=1 npx expo start
EXPO_NO_DOTENV=1 npx expo export --platform web
```

### Environment Configurations
- Only use `.env.example` when identifying required configuration names.
- Always use obvious placeholder values in `.env.example`.
- All `.env` and `.env.*` files (except `!.env.example`) must remain in `.gitignore`.
- Never put private AI provider secrets or service-account credentials in client code.
- AI credentials must only be configured through Firebase Functions secrets, Google Secret Manager, or server-only secret mechanisms.
