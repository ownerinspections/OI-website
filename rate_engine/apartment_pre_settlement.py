from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict
from urllib.request import Request, urlopen


# Inclusion thresholds (included in base price)
INCLUDED_COMBINED_ROOMS = 2  # bedrooms + bathrooms included
INCLUDED_LEVELS = 1  # first level included (kept for parity, not charged extra here)

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

    Selects the row where service_type == 'apartment-pre-settlement'.
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
            if str(it.get("service_type")).strip().lower() == "apartment-pre-settlement":
                row = it
                break
        except Exception:
            continue
    if row is None:
        raise ValueError("Pricing for service 'apartment-pre-settlement' not found")

    cfg: Dict[str, int | str] = {
        "base_price": _safe_to_int(row.get("base_price"), 400),
        # Accept API keys that represent unit prices for extras
        "bedroom_price": _safe_to_int(row.get("bedrooms_price", row.get("bedroom_price", 50)), 50),
        "bathroom_price": _safe_to_int(row.get("bathroom_price", 50), 50),
        "note": str(row.get("note") or ""),
    }

    return cfg  # type: ignore[return-value]


def calculate(
    bedrooms: int,
    bathrooms: int,
    property_category: str,
    levels: int = 0,
    **_extras: Any,
) -> dict:
    """
    Calculate the basic price for service pre_purchase (no addons object; extras included in price).

    Inclusions:
      - 2 combined rooms (bedrooms + bathrooms) included in base_price
      - 1 level included in base_price

    Additions (ONLY for this service):
      - Extra bedrooms beyond the included 2 combined rooms: + bedroom_price each
      - Extra bathrooms beyond the included 2 combined rooms: + bathroom_price each

    Notes:
      - Extra levels and any other add-ons are NOT charged in this service.

    Pricing numbers are fetched from KONG gateway at `${KONG_GATEWAY_URL}/items/pre_purchase`.
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

    # Separate extras for bedrooms and bathrooms, while honoring the combined inclusions
    bedroom_unit = cfg.get("bedroom_price", 0)
    bathroom_unit = cfg.get("bathroom_price", 0)

    remaining_free = INCLUDED_COMBINED_ROOMS
    chargeable_bedrooms = max(0, bedrooms)
    chargeable_bathrooms = max(0, bathrooms)

    # Allocate free rooms to minimize total charge by using them on the higher-priced type first
    if bedroom_unit >= bathroom_unit:
        free_for_bedrooms = min(chargeable_bedrooms, remaining_free)
        chargeable_bedrooms -= free_for_bedrooms
        remaining_free -= free_for_bedrooms

        free_for_bathrooms = min(chargeable_bathrooms, remaining_free)
        chargeable_bathrooms -= free_for_bathrooms
        remaining_free -= free_for_bathrooms
    else:
        free_for_bathrooms = min(chargeable_bathrooms, remaining_free)
        chargeable_bathrooms -= free_for_bathrooms
        remaining_free -= free_for_bathrooms

        free_for_bedrooms = min(chargeable_bedrooms, remaining_free)
        chargeable_bedrooms -= free_for_bedrooms
        remaining_free -= free_for_bedrooms

    bedrooms_charge = chargeable_bedrooms * bedroom_unit
    bathrooms_charge = chargeable_bathrooms * bathroom_unit

    quote_price = base_component + bedrooms_charge + bathrooms_charge

    return {"quote_price": int(quote_price), "note": str(cfg.get("note", ""))}


