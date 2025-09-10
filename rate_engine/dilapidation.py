from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict
from urllib.request import Request, urlopen


# Inclusion thresholds (included in base price)
INCLUDED_COMBINED_ROOMS = 2  # bedrooms + bathrooms included
INCLUDED_LEVELS = 1  # first level included

# Options
ALLOWED_PROPERTY_USAGE = {"residentials", "commercials", "residential", "commercial"}


def _read_env_value(key: str) -> str | None:
    """Read an environment variable. If missing, attempt to read from a local .env file.

    This avoids introducing a runtime dependency on python-dotenv.
    """
    value = os.getenv(key)
    if value:
        return value

    # Attempt to load from .env colocated with this file
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
            # Best-effort; fall through to None
            pass
    return None


def _safe_to_int(value: Any, default: int = 0) -> int:
    try:
        if isinstance(value, bool):  # prevent True -> 1
            return default
        if isinstance(value, (int, float)):
            return int(value)
        if isinstance(value, str):
            return int(value.strip())
    except Exception:
        return default
    return default


def _fetch_pricing_config() -> Dict[str, int]:
    """Fetch pricing numbers from unified services endpoint and normalize to ints.

    Selects the row where service_type == 'dilapidation'.
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

    # Some environments may append stray characters after JSON (e.g., '%'). Try to be resilient.
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
            if str(it.get("service_type")).strip().lower() == "dilapidation":
                row = it
                break
        except Exception:
            continue
    if row is None:
        raise ValueError("Pricing for service 'dilapidation' not found")

    cfg: Dict[str, int | str] = {
        "base_price": _safe_to_int(row.get("base_price"), 400),
        # API provides 'bedrooms_price'; normalize to internal 'bedroom_price'
        "bedroom_price": _safe_to_int(row.get("bedrooms_price", row.get("bedroom_price", 50)), 50),
        "bathroom_price": _safe_to_int(row.get("bathroom_price"), 50),
        "extra_level_price": _safe_to_int(row.get("extra_level_price"), 100),
        "basement_price": _safe_to_int(row.get("basement_price"), 150),
        "granny_flat_price": _safe_to_int(row.get("granny_flat_price"), 350),
        # new optional in services for this service
        "swimming_pool_price": _safe_to_int(row.get("swimming_pool_price"), 0),
    }

    # Optional extras present in API; treat missing/None as 0
    # Deprecated: pest_inspection_price and drug_residue_price removed from calculation

    # Note is optional
    cfg["note"] = str(row.get("note") or "")

    return cfg  # type: ignore[return-value]


def calculate(
    bedrooms: int,
    bathrooms: int,
    property_category: str,
    levels: int = 0,
    basement: bool = False,
    granny_flat: bool = False,
    # removed: pest_inspection, drug_residue
    **_extras: Any,
) -> dict:
    """
    Calculate the basic price for service dilapidation (no addons object; extras included in price).

    Inclusions:
      - 2 combined rooms (bedrooms + bathrooms) included in base_price
      - 1 level included in base_price

    Additions:
      - Each room beyond the included 2: + unit price (prefers bedroom_price, else bathroom_price)
      - Each level beyond 1: + extra_level_price
      - basement: + basement_price when True
      - granny_flat: + granny_flat_price when True
      - pest_inspection: + pest_inspection_price when True
      - drug_residue: + drug_residue_price when True

    Pricing numbers are fetched from KONG gateway at `${KONG_GATEWAY_URL}/items/dilapidations`.
    """
    if bedrooms < 0 or bathrooms < 0 or levels < 0:
        raise ValueError("Bedrooms, bathrooms, and levels must be non-negative integers.")

    # Validate property category (required)
    category_value = str(property_category).strip().lower()
    if category_value not in {"residential", "commercial"}:
        raise ValueError("property_category must be either 'residential' or 'commercial'")

    cfg = _fetch_pricing_config()

    # Base component
    base_component = cfg["base_price"]

    # Property-related charges with inclusions
    total_rooms = max(0, bedrooms) + max(0, bathrooms)
    extra_rooms = max(0, total_rooms - INCLUDED_COMBINED_ROOMS)
    extra_room_unit_price = cfg.get("bedroom_price") or cfg.get("bathroom_price") or 0
    rooms_charge = extra_rooms * extra_room_unit_price

    additional_levels = max(0, levels - INCLUDED_LEVELS)
    levels_charge = additional_levels * cfg["extra_level_price"]
    basement_charge = cfg["basement_price"] if basement else 0
    granny_flat_charge = cfg["granny_flat_price"] if granny_flat else 0

    quote_price = base_component + rooms_charge + levels_charge + basement_charge + granny_flat_charge

    # Extra options removed

    return {
        "quote_price": int(quote_price),
        "note": str(cfg.get("note", "")),
    }


