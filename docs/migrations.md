# Database Migration Conventions

## Overview

Kuwenta / Krunchr uses Prisma with PostgreSQL. Schema changes are applied via Prisma Migrate.

## Workflow

1. Edit `prisma/schema.prisma`.
2. Run the migration command:
   ```bash
   pnpm prisma migrate dev --name <descriptive_name>
   ```
3. Review the generated migration file in `prisma/migrations/`.
4. Commit both the schema change and the migration file.

## Naming

- Use snake_case for migration names.
- Be descriptive: `add_audit_log_table`, `add_election_flag_to_tax_year`.
- Avoid generic names like `migration_1`.

## Seeding

- Seed data lives in `prisma/seed.ts`.
- After applying migrations, run:
  ```bash
  pnpm prisma db seed
  ```

## Testing migrations

- For local development, use `docker-compose up -d` to start PostgreSQL.
- For test databases, use `pnpm db:test:migrate` after ensuring the test DB exists.

## Backwards compatibility

- Prefer additive changes over destructive changes.
- When a column must be removed, first make it nullable or default it, then remove in a follow-up migration after deploy.
