# Features Log

Running log of shipped features for Kuwenta / Krunchr.

## Format

Each entry:

```markdown
### YYYY-MM-DD — Feature title
- Commit/PR: `branch-or-pr-link`
- What changed: one-paragraph summary
- Files touched: `path/to/file.ts`, `path/to/other.ts`
```

---

## Entries

### 2026-06-27 — Project initialization
- Commit: `0c2f28e`
- What changed: Initialized Next.js 15 project with Prisma, Tailwind CSS, and SVG assets.
- Files touched: `package.json`, `prisma/schema.prisma`, `app/`, `components/`

### 2026-06-27 — Tax form templates
- Commit: `6178464`
- What changed: Added new tax form templates for 1701A, 1701Q, and 2551Q.
- Files touched: `lib/pdf/templates/`

### 2026-06-27 — Journal entry generation
- Commit: `e1723fa`
- What changed: Added journal entry generation for overpayment dispositions and year-end closing entries.
- Files touched: `lib/journal/`, `prisma/schema.prisma`

### 2026-06-29 — Krunchr brand design system
- Commit: `aac6ae3`
- What changed: Established Krunchr brand design system and wire theme.
- Files touched: `app/globals.css`, `components/ui/`, `public/`
