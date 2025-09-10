from __future__ import annotations

from math import ceil
from typing import Iterable, Any, Dict
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen


# Stage base prices will be fetched from API per stage 1..6

# Area surcharge config
INCLUDED_AREA_SQ = 25  # up to this area has no area surcharge
AREA_STEP_SQ = 5  # each additional block of 1..5 sq above INCLUDED_AREA_SQ
PER_STAGE_AREA_STEP_PRICE_DEFAULT = 50

# Levels pricing
INCLUDED_LEVELS = 1
EXTRA_LEVEL_PRICE_DEFAULT = 50  # per level above INCLUDED_LEVELS (quote-level charge)

# Options
GRANNY_FLAT_PRICE_DEFAULT = 300


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
            if str(it.get("service_type")).strip().lower() == "construction_stages":
                row = it
                break
        except Exception:
            continue
    if row is None:
        raise ValueError("Pricing for service 'construction_stages' not found")

    cfg: Dict[Any, int | str] = {
        # Stage prices
        1: _safe_to_int(row.get("bored_piers_screw_piles_price"), 490),
        2: _safe_to_int(row.get("slab_pre_pour_price"), 490),
        3: _safe_to_int(row.get("frame_inspection_price"), 490),
        4: _safe_to_int(row.get("lockup_pre_plaster_price"), 490),
        5: _safe_to_int(row.get("fixing_including_waterproofing_price"), 490),
        6: _safe_to_int(row.get("completion_pci_pre_handover_price"), 590),
        # Surcharges
        "extra_level_price": _safe_to_int(row.get("extra_level_price"), EXTRA_LEVEL_PRICE_DEFAULT),
        "extra_5_sq_price": _safe_to_int(row.get("extra_5_sq_price"), PER_STAGE_AREA_STEP_PRICE_DEFAULT),
        "granny_flat_price": _safe_to_int(row.get("granny_flat_price"), GRANNY_FLAT_PRICE_DEFAULT),
    }

    # Note is optional
    cfg["note"] = str(row.get("note") or "")

    return cfg  # type: ignore[return-value]


def _validate_stages(stages: Iterable[int]) -> list[int]:
    try:
        stage_list = list(stages)
    except TypeError as exc:  # not iterable
        raise ValueError("'stages' must be a list of integers between 1 and 6") from exc

    if not stage_list:
        raise ValueError("'stages' must include at least one stage")

    normalized: list[int] = []
    seen: set[int] = set()
    for s in stage_list:
        if not isinstance(s, int):
            raise ValueError("'stages' must contain integers only")
        if s < 1 or s > 6:
            raise ValueError("'stages' values must be between 1 and 6")
        if s in seen:
            continue
        seen.add(s)
        normalized.append(s)
    return normalized


def calculate(
    stages: Iterable[int],
    area_sq: int,
    property_category: str,
    levels: int = 1,
    granny_flat: bool = False,
    granny_flate: bool = False,
    **_extras: Any,
) -> dict:
    """
    Calculate the total price for service construction_stages.

    Rules:
      - Customers may purchase any subset of stages 1..6.
      - Base prices (for <= 25 sq): stages 1-5: 490 each, stage 6: 590.
      - Area surcharge: For every additional 1..5 sq over 25 sq, add 50 to EACH selected stage.
        Example: selecting 3 stages and being 12 sq over (i.e., 3 steps) adds 3 * 50 per stage = 450 total.
      - Levels pricing: includes 1 level. Each level above 1 adds 50 (quote-level, not per stage).
      - Basement: if yes, add 100 (quote-level).
      - Granny flat: if yes, add 300 (quote-level).
    """
    # Validate params
    if not isinstance(area_sq, int) or area_sq < 0:
        raise ValueError("'area_sq' must be a non-negative integer")
    if not isinstance(levels, int) or levels < 1:
        raise ValueError("'levels' must be an integer >= 1")

    # Validate property category (required)
    category_value = str(property_category).strip().lower()
    if category_value not in {"residential", "commercial"}:
        raise ValueError("property_category must be either 'residential' or 'commercial'")

    selected_stages = _validate_stages(stages)

    cfg = _fetch_pricing_config()

    # Area surcharge: increments of up to 5 sq above INCLUDED_AREA_SQ, applied per selected stage
    extra_area = max(0, area_sq - INCLUDED_AREA_SQ)
    area_steps = ceil(extra_area / AREA_STEP_SQ) if extra_area > 0 else 0
    per_stage_area_surcharge = area_steps * cfg["extra_5_sq_price"]

    # Per-stage prices (base + area surcharge per selected stage)
    stage_prices = [
        {"stage": s, "price": int(cfg[s] + per_stage_area_surcharge)} for s in sorted(selected_stages)
    ]
    stages_component = sum(item["price"] for item in stage_prices)

    # Levels surcharge: per extra level (quote-level charge)
    additional_levels = max(0, levels - INCLUDED_LEVELS)
    levels_surcharge = additional_levels * cfg["extra_level_price"]

    # Granny flat (accept both keys; either enables the charge)
    granny_enabled = bool(granny_flat) or bool(granny_flate)
    granny_surcharge = cfg["granny_flat_price"] if granny_enabled else 0

    quote_price = stages_component + levels_surcharge + granny_surcharge

    return {
        "stage_prices": stage_prices,
        "quote_price": int(quote_price),
        "note": str(cfg.get("note", "")),
    }



