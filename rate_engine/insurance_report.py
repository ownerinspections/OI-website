from __future__ import annotations

from math import ceil
from typing import Iterable, Any, Dict
import json
import os
from pathlib import Path
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


def _fetch_pricing_config() -> Dict[str, int]:
    """Fetch pricing numbers from unified services endpoint for insurance_report.

    Selects the row where service_type == 'insurance_report'.
    """
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
            if str(it.get("service_type")).strip().lower() == "insurance_report":
                row = it
                break
        except Exception:
            continue
    if row is None:
        raise ValueError("Pricing for service 'insurance_report' not found")

    return {
        1: _safe_to_int(row.get("document_review_and_inspection_fix_price"), 1500),
        2: _safe_to_int(row.get("detailed_report_preparation_fix_price"), 1500),
        3: _safe_to_int(row.get("repair_cost_estimate_fix_price"), 1500),
        "threshold_loss": _safe_to_int(row.get("estimated_damage_loss_up_to"), 100_000),
        "stage2_step_price": _safe_to_int(row.get("every_100k_loss_price_stage_2_price"), 1000),
        "stage3_step_price": _safe_to_int(row.get("every_100k_loss_price_stage_3_price"), 1000),
        "note": str(row.get("note") or ""),
    }


def _validate_stages(stages: Iterable[int]) -> list[int]:
    try:
        stage_list = list(stages)
    except TypeError as exc:
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


def calculate(
    stages: Iterable[int],
    estimated_damage_loss: int,
    property_category: str,
    **_extras: Any,
) -> dict:
    """Calculate total and per-stage prices for insurance_report.

    Rules:
      - 3 stages with API-driven base prices:
          1: document review and inspection
          2: detailed report preparation
          3: cost estimate
      - Base prices apply when estimated_damage_loss <= threshold (API key: estimated_damage_loss_up_to).
      - Stage 1 is always fixed price (no surcharge above threshold).
      - For loss above threshold: for every additional 100,000 (rounded up), add configured step price
        to stages 2 and 3 respectively.
    """
    if not isinstance(estimated_damage_loss, int) or estimated_damage_loss < 0:
        raise ValueError("'estimated_damage_loss' must be a non-negative integer")

    # Validate property category (required)
    category_value = str(property_category).strip().lower()
    if category_value not in {"residential", "commercial"}:
        raise ValueError("property_category must be either 'residential' or 'commercial'")

    selected_stages = _validate_stages(stages)

    cfg = _fetch_pricing_config()

    threshold = cfg["threshold_loss"]
    extra_loss = max(0, estimated_damage_loss - threshold)
    steps = ceil(extra_loss / 100_000) if extra_loss > 0 else 0

    stage_prices: list[Dict[str, int]] = []
    for s in sorted(selected_stages):
        base = cfg[s]
        if s == 1:
            price = base  # always fixed
        elif s == 2:
            price = base + steps * cfg["stage2_step_price"]
        elif s == 3:
            price = base + steps * cfg["stage3_step_price"]
        else:  # pragma: no cover - guarded by validator
            price = base
        stage_prices.append({"stage": s, "price": int(price)})

    quote_price = sum(item["price"] for item in stage_prices)

    return {
        "stage_prices": stage_prices,
        "quote_price": int(quote_price),
        "note": cfg.get("note", ""),
    }



