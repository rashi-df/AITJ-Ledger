.PHONY: help up down shell migrate fresh seed test test-unit test-e2e typecheck lint ci psql logs ps

# A bare `make` prints usage and mutates nothing — never let the default
# goal run a destructive or long-running target by accident.
.DEFAULT_GOAL := help


help:
	@echo "AITJ Ledger — available targets:"
	@echo "  make up          Start stack (app + postgres)"
	@echo "  make down        Stop stack"
	@echo "  make shell       Bash into app container"
	@echo "  make migrate     Run Prisma migrations"
	@echo "  make fresh       Drop + migrate + seed"
	@echo "  make seed        Seed categories + admin"
	@echo "  make test        Full suite (unit + integration)"
	@echo "  make test-unit   Vitest unit only"
	@echo "  make test-e2e    Playwright"
	@echo "  make typecheck   tsc --noEmit"
	@echo "  make lint        ESLint + Prettier check"
	@echo "  make ci          typecheck + lint + test"
	@echo "  make psql        psql shell (DB: aitj)"
	@echo "  make logs        Tail container logs"
	@echo "  make ps          Show stack status"

up:
	docker compose up -d

down:
	docker compose down

ps:
	docker compose ps

logs:
	docker compose logs -f

shell:
	docker compose exec app bash

migrate:
	docker compose exec app pnpm exec prisma migrate deploy

seed:
	docker compose exec app pnpm seed

fresh:
	@echo "About to drop the database, re-run migrations and reseed. This deletes all data in the 'aitj' database."
	docker compose exec app pnpm exec prisma migrate reset --force --skip-seed
	$(MAKE) migrate
	$(MAKE) seed

typecheck:
	docker compose exec app pnpm exec tsc --noEmit

lint:
	docker compose exec app pnpm lint

test:
	docker compose exec app pnpm test

test-unit:
	docker compose exec app pnpm test:unit

test-e2e:
	docker compose exec app pnpm test:e2e

# Deliberately excludes test-e2e: Playwright's browser + webServer
# startup cost makes it too slow for a "run this before every push" CI
# gate, and it isn't wired into any CI workflow yet. Run `make test-e2e`
# separately when touching anything E2E-relevant.
ci: typecheck lint test

psql:
	docker compose exec db psql -U postgres -d aitj
