from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict

from addons import calculate_addons


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
    """Load pricing numbers from .env file and normalize to ints."""
    
    cfg: Dict[str, int | str | float] = {
        "base_price": _safe_to_int(_read_env_value("APARTMENT_PRE_SETTLEMENT_BASE_PRICE"), 400),
        "bedroom_price": _safe_to_int(_read_env_value("APARTMENT_PRE_SETTLEMENT_BEDROOM_PRICE"), 50),
        "bathroom_price": _safe_to_int(_read_env_value("APARTMENT_PRE_SETTLEMENT_BATHROOM_PRICE"), 50),
        "gst_percentage": float(_read_env_value("GST_PERCENTAGE") or "10"),
        "note": _read_env_value("APARTMENT_PRE_SETTLEMENT_NOTE") or "",
    }

    return cfg  # type: ignore[return-value]


def calculate(
    bedrooms: int,
    bathrooms: int,
    property_category: str,
    levels: int = 0,
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
    Calculate the price for service apartment-pre-settlement including addons.

    Inclusions:
      - 2 combined rooms (bedrooms + bathrooms) included in base_price
      - 1 level included in base_price

    Additions (ONLY for this service):
      - Extra bedrooms beyond the included 2 combined rooms: + bedroom_price each
      - Extra bathrooms beyond the included 2 combined rooms: + bathroom_price each

    Addons (optional):
      - All addon pricing from addons module

    Notes:
      - Extra levels are NOT charged in this service.

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


