"""
Addon pricing module for Owner Inspections services.
This module handles all addon calculations that can be applied across different services.
"""

import os
from dotenv import load_dotenv

load_dotenv()


def _get_addon_price(key: str):
    """Helper function to get addon price from environment variable."""
    value = os.getenv(key)
    if value is None or value.upper() == "XXX":
        return None
    try:
        return float(value)
    except ValueError:
        return None


# ⏱️ Booking & Convenience
ADDON_OUT_OF_AREA_TRAVEL_SURCHARGE_PER_KM = _get_addon_price("ADDON_OUT_OF_AREA_TRAVEL_SURCHARGE_PER_KM")

# 🐜 Environmental / Hazard
ADDON_PEST_INSPECTION = _get_addon_price("ADDON_PEST_INSPECTION")
ADDON_DRUG_RESIDUE = _get_addon_price("ADDON_DRUG_RESIDUE")

# 🛰️ Technology & Media
ADDON_THERMAL_IMAGING_MOISTURE_METER = _get_addon_price("ADDON_THERMAL_IMAGING_MOISTURE_METER")
ADDON_DRONE_ROOF_INSPECTION = _get_addon_price("ADDON_DRONE_ROOF_INSPECTION")
ADDON_VIDEO = _get_addon_price("ADDON_VIDEO")


ADDON_PRICES = {
    "out_of_area_travel_surcharge_per_km": ADDON_OUT_OF_AREA_TRAVEL_SURCHARGE_PER_KM,
    "pest_inspection": ADDON_PEST_INSPECTION,
    "drug_residue": ADDON_DRUG_RESIDUE,
    "thermal_imaging_moisture_meter": ADDON_THERMAL_IMAGING_MOISTURE_METER,
    "drone_roof_inspection": ADDON_DRONE_ROOF_INSPECTION,
    "video": ADDON_VIDEO,
}


def calculate_addons(selected_addons: dict) -> dict:
    """
    Calculate the total cost of selected addons.
    
    Args:
        selected_addons: Dictionary with addon names as keys and values indicating selection.
                        For distance-based addons (like out_of_area_travel), value should be the distance.
                        For boolean addons, value should be True/False or 1/0.
    
    Returns:
        Dictionary containing:
        - total: Total addon cost
        - breakdown: List of applied addons with individual costs
        - unavailable: List of addons that were requested but have no pricing
    
    Example:
        selected_addons = {
            "pest_inspection": True,
            "thermal_imaging_moisture_meter": True,
            "out_of_area_travel_surcharge_per_km": 50  # 50km distance
        }
    """
    total = 0
    breakdown = []
    unavailable = []
    
    for addon_name, addon_value in selected_addons.items():
        if not addon_value:
            continue
            
        if addon_name not in ADDON_PRICES:
            continue
            
        price = ADDON_PRICES[addon_name]
        
        if price is None:
            unavailable.append(addon_name)
            continue
        
        # Handle distance-based pricing (e.g., per km surcharge)
        if addon_name == "out_of_area_travel_surcharge_per_km" and isinstance(addon_value, (int, float)):
            cost = price * addon_value
            breakdown.append({
                "name": addon_name,
                "unit_price": price,
                "quantity": addon_value,
                "cost": cost
            })
            total += cost
        else:
            # Standard boolean addon
            breakdown.append({
                "name": addon_name,
                "unit_price": price,
                "quantity": 1,
                "cost": price
            })
            total += price
    
    return {
        "total": total,
        "breakdown": breakdown,
        "unavailable": unavailable
    }


def get_available_addons() -> dict:
    """
    Get all available addons with their prices.
    
    Returns:
        Dictionary of addon names and their prices (None if pricing not available)
    """
    return ADDON_PRICES.copy()

