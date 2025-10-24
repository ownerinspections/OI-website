from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict

from addons import calculate_addons


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
        "document_review_and_inspection_price": _safe_to_int(
            _read_env_value("EXPERT_WITNESS_STAGE_1_PRICE"), 350
        ),
        "detailed_report_preparation_price": _safe_to_int(
            _read_env_value("EXPERT_WITNESS_STAGE_2_PRICE"), 350
        ),
        "repair_cost_estimatescott_schedule": _safe_to_int(
            _read_env_value("EXPERT_WITNESS_STAGE_3_PRICE"), 350
        ),
        "gst_percentage": float(_read_env_value("GST_PERCENTAGE") or "10"),
        "note": _read_env_value("EXPERT_WITNESS_NOTE") or "",
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


def calculate(
    stages: Any, 
    property_category: str, 
    number_of_hours_stage_1: int = 7, 
    number_of_hours_stage_2: int = 0, 
    number_of_hours_stage_3: int = 0, 
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
    **_extras: Any
) -> dict:
    """
    Calculate total price for expert witness report with multiple stages including addons.
    
    Each stage price is multiplied by its respective number of hours.
    The quote_price is the sum of all selected stages' prices.
    
    Stage 1: minimum 7 hours
    Stage 2 and 3: minimum 0 hours (can be 0)

    Addons (optional):
      - All addon pricing from addons module
    
    Pricing numbers are loaded from .env file.
    """
    # Validate property category (required)
    category_value = str(property_category).strip().lower()
    if category_value not in {"residential", "commercial"}:
        raise ValueError("property_category must be either 'residential' or 'commercial'")

    selected_stages = _validate_stages(stages)

    cfg = _fetch_pricing_config()
    
    # Validate number of hours for each stage
    if not isinstance(number_of_hours_stage_1, int) or number_of_hours_stage_1 < 7:
        raise ValueError("'number_of_hours_stage_1' must be an integer >= 7")
    if not isinstance(number_of_hours_stage_2, int) or number_of_hours_stage_2 < 0:
        raise ValueError("'number_of_hours_stage_2' must be an integer >= 0")
    if not isinstance(number_of_hours_stage_3, int) or number_of_hours_stage_3 < 0:
        raise ValueError("'number_of_hours_stage_3' must be an integer >= 0")

    stage_base_price_map: Dict[int, int] = {
        1: int(cfg["document_review_and_inspection_price"]),
        2: int(cfg["detailed_report_preparation_price"]),
        3: int(cfg["repair_cost_estimatescott_schedule"]),
    }

    hours_map: Dict[int, int] = {
        1: number_of_hours_stage_1,
        2: number_of_hours_stage_2,
        3: number_of_hours_stage_3,
    }

    stage_prices = [
        {"stage": s, "price": stage_base_price_map[s] * hours_map[s]} for s in sorted(selected_stages)
    ]

    # All selected stages contribute to quote_price
    quote_price = sum(item["price"] for item in stage_prices)

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
        "stage_prices": stage_prices,
        "quote_price": int(quote_price),
        "gst": int(gst_amount),
        "price_including_gst": int(price_including_gst),
        "discount": discount_amount,
        "payable_price": int(payable_price),
        "addons": addons_result["breakdown"],
        "addons_total": int(addons_total),
        "note": cfg.get("note", ""),
    }



