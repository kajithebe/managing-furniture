# Contributing to Managing Furniture

How our team of four works on this repository. Read this before your first card.

## Branches

Code moves **feature → dev → main** and never skips a step.

| Branch                | Rules                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `main`                | Production-ready only (demo + handover). No direct commits. Changes only via the sprint release PR from `dev`.         |
| `dev`                 | Integration branch and default branch. Every finished feature is merged here first.                                    |
| `feature/<card-name>` | One per Trello card, created from `dev`, merged back by PR, then deleted. The branch name is given on the Trello card. |

Direct pushes to `dev` and `main` are blocked. Every change goes through a pull request.

## Working on a card

```bash
# 1. Start from the latest dev (move the Trello card to In progress)
git checkout dev
git pull origin dev
git checkout -b feature/<card-name>

# 2. Commit small and often, push each time
git status                          # check what changed
git add <only the files of this step>
git commit -m "feat: add borrow request endpoint"
git push -u origin feature/<card-name>   # first push only; later just: git push

# 3. If dev moved on, rebase before marking the PR ready
git fetch origin
git rebase origin/dev
git push --force-with-lease          # only ever on your own feature branch

# 4. After the squash merge, clean up (move the card to Done)
git checkout dev
git pull origin dev
git branch -D feature/<card-name>
```

> **Windows PowerShell 5:** `&&` does not work. Run commands one per line.

## Small commits

- Never one big commit at the end of a card. Split the card into small steps (model → route → validation → page …).
- One commit = one idea, a few files, ideally under ~200 changed lines. Each commit leaves the app working.
- Always check `git status` first and add files **by name**. Never commit `.env` or `node_modules`.
- Push after every commit, so the team can see your work.

## Commit messages

Prefix + imperative mood, no period at the end.

| Prefix      | Use for                                        |
| ----------- | ---------------------------------------------- |
| `feat:`     | new feature or user-facing capability          |
| `fix:`      | bug fix                                        |
| `chore:`    | tooling, config, dependencies, releases        |
| `docs:`     | documentation only                             |
| `style:`    | formatting / Tailwind changes, no logic change |
| `refactor:` | restructuring, no behaviour change             |
| `test:`     | adding or fixing tests                         |

Examples: `feat: add email one-time code login for @metropolia.fi addresses` · `fix: keep chairs approved when the table request is declined` · `chore: add docker-compose with PostgreSQL and Mailpit`

## Pull requests

- **Open a draft PR after your first push**: base `dev`, the final title, and the Trello card link. On GitHub: _Compare & pull request_ → arrow next to _Create pull request_ → **Create draft pull request**.
- Drafts are not reviewed unless the author asks. Click **Ready for review** only when the card and the pre-merge checklist are done.
- Close a draft you abandon.
- **1 approval** from someone who did not write the code. Review pairs: **Kaji ↔ Miraj**, **Abhinav ↔ Md Allam** (swap when busy). Review within one working day.
- New commits after approval dismiss the approval: ask for a quick re-approval.
- Feature → `dev`: **Squash and merge** (the PR title becomes the commit message).
- Release `dev` → `main` (end of each sprint, opened by Kaji): **Create a merge commit**, then tag `v0.1` / `v1.0`.

The PR description template is filled in automatically from `.github/pull_request_template.md`.

## Pre-merge checklist (author)

- [ ] Works as described in the linked Trello card
- [ ] No `console.log` left
- [ ] No secrets in code; all sensitive values from env vars
- [ ] `.env.example` updated for any new env var
- [ ] No real Metropolia data, only seed/test data
- [ ] PR title follows the commit format
- [ ] PR description: what was built, how to test, known limitations
- [ ] No conflicts with `dev`; CI green

## Environment variables

- Copy `.env.example` to `.env` and fill in your values. `.env` is ignored by Git.
- Every new variable goes into `.env.example` **in the same PR**, with a short comment and a safe example value.
- Everything environment-specific comes from env vars, so the same Docker image runs on the demo server and at Metropolia.

## Data and secrets

- Only fake or seed data in the repo. Never real Metropolia data, emails or credentials.
- Never commit API keys, passwords or session secrets.

## Line endings

The repo stores all text files with LF line endings (`.gitattributes`). On Windows, set VS Code to LF: **Settings → Files: Eol → `\n`**.

## Changing shared contracts

The data model (Prisma schema), the API contract and the design system are shared by everyone. Changes need **team agreement first** (daily meeting). Then Kaji updates the architecture docs.
