from __future__ import annotations

from math import ceil
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


def _fetch_pricing_config() -> Dict[str, int]:
    """Load pricing numbers from .env file and normalize to ints."""
    
    return {
        1: _safe_to_int(_read_env_value("INSURANCE_STAGE_1_PRICE"), 1500),
        2: _safe_to_int(_read_env_value("INSURANCE_STAGE_2_PRICE"), 1500),
        3: _safe_to_int(_read_env_value("INSURANCE_STAGE_3_PRICE"), 1500),
        "threshold_loss": _safe_to_int(_read_env_value("INSURANCE_THRESHOLD_LOSS"), 100_000),
        "stage2_step_price": _safe_to_int(_read_env_value("INSURANCE_STAGE_2_STEP_PRICE"), 1000),
        "stage3_step_price": _safe_to_int(_read_env_value("INSURANCE_STAGE_3_STEP_PRICE"), 1000),
        "gst_percentage": float(_read_env_value("GST_PERCENTAGE") or "10"),
        "note": _read_env_value("INSURANCE_NOTE") or "",
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
    """Calculate total and per-stage prices for insurance_report including addons.

    Rules:
      - 3 stages with base prices loaded from .env:
          1: document review and inspection
          2: detailed report preparation
          3: cost estimate
      - Base prices apply when estimated_damage_loss <= threshold.
      - Stage 1 is always fixed price (no surcharge above threshold).
      - For loss above threshold: for every additional 100,000 (rounded up), add configured step price
        to stages 2 and 3 respectively.

    Addons (optional):
      - All addon pricing from addons module
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



