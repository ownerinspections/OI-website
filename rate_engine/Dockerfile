FROM python:3.12-slim

# Environment settings
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/root/.local/bin:/app/.venv/bin:${PATH}"

WORKDIR /app

# Install curl & uv package manager
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    curl -LsSf https://astral.sh/uv/install.sh | sh

# Copy metadata and README first for better caching
COPY pyproject.toml uv.lock README.md /app/

# Install dependencies inside .venv
RUN uv sync

# Copy application source
COPY . /app

EXPOSE 8010

# Run FastAPI app
CMD ["python", "app.py"]
