FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy

COPY apps/ml/pyproject.toml apps/ml/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-install-project --no-dev

COPY apps/ml/src ./src
COPY apps/ml/models ./models
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-dev

ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000
CMD ["uvicorn", "ml.main:app", "--host", "0.0.0.0", "--port", "8000"]
