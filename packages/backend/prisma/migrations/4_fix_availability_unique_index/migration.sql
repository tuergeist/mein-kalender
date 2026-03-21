-- Drop the old unique index that only covered (userId, dayOfWeek)
-- Migration 1 tried DROP CONSTRAINT but it was created as an INDEX, so it survived
DROP INDEX IF EXISTS "availability_rules_userId_dayOfWeek_key";
