# Winchester Round Table — Makefile
# Usage: make <target>

.PHONY: help docker-check build build-dev up up-dev down restart logs logs-dev \
        shell db-shell db-list-users clean dev

# ── Config ────────────────────────────────────────────────────────────────────
COMPOSE  = docker compose
SERVICE  = winchester
POSTGRES = postgres

# ── Help (default) ────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  Winchester Round Table — commands"
	@echo ""
	@echo "  make build          Build the app Docker image"
	@echo "  make up             Start prod stack (app + postgres) in background"
	@echo "  make up-dev         Dev stack: Vite HMR + tsx watch"
	@echo "  make down           Stop and remove containers"
	@echo "  make restart        Restart the prod app service"
	@echo "  make logs           Follow prod app logs"
	@echo "  make logs-dev       Follow dev container logs"
	@echo "  make build-dev      Build the dev image only"
	@echo "  make shell          Shell inside running prod app container"
	@echo "  make db-shell       psql shell inside postgres container"
	@echo "  make db-list-users  List all registered knights"
	@echo "  make clean          Remove containers, images, and volumes"
	@echo "  make dev            Run locally without Docker (needs local postgres)"
	@echo ""

# ── Docker checks ─────────────────────────────────────────────────────────────
docker-check:
	@docker info >/dev/null 2>&1 || { \
		printf '%s\n' \
			'Error: Cannot connect to the Docker daemon.' \
			'Start Docker Desktop and wait until the engine is running, then retry.' \
			'(If Docker is running, check Docker Desktop > Settings > Troubleshoot.)' >&2; \
		exit 1; \
	}

# ── Docker targets ─────────────────────────────────────────────────────────────
build: docker-check
	$(COMPOSE) build $(SERVICE)

build-dev: docker-check
	$(COMPOSE) --profile dev build winchester-dev

up: docker-check
	$(COMPOSE) up -d --build $(SERVICE) $(POSTGRES)

up-dev: docker-check
	$(COMPOSE) --profile dev up --build winchester-dev $(POSTGRES)

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

db-shell: docker-check
	$(COMPOSE) exec $(POSTGRES) psql -U winchester -d winchester

db-list-users: docker-check
	$(COMPOSE) exec $(SERVICE) node dist/server/../../../scripts/list-users.mjs

clean: docker-check
	$(COMPOSE) down --rmi all --volumes --remove-orphans

# ── Local dev (no Docker) ─────────────────────────────────────────────────────
dev:
	npm run dev
