from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict
from urllib.request import Request, urlopen


def _read_env_value(key: str) -> str | None:
    value = os.getenv(key)
    if value:
        return value
    env_path = Path(__file__).with_name(".env")
    if env_path.exists():
        try:
            for line in env_path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                if k.strip() == key:
                    return v.strip().strip('"').strip("'")
        except Exception:
            pass
    return None


def _safe_to_int(value: Any, default: int = 0) -> int:
    try:
        if isinstance(value, bool):
            return default
        if isinstance(value, (int, float)):
            return int(value)
        if isinstance(value, str):
            return int(value.strip())
    except Exception:
        return default
    return default


def _fetch_pricing_config() -> Dict[str, int | str]:
    """Fetch pricing for Expert Witness Report from unified services endpoint."""
    base_url = _read_env_value("KONG_GATEWAY_URL")
    if not base_url:
        raise ValueError("KONG_GATEWAY_URL is not set in environment or .env")

    url = f"{base_url.rstrip('/')}/items/services"

    try:
        req = Request(url, headers={"Accept": "application/json"})
        with urlopen(req, timeout=5) as resp:  # nosec - internal trusted URL
            raw = resp.read().decode("utf-8", errors="replace").strip()
    except Exception as exc:
        raise ValueError(f"Failed to fetch pricing from {url}") from exc

    # Handle potential trailing characters after JSON
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        if "}" in raw:
            trimmed = raw[: raw.rfind("}") + 1]
            payload = json.loads(trimmed)
        else:
            raise

    items = payload.get("data") or []
    if not isinstance(items, list):
        raise ValueError("Invalid pricing payload: expected a list under 'data'")

    row: Dict[str, Any] | None = None
    for it in items:
        try:
            if str(it.get("service_type")).strip().lower() == "expert_witness_report":
                row = it
                break
        except Exception:
            continue
    if row is None:
        raise ValueError("Pricing for service 'expert_witness_report' not found")

    return {
        # hourly priced entries; stored under *_hourly_price in the services payload
        "document_review_and_inspection_price": _safe_to_int(
            row.get("document_review_and_inspection_hourly_price"), 350
        ),
        "detailed_report_preparation_price": _safe_to_int(
            row.get("detailed_report_preparation_hourly_price"), 350
        ),
        "repair_cost_estimatescott_schedule": _safe_to_int(
            row.get("repair_cost_estimate_hourly_price"), 350
        ),
        "note": str(row.get("note") or ""),
    }


def _validate_stages(stages: Any) -> list[int]:
    try:
        stage_list = list(stages)
    except TypeError as exc:  # not iterable
        raise ValueError("'stages' must be a list of integers between 1 and 3") from exc

    if not stage_list:
        raise ValueError("'stages' must include at least one stage")

    normalized: list[int] = []
    seen: set[int] = set()
    for s in stage_list:
        if not isinstance(s, int):
            raise ValueError("'stages' must contain integers only")
        if s < 1 or s > 3:
            raise ValueError("'stages' values must be between 1 and 3")
        if s in seen:
            continue
        seen.add(s)
        normalized.append(s)
    return normalized


def calculate(stages: Any, property_category: str, **_extras: Any) -> dict:
    """
    Accepts selected stages like other stage-based services but does not add
    stage 2 and 3 to the quote total. quote_price is equal to stage 1 price only.
    """
    # Validate property category (required)
    category_value = str(property_category).strip().lower()
    if category_value not in {"residential", "commercial"}:
        raise ValueError("property_category must be either 'residential' or 'commercial'")

    selected_stages = _validate_stages(stages)

    cfg = _fetch_pricing_config()

    stage_price_map: Dict[int, int] = {
        1: int(cfg["document_review_and_inspection_price"]),
        2: int(cfg["detailed_report_preparation_price"]),
        3: int(cfg["repair_cost_estimatescott_schedule"]),
    }

    stage_prices = [
        {"stage": s, "price": stage_price_map[s]} for s in sorted(selected_stages)
    ]

    # Only stage 1 contributes to quote_price
    quote_price = stage_price_map[1]

    return {
        "stage_prices": stage_prices,
        "quote_price": int(quote_price),
        "note": cfg.get("note", ""),
    }



