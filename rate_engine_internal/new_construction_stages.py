from __future__ import annotations

from math import ceil
from typing import Iterable, Any, Dict
import os
from pathlib import Path

from addons import calculate_addons


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
    """Load pricing numbers from .env file and normalize to ints."""
    
    cfg: Dict[Any, int | str | float] = {
        # Stage prices
        1: _safe_to_int(_read_env_value("CONSTRUCTION_STAGE_1_PRICE"), 490),
        2: _safe_to_int(_read_env_value("CONSTRUCTION_STAGE_2_PRICE"), 490),
        3: _safe_to_int(_read_env_value("CONSTRUCTION_STAGE_3_PRICE"), 490),
        4: _safe_to_int(_read_env_value("CONSTRUCTION_STAGE_4_PRICE"), 490),
        5: _safe_to_int(_read_env_value("CONSTRUCTION_STAGE_5_PRICE"), 490),
        6: _safe_to_int(_read_env_value("CONSTRUCTION_STAGE_6_PRICE"), 590),
        # Surcharges
        "extra_level_price": _safe_to_int(_read_env_value("CONSTRUCTION_EXTRA_LEVEL_PRICE"), EXTRA_LEVEL_PRICE_DEFAULT),
        "extra_5_sq_price": _safe_to_int(_read_env_value("CONSTRUCTION_EXTRA_5_SQ_PRICE"), PER_STAGE_AREA_STEP_PRICE_DEFAULT),
        "granny_flat_price": _safe_to_int(_read_env_value("CONSTRUCTION_GRANNY_FLAT_PRICE"), GRANNY_FLAT_PRICE_DEFAULT),
        "gst_percentage": float(_read_env_value("GST_PERCENTAGE") or "10"),
        "note": _read_env_value("CONSTRUCTION_NOTE") or "",
    }

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
    Calculate the total price for service new_construction_stages including addons.

    Rules:
      - Customers may purchase any subset of stages 1..6.
      - Base prices (for <= 25 sq): stages 1-5: 490 each, stage 6: 590.
      - Area surcharge: For every additional 1..5 sq over 25 sq, add 50 to EACH selected stage.
        Example: selecting 3 stages and being 12 sq over (i.e., 3 steps) adds 3 * 50 per stage = 450 total.
      - Granny flat: if yes, add granny_flat_price to EACH selected stage.
      - Out-of-area travel: if specified (km), the travel cost (price_per_km × km) is added to EACH selected stage.
        Example: $1/km × 50 km = $50 added to each stage. With 3 stages, total travel cost = $150.
      - Levels pricing: includes 1 level. Each level above 1 adds 50 (quote-level, not per stage).

    Addons (optional):
      - All addon pricing from addons module (except out_of_area_travel which is in stage prices)
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

    # Granny flat (accept both keys; either enables the charge) - applied per stage
    granny_enabled = bool(granny_flat) or bool(granny_flate)
    per_stage_granny_surcharge = cfg["granny_flat_price"] if granny_enabled else 0

    # Out-of-area travel surcharge - add full travel cost to EACH stage
    from addons import ADDON_PRICES
    travel_price_per_km = ADDON_PRICES.get("out_of_area_travel_surcharge_per_km", 0) or 0
    per_stage_travel_surcharge = int(travel_price_per_km * out_of_area_travel_surcharge_per_km)

    # Per-stage prices (base + area surcharge + granny flat + travel surcharge per selected stage)
    stage_prices = [
        {"stage": s, "price": int(cfg[s] + per_stage_area_surcharge + per_stage_granny_surcharge + per_stage_travel_surcharge)} for s in sorted(selected_stages)
    ]
    stages_component = sum(item["price"] for item in stage_prices)

    # Levels surcharge: per extra level (quote-level charge)
    additional_levels = max(0, levels - INCLUDED_LEVELS)
    levels_surcharge = additional_levels * cfg["extra_level_price"]

    quote_price = stages_component + levels_surcharge

    # Calculate addons (excluding out_of_area_travel since it's already in stage prices)
    selected_addons = {
        "shed_garage_carport_inspection": shed_garage_carport_inspection,
        "roof_void_inspection": roof_void_inspection,
        "express_report_delivery": express_report_delivery,
        # out_of_area_travel_surcharge_per_km is already added to stage prices above, so exclude it here
        "pest_inspection": pest_inspection,
        "drug_residue": drug_residue,
        "thermal_imaging_moisture_meter": thermal_imaging_moisture_meter,
        "drone_roof_inspection": drone_roof_inspection,
        "video": video,
    }
    
    addons_result = calculate_addons(selected_addons)
    addons_total = addons_result["total"]
    # Note: out_of_area_travel_surcharge is already included in stage prices above
    
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
        "stage_prices": stage_prices,
        "quote_price": int(quote_price),
        "gst": int(gst_amount),
        "price_including_gst": int(price_including_gst),
        "discount": discount_amount,
        "payable_price": int(payable_price),
        "addons": addons_result["breakdown"],
        "addons_total": int(addons_total),
        "note": str(cfg.get("note", "")),
    }



