# Managing Furniture

A web app for tracking furniture across Metropolia campuses. Every item has a QR code: students scan it with their phone to borrow furniture for another room, moderators approve requests and follow up on items that are not yet returned, and admins manage locations, categories, users and settings.

Built by a four-person student team for Metropolia University of Applied Sciences (Multidisciplinary Innovation Project, autumn 2026).

## Main features

- Login with an **@metropolia.fi** email and a one-time code (no passwords)
- Borrow several items in one request, with one until-time
- Automatic approval by category (e.g. chairs and stools); other items are approved by a moderator
- Return by scanning the home room's QR code, then each item
- Reminder emails before the due time, and "not yet returned" emails after it
- Item management with bulk add, asset codes and printable QR labels
- Moderator dashboard and reports with CSV export

## Tech stack

| Part      | Choice                                     |
| --------- | ------------------------------------------ |
| Frontend  | React 18, Vite, Tailwind CSS, React Router |
| Backend   | Node.js 20, Express, Prisma ORM            |
| Database  | PostgreSQL 16                              |
| Local dev | Docker Compose: PostgreSQL + Mailpit       |
| Delivery  | Docker image + `docker-compose.yml`        |

## Repository layout

```
managing-furniture/
├── client/   React frontend
├── server/   Express API, Prisma schema, background jobs
└── docs/     Architecture, API and install guides
```

## Getting started

> Setup instructions are added as the backend and frontend scaffolds are merged.

Requirements: Node.js 20, Docker Desktop, Git.

1. Clone the repository and switch to `dev`.
2. Copy `.env.example` to `.env` and fill in the values.

## How we work

Branches, commits, pull requests and the pre-merge checklist are described in [CONTRIBUTING.md](CONTRIBUTING.md).

## Team

- Kaji Thebe
- Miraj Shrestha
- Abhinav Gautam
- Md Allam
