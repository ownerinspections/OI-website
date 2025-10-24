from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict

from addons import calculate_addons


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
    """Load pricing numbers from .env file and normalize to ints."""
    
    cfg: Dict[str, int | str | float] = {
        "base_price": _safe_to_int(_read_env_value("PRE_PURCHASE_BASE_PRICE"), 400),
        "bedroom_price": _safe_to_int(_read_env_value("PRE_PURCHASE_BEDROOM_PRICE"), 50),
        "bathroom_price": _safe_to_int(_read_env_value("PRE_PURCHASE_BATHROOM_PRICE"), 50),
        "extra_level_price": _safe_to_int(_read_env_value("PRE_PURCHASE_EXTRA_LEVEL_PRICE"), 100),
        "basement_price": _safe_to_int(_read_env_value("PRE_PURCHASE_BASEMENT_PRICE"), 150),
        "granny_flat_price": _safe_to_int(_read_env_value("PRE_PURCHASE_GRANNY_FLAT_PRICE"), 350),
        "gst_percentage": float(_read_env_value("GST_PERCENTAGE") or "10"),
        "note": _read_env_value("PRE_PURCHASE_NOTE") or "",
    }

    return cfg  # type: ignore[return-value]


def calculate(
    bedrooms: int,
    bathrooms: int,
    property_category: str,
    levels: int = 0,
    basement: bool = False,
    granny_flat: bool = False,
    discount: int = 0,
    # Addons
    shed_garage_carport_inspection: bool = False,
    roof_void_inspection: bool = False,
    express_report_delivery: bool = False,
    out_of_area_travel_surcharge_per_km: int = 0,
    pest_inspection: bool = False,
    drug_residue: bool = False,
    thermal_imaging_moisture_meter: bool = False,
    drone_roof_inspection: bool = False,
    video: bool = False,
    **_extras: Any,
) -> dict:
    """
    Calculate the price for service pre_purchase including addons.

    Inclusions:
      - 2 combined rooms (bedrooms + bathrooms) included in base_price
      - 1 level included in base_price

    Additions:
      - Each room beyond the included 2: + unit price (prefers bedroom_price, else bathroom_price)
      - Each level beyond 1: + extra_level_price
      - basement: + basement_price when True
      - granny_flat: + granny_flat_price when True

    Addons (optional):
      - All addon pricing from addons module

    Pricing numbers are loaded from .env file.
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

    # Calculate addons
    selected_addons = {
        "shed_garage_carport_inspection": shed_garage_carport_inspection,
        "roof_void_inspection": roof_void_inspection,
        "express_report_delivery": express_report_delivery,
        "out_of_area_travel_surcharge_per_km": out_of_area_travel_surcharge_per_km,
        "pest_inspection": pest_inspection,
        "drug_residue": drug_residue,
        "thermal_imaging_moisture_meter": thermal_imaging_moisture_meter,
        "drone_roof_inspection": drone_roof_inspection,
        "video": video,
    }
    
    addons_result = calculate_addons(selected_addons)
    addons_total = addons_result["total"]
    
    # Add addons to quote price
    quote_price += addons_total

    # Calculate GST
    gst_percentage = cfg.get("gst_percentage", 10)
    gst_amount = quote_price * (gst_percentage / 100)
    price_including_gst = quote_price + gst_amount

    # Apply discount and calculate payable price
    discount_amount = max(0, int(discount))  # Ensure non-negative
    payable_price = max(0, price_including_gst - discount_amount)  # Cannot be negative

    return {
        "quote_price": int(quote_price),
        "gst": int(gst_amount),
        "price_including_gst": int(price_including_gst),
        "discount": discount_amount,
        "payable_price": int(payable_price),
        "addons": addons_result["breakdown"],
        "addons_total": int(addons_total),
        "note": str(cfg.get("note", "")),
    }


