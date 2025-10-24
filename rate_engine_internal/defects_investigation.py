from __future__ import annotations

from typing import Iterable, Any, Dict
import os
from pathlib import Path

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
        1: _safe_to_int(_read_env_value("DEFECTS_INVESTIGATION_STAGE_1_PRICE"), 1500),
        2: _safe_to_int(_read_env_value("DEFECTS_INVESTIGATION_STAGE_2_PRICE"), 1500),
        "gst_percentage": float(_read_env_value("GST_PERCENTAGE") or "10"),
        "note": _read_env_value("DEFECTS_INVESTIGATION_NOTE") or "",
    }


def _validate_stages(stages: Iterable[int]) -> list[int]:
    try:
        stage_list = list(stages)
    except TypeError as exc:
        raise ValueError("'stages' must be a list of integers between 1 and 2") from exc

    if not stage_list:
        raise ValueError("'stages' must include at least one stage")

    normalized: list[int] = []
    seen: set[int] = set()
    for s in stage_list:
        if not isinstance(s, int):
            raise ValueError("'stages' must contain integers only")
        if s < 1 or s > 2:
            raise ValueError("'stages' values must be between 1 and 2")
        if s in seen:
            continue
        seen.add(s)
        normalized.append(s)
    return normalized


def calculate(
    stages: Iterable[int],
    property_category: str,
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
    """Calculate total and per-stage prices for defects_investigation including addons.

    Rules:
      - 2 stages with base prices loaded from .env:
          1: document review and inspection
          2: detailed report preparation
      - No surcharges; simply sum selected stages.

    Addons (optional):
      - All addon pricing from addons module
    """
    # Validate property category (required)
    category_value = str(property_category).strip().lower()
    if category_value not in {"residential", "commercial"}:
        raise ValueError("property_category must be either 'residential' or 'commercial'")

    selected_stages = _validate_stages(stages)

    cfg = _fetch_pricing_config()

    stage_prices = [
        {"stage": s, "price": int(cfg[s])} for s in sorted(selected_stages)
    ]
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



