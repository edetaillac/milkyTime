# Deployment variables: use system environment or command-line arguments
# Standard practice: keep infrastructure config separate from app config
# Usage: SERVER_USER=your_user make deploy

# Variables (can be overridden by .env file or command line)
SERVER_USER ?= user
SERVER_HOST ?= your-server.com
APP_PATH ?= /path/to/app

# Help command
.PHONY: help
help: ## Show this help
	@echo "🚀 Essential commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sed 's/Makefile://' | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

# First time setup
.PHONY: init
init: ## 🎬 Complete initial setup (first time)
	@echo "🎬 Initial setup of Mon App Tétées..."
	@if [ ! -f .env.local ]; then \
		echo "📋 Copying .env.example to .env.local..."; \
		cp .env.example .env.local; \
		echo "⚠️  IMPORTANT: Edit .env.local with your real values!"; \
		echo "   - Supabase URL and API key"; \
		echo "   - User data"; \
		echo "   - Server configuration"; \
	else \
		echo "✅ .env.local already exists"; \
	fi
	@echo "📦 Installing dependencies..."
	npm install
	@echo "✅ Setup complete! Use 'make dev' to start"

# Quick Start
.PHONY: start
start: ## 🏁 Start the project (after init)
	npm run dev

# Development
.PHONY: dev
dev: ## 💻 Start development server
	npm run dev

.PHONY: build
build: ## 🔨 Build the application
	npm run build

# Testing
.PHONY: test
test: ## 🧪 Run all tests
	npm run test:all

.PHONY: test-ui
test-ui: ## 🧪 Run tests in UI mode
	npm run test:all:ui

# Docker
.PHONY: docker
docker: ## 🐳 Run with Docker (local production)
	docker-compose up --build -d

.PHONY: docker-stop
docker-stop: ## 🛑 Stop Docker containers
	docker-compose down

.PHONY: docker-logs
docker-logs: ## 📋 Show Docker logs
	docker-compose logs -f

# Deploy
.PHONY: deploy
deploy: ## 🚀 Deploy to production server
	ssh $(SERVER_USER)@$(SERVER_HOST) "cd $(APP_PATH) && git fetch origin && git reset --hard origin/main && docker-compose -f docker-compose.prod.yml build --no-cache && docker-compose -f docker-compose.prod.yml up -d"

# Cleanup
.PHONY: clean
clean: ## 🧹 Clean temporary files
	rm -rf .next node_modules/.cache
	docker-compose down --remove-orphans 2>/dev/null || true