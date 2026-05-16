-- 2026-05-17-user-profile-timezone.sql
-- Adds a `timezone` (IANA, e.g. "America/Los_Angeles") column to user_profile so
-- the frontend can query daily_summary by the user's LOCAL date instead of UTC.
-- Safe to run before or after the multi-user-rls migration.

alter table user_profile
  add column if not exists timezone text;
