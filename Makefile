# Winchester Round Table — Makefile
# Usage: make <target>

.PHONY: help docker-check build build-dev up up-dev down restart logs logs-dev shell clean dev

# ── Config ────────────────────────────────────────────────────────────────────
COMPOSE = docker compose
SERVICE = winchester

# ── Help (default) ────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  Winchester Round Table — Docker commands"
	@echo ""
	@echo "  make build      Build the Docker image"
	@echo "  make up         Start prod stack in background (build if needed)"
	@echo "  make up-dev     Dev stack: Vite HMR + tsx watch (see Makefile for URL)"
	@echo "  make down       Stop and remove containers"
	@echo "  make restart    Restart the prod service"
	@echo "  make logs       Follow prod logs"
	@echo "  make logs-dev   Follow dev container logs"
	@echo "  make build-dev  Build the dev image only"
	@echo "  make shell      Open a shell inside the running prod container"
	@echo "  make clean      Remove containers, images, and volumes"
	@echo "  make dev        Run locally without Docker (npm run dev)"
	@echo ""

# ── Docker targets ────────────────────────────────────────────────────────────
# Fails fast when Docker Desktop (or another engine) is not running — avoids cryptic pipe errors.
docker-check:
	@docker info >/dev/null 2>&1 || { \
		printf '%s\n' \
			'Error: Cannot connect to the Docker daemon.' \
			'Start Docker Desktop and wait until the engine is running, then retry.' \
			'(If Docker is running, check Docker Desktop > Settings > Troubleshoot.)' >&2; \
		exit 1; \
	}

build: docker-check
	$(COMPOSE) build $(SERVICE)

build-dev: docker-check
	$(COMPOSE) --profile dev build winchester-dev

up: docker-check
	$(COMPOSE) up -d --build $(SERVICE)

up-dev: docker-check
	$(COMPOSE) --profile dev up --build winchester-dev

down: docker-check
	$(COMPOSE) down

restart: docker-check
	$(COMPOSE) restart $(SERVICE)

logs: docker-check
	$(COMPOSE) logs -f $(SERVICE)

logs-dev: docker-check
	$(COMPOSE) --profile dev logs -f winchester-dev

shell: docker-check
	$(COMPOSE) exec $(SERVICE) sh

clean: docker-check
	$(COMPOSE) down --rmi all --volumes --remove-orphans

# ── Local dev (no Docker) ─────────────────────────────────────────────────────
dev:
	npm run dev
