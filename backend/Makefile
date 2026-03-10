# =============================================================================
# Vireos Backend — Makefile
# =============================================================================

.PHONY: help dev build test migrate seed generate lint \
        docker-up docker-down docker-logs docker-clean \
        typecheck install start start-worker shell

# Default target
.DEFAULT_GOAL := help

# Color output
CYAN  := \033[36m
RESET := \033[0m

## help: Show this help message
help:
	@echo "$(CYAN)Vireos Backend — Available commands$(RESET)"
	@echo ""
	@grep -E '^## [a-z]' Makefile | sed 's/## /  /' | column -t -s ':'
	@echo ""

# ---------------------------------------------------------------------------
# Development
# ---------------------------------------------------------------------------

## dev: Start all services with hot-reload (postgres, redis, app, pgadmin)
dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up

## dev-detach: Start all dev services in background
dev-detach:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

## docker-up: Start only postgres and redis (run app locally with npm run dev)
docker-up:
	docker compose up -d postgres redis

## docker-down: Stop all services
docker-down:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down

## docker-logs: Tail logs from all services
docker-logs:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f

## docker-clean: Stop and remove all containers, volumes, and images
docker-clean:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v --rmi local

## install: Install npm dependencies
install:
	npm install

## start: Start the compiled production server locally
start:
	node dist/server.js

## start-worker: Start the compiled worker process locally
start-worker:
	node dist/queues/workers/index.js

## shell: Open a shell in the running app container
shell:
	docker compose exec app sh

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

## build: Build Docker images
build:
	docker compose build

## build-app: Build and tag just the app image
build-app:
	docker compose build app

## compile: Compile TypeScript to JavaScript
compile:
	npm run build

## typecheck: Run TypeScript type checking without emitting files
typecheck:
	npm run typecheck

# ---------------------------------------------------------------------------
# Testing
# ---------------------------------------------------------------------------

## test: Run all tests inside Docker
test:
	docker compose run --rm app npm test

## test-local: Run tests locally (requires local Node.js + env vars)
test-local:
	npm test

## test-watch: Run tests in watch mode locally
test-watch:
	npm run test:watch

## test-coverage: Run tests with coverage report
test-coverage:
	docker compose run --rm app npm run test:coverage

# ---------------------------------------------------------------------------
# Database (Prisma)
# ---------------------------------------------------------------------------

## migrate: Run pending Prisma migrations (development)
migrate:
	docker compose run --rm app npx prisma migrate dev

## migrate-prod: Apply migrations in production mode (no prompt)
migrate-prod:
	docker compose run --rm app npx prisma migrate deploy

## seed: Seed the database with initial data
seed:
	docker compose run --rm app npx prisma db seed

## generate: Generate Prisma client from schema
generate:
	docker compose run --rm app npx prisma generate

## studio: Open Prisma Studio (database GUI)
studio:
	npx prisma studio

## migrate-reset: Reset database and re-run all migrations (DESTROYS DATA)
migrate-reset:
	@echo "WARNING: This will destroy all data in the database."
	@read -p "Are you sure? [y/N] " confirm && [ "$$confirm" = "y" ]
	docker compose run --rm app npx prisma migrate reset --force

# ---------------------------------------------------------------------------
# Code quality
# ---------------------------------------------------------------------------

## lint: Run ESLint on src and tests
lint:
	docker compose run --rm app npm run lint

## lint-local: Run ESLint locally
lint-local:
	npm run lint

## lint-fix: Run ESLint and auto-fix issues
lint-fix:
	npm run lint:fix
