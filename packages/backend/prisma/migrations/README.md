# Prisma Migrations

## Initial setup (one-time)

The `0_init` migration was created as a baseline from the existing schema.
On first deploy, mark it as already applied before running `migrate deploy`:

```bash
DATABASE_URL="..." npx prisma migrate resolve --applied 0_init
```

After that, `npx prisma migrate deploy` will work normally for future migrations.

## Creating new migrations

```bash
DATABASE_URL="..." npx prisma migrate dev --name describe-your-change
```
