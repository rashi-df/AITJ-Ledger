-- AITJ-M0-04: case-insensitive Category uniqueness + Transaction/Category
-- type consistency, enforced at the database level (PRD §6.1, FR-C6).
--
-- Written entirely with IF EXISTS / IF NOT EXISTS / OR REPLACE / DROP-then-
-- CREATE guards so the whole file is idempotent: running it twice (e.g. a
-- container restart mid-`prisma migrate deploy`) never errors.

-- 1. Case-insensitive uniqueness per type
--
-- The Prisma-generated `Category_name_type_key` unique index is
-- case-sensitive, which would allow "Water" and "water" to coexist as two
-- expense categories. Replace it with a functional unique index on
-- (LOWER(name), type) so uniqueness is case-insensitive within a type, while
-- still allowing the same name to be used once per INCOME and once per
-- EXPENSE (e.g. income "Other" and expense "Other").
--
-- Prisma's `@@unique([name, type])` is emitted as a bare unique index, not a
-- table constraint, so it has no `pg_constraint` entry -- it must be dropped
-- with DROP INDEX, not ALTER TABLE ... DROP CONSTRAINT.
DROP INDEX IF EXISTS "Category_name_type_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Category_name_type_lower_key"
  ON "Category" (LOWER("name"), "type");

-- 2. Transaction.type must always equal its linked Category.type
--
-- PostgreSQL CHECK constraints must be immutable and cannot reference other
-- tables, so a cross-table invariant like this is enforced with a
-- BEFORE INSERT OR UPDATE trigger instead of a CHECK constraint.
CREATE OR REPLACE FUNCTION check_transaction_type_matches_category()
RETURNS TRIGGER AS $$
DECLARE
  category_type "TransactionType";
BEGIN
  SELECT "type" INTO category_type FROM "Category" WHERE "id" = NEW."categoryId";

  IF category_type IS DISTINCT FROM NEW."type" THEN
    RAISE EXCEPTION
      'Transaction.type (%) does not match Category.type (%) for categoryId %',
      NEW."type", category_type, NEW."categoryId";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_transaction_type_matches_category ON "Transaction";

CREATE TRIGGER trg_check_transaction_type_matches_category
  BEFORE INSERT OR UPDATE OF "type", "categoryId" ON "Transaction"
  FOR EACH ROW
  EXECUTE FUNCTION check_transaction_type_matches_category();
