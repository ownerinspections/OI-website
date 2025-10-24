from __future__ import annotations

from math import ceil
from typing import Any, Dict
import os
from pathlib import Path

from addons import calculate_addons


# Inclusion thresholds for apartment
INCLUDED_COMBINED_ROOMS = 2  # bedrooms + bathrooms included for apartment
INCLUDED_LEVELS = 1  # first level included

# Area surcharge config for house
INCLUDED_AREA_SQ = 25  # up to this area has no area surcharge
AREA_STEP_SQ = 5  # each additional block of 1..5 sq above INCLUDED_AREA_SQ
PER_STAGE_AREA_STEP_PRICE_DEFAULT = 50

# Options
EXTRA_LEVEL_PRICE_DEFAULT = 50
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


def _fetch_pricing_config() -> Dict[str, int | str | float]:
    """Load pricing numbers from .env file and normalize to ints."""
    
    return {
        # House (like construction stage 6)
        "house_base_price": _safe_to_int(_read_env_value("PRE_HANDOVER_HOUSE_BASE_PRICE"), 590),
        "extra_5_sq_price": _safe_to_int(_read_env_value("PRE_HANDOVER_EXTRA_5_SQ_PRICE"), PER_STAGE_AREA_STEP_PRICE_DEFAULT),
        "extra_level_price": _safe_to_int(_read_env_value("PRE_HANDOVER_EXTRA_LEVEL_PRICE"), EXTRA_LEVEL_PRICE_DEFAULT),
        "granny_flat_price": _safe_to_int(_read_env_value("PRE_HANDOVER_GRANNY_FLAT_PRICE"), GRANNY_FLAT_PRICE_DEFAULT),
        # Apartment (like apartment pre settlement)
        "apartment_base_price": _safe_to_int(_read_env_value("PRE_HANDOVER_APARTMENT_BASE_PRICE"), 400),
        "bedroom_price": _safe_to_int(_read_env_value("PRE_HANDOVER_BEDROOM_PRICE"), 50),
        "bathroom_price": _safe_to_int(_read_env_value("PRE_HANDOVER_BATHROOM_PRICE"), 50),
        # Common
        "gst_percentage": float(_read_env_value("GST_PERCENTAGE") or "10"),
        "note": _read_env_value("PRE_HANDOVER_NOTE") or "",
    }


def calculate(
    property_type: str,
    property_category: str,
    bedrooms: int = 0,
    bathrooms: int = 0,
    area_sq: int = 0,
    levels: int = 1,
    granny_flat: bool = False,
    granny_flate: bool = False,
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
    Calculate the price for pre_handover service including addons.
    
    If property_type is 'house', calculation is like new_construction_stages stage 6.
    If property_type is 'apartment', calculation is like apartment_pre_settlement.
    
    House calculation:
      - Base price for stage 6 (590)
      - Area surcharge: For every additional 1..5 sq over 25 sq, add 50
      - Granny flat: if yes, add granny_flat_price
      - Levels pricing: includes 1 level. Each level above 1 adds 50
    
    Apartment calculation:
      - Base price (400)
      - 2 combined rooms (bedrooms + bathrooms) included in base_price
      - Each additional room: + unit price

    Addons (optional):
      - All addon pricing from addons module
    
    Pricing numbers are loaded from .env file.
    """
    # Validate property type (required)
    prop_type = str(property_type).strip().lower()
    if prop_type not in {"house", "apartment"}:
        raise ValueError("property_type must be either 'house' or 'apartment'")
    
    # Validate property category (required)
    category_value = str(property_category).strip().lower()
    if category_value not in {"residential", "commercial"}:
        raise ValueError("property_category must be either 'residential' or 'commercial'")

    cfg = _fetch_pricing_config()

    if prop_type == "house":
        # House calculation (like new_construction_stages stage 6)
        if not isinstance(area_sq, int) or area_sq < 0:
            raise ValueError("'area_sq' must be a non-negative integer")
        if not isinstance(levels, int) or levels < 1:
            raise ValueError("'levels' must be an integer >= 1")

        # Area surcharge
        extra_area = max(0, area_sq - INCLUDED_AREA_SQ)
        area_steps = ceil(extra_area / AREA_STEP_SQ) if extra_area > 0 else 0
        area_surcharge = area_steps * cfg["extra_5_sq_price"]

        # Granny flat (accept both keys)
        granny_enabled = bool(granny_flat) or bool(granny_flate)
        granny_surcharge = cfg["granny_flat_price"] if granny_enabled else 0

        # Base price + area + granny flat
        base_component = cfg["house_base_price"] + area_surcharge + granny_surcharge

        # Levels surcharge
        additional_levels = max(0, levels - INCLUDED_LEVELS)
        levels_surcharge = additional_levels * cfg["extra_level_price"]

        quote_price = base_component + levels_surcharge

    else:  # apartment
        # Apartment calculation (like apartment_pre_settlement)
        if bedrooms < 0 or bathrooms < 0:
            raise ValueError("Bedrooms and bathrooms must be non-negative integers.")

        # Base component
        base_component = cfg["apartment_base_price"]

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

