.PHONY: lint format type-check check help

help:
	@echo "Available commands:"
	@echo "  make lint        - Run linting checks using ruff"
	@echo "  make format      - Format code using ruff"
	@echo "  make type-check  - Run type checking using ty"
	@echo "  make check       - Run all checks (lint and type-check)"

lint:
	uv run ruff check .

format:
	uv run ruff format .

type-check:
	uv run ty check

check: lint type-check
