# Contributing

Thanks for helping out. This project is small on purpose: one entry point (`app.js`), one renderer (`render.js`), one runtime dependency (`nodemailer`).

## Setup

```sh
corepack enable
yarn install
yarn test
```

Requires Node >= 22.9 and Yarn 4 (via Corepack).

## Guidelines

- Keep code, comments, docs and commit messages in English.
- Add or update tests in `test/` for any behavior change. Tests use `node --test` with a fake dev.to client, no network.
- Email changes must keep the accessibility rules: no white or transparent backgrounds, text/background contrast of at least 4.5:1, tag names always written out. `yarn test` enforces the palette contrast.
- Article content is untrusted. Escape it in HTML and never let it steer the LLM prompt.
- Secrets live in environment variables only, never in `config.json`.

## Pull requests

Small, focused PRs with a short description of the why. Run `yarn test` before pushing.
