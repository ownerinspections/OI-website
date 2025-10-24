from __future__ import annotations

from pathlib import Path
import importlib.util
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


app = FastAPI()


class QuoteRequest(BaseModel):
    service: str

    class Config:
        extra = "allow"  # Allow arbitrary fields for service-specific params


class StagePrice(BaseModel):
    stage: int
    price: int


class AddonItem(BaseModel):
    name: str
    price: int


class QuoteResponse(BaseModel):
    # Keep stage breakdown before the final quote for readability
    stage_prices: Optional[List[StagePrice]] = None
    quote_price: int
    gst: Optional[int] = None
    price_including_gst: Optional[int] = None
    discount: Optional[int] = None
    payable_price: Optional[int] = None
    addons: Optional[List[AddonItem]] = None
    addons_total: Optional[int] = None
    note: str = "this is a test note"


_SERVICE_MODULE_CACHE: Dict[str, Any] = {}
_SERVICE_ALIASES = {
    "oi-950-1": "pre_purchase",
    # Backward-compatible alias: old service key points to new module name
    "oi-950-3": "new_construction_stages",
    "prepurchase": "pre_purchase",
    "pre-purchase": "pre_purchase",
    "pre_purchase": "pre_purchase",
    "pre-sales": "pre_sales",
    "presales": "pre_sales",
    "pre_sales": "pre_sales",
    "dilapidation": "dilapidation",
    "construction_stages": "new_construction_stages",
    "new_construction_stages": "new_construction_stages",
    # Apartment pre-settlement aliases
    "apartment-pre-settlement": "apartment_pre_settlement",
    "apartment_pre_settlement": "apartment_pre_settlement",
    # Insurance Report aliases
    "insurance_report": "insurance_report",
    "insurance-report": "insurance_report",
    # Defects Investigation aliases
    "defects_investigation": "defects_investigation",
    "defects-investigation": "defects_investigation",
    # Expert Witness Report aliases
    "expert_witness_report": "expert_witness_report",
    "expert-witness-report": "expert_witness_report",
    # Pre-Handover aliases
    "pre_handover": "pre_handover",
    "pre-handover": "pre_handover",
    "prehandover": "pre_handover",
    # Drug Resistance aliases
    "drug_resistance": "drug_resistance",
    "drug-resistance": "drug_resistance",
    "drugresistance": "drug_resistance",
    # Building and Pest aliases
    "building_and_pest": "building_and_pest",
    "building-and-pest": "building_and_pest",
    "buildingandpest": "building_and_pest",
    "building_pest": "building_and_pest",
    "building-pest": "building_and_pest",
}

# Per-service notes for API responses
_SERVICE_NOTES: Dict[str, str] = {
    "pre_purchase": "this is a test note for pre_purchase",
    "pre_sales": "this is a test note for pre_sales",
    "dilapidation": "this is a test note for dilapidation",
    "new_construction_stages": "this is a test note for new construction stages",
    "apartment_pre_settlement": "this is a test note for apartment pre-settlement",
    "insurance_report": "this is a test note for insurance report",
    "defects_investigation": "this is a test note for defects investigation",
    "expert_witness_report": "this is a test note for expert witness report",
    "pre_handover": "this is a test note for pre-handover",
    "drug_resistance": "this is a test note for drug resistance",
    "building_and_pest": "this is a test note for building and pest inspection",
}


def _load_service_module(service_name: str):
    """Dynamically load a service module by its file name (without .py).

    The module file is expected to live next to this app file, e.g. `oi-950-1.py`.
    """
    if not service_name or "/" in service_name or service_name.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid service name")

    # Cache hit
    if service_name in _SERVICE_MODULE_CACHE:
        return _SERVICE_MODULE_CACHE[service_name]

    # Resolve aliases (backward compatibility)
    resolved_service_name = _SERVICE_ALIASES.get(service_name, service_name)

    module_filename = f"{resolved_service_name}.py"
    module_path = Path(__file__).with_name(module_filename)
    if not module_path.exists():
        raise HTTPException(status_code=404, detail="Service not found")

    # Use a safe module name replacing dashes with underscores for Python
    module_name = resolved_service_name.replace("-", "_")
    spec = importlib.util.spec_from_file_location(module_name, str(module_path))
    if spec is None or spec.loader is None:
        raise HTTPException(status_code=500, detail="Unable to load service module")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[assignment]

    # Ensure the module exposes a callable `calculate`
    calculate = getattr(module, "calculate", None)
    if not callable(calculate):
        raise HTTPException(status_code=500, detail="Service module missing callable 'calculate'")

    _SERVICE_MODULE_CACHE[service_name] = module
    return module


def _run_service_calculation(service_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
    module = _load_service_module(service_name)
    calculate = getattr(module, "calculate")
    try:
        result = calculate(**params)
    except TypeError as exc:
        # Likely unexpected or missing parameters for the service
        raise HTTPException(status_code=400, detail=str(exc))
    except ValueError as exc:
        # Validation error raised by the service
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # pragma: no cover - safeguard for unknown errors
        raise HTTPException(status_code=500, detail="Calculation failed") from exc

    if not isinstance(result, dict):
        raise HTTPException(status_code=500, detail="Service did not return a breakdown dictionary")
    if "quote_price" not in result:
        raise HTTPException(status_code=500, detail="Service result missing 'quote_price'")
    try:
        result["quote_price"] = int(result["quote_price"]) 
    except Exception as exc:  # pragma: no cover - enforce numeric breakdown
        raise HTTPException(status_code=500, detail="Service field 'quote_price' is not numeric") from exc

    response: Dict[str, Any] = {"quote_price": result["quote_price"]}
    
    # Pass through gst if provided by the calculator
    if "gst" in result:
        try:
            response["gst"] = int(result["gst"])
        except Exception:
            pass
    
    # Pass through price_including_gst if provided by the calculator
    if "price_including_gst" in result:
        try:
            response["price_including_gst"] = int(result["price_including_gst"])
        except Exception:
            pass
    
    # Pass through discount if provided by the calculator
    if "discount" in result:
        try:
            response["discount"] = int(result["discount"])
        except Exception:
            pass
    
    # Pass through payable_price if provided by the calculator
    if "payable_price" in result:
        try:
            response["payable_price"] = int(result["payable_price"])
        except Exception:
            pass
    
    # Pass through stage_prices if provided by the calculator (e.g., new construction stages)
    if isinstance(result.get("stage_prices"), list):
        normalized_stage_prices: List[Dict[str, int]] = []
        for item in result["stage_prices"]:
            try:
                stage_num = int(item.get("stage"))
                stage_price = int(item.get("price"))
                normalized_stage_prices.append({"stage": stage_num, "price": stage_price})
            except Exception:
                continue
        if normalized_stage_prices:
            response["stage_prices"] = normalized_stage_prices
    
    # Pass through addons if provided by the calculator
    if isinstance(result.get("addons"), list):
        normalized_addons: List[Dict[str, Any]] = []
        for item in result["addons"]:
            try:
                addon_name = str(item.get("name", ""))
                # The addon breakdown uses 'cost' field, map it to 'price' for the response
                addon_price = int(item.get("cost", 0) or item.get("price", 0))
                if addon_name:  # Only include addons with valid names
                    normalized_addons.append({"name": addon_name, "price": addon_price})
            except Exception:
                continue
        if normalized_addons:
            response["addons"] = normalized_addons
    
    # Pass through addons_total if provided by the calculator
    if "addons_total" in result:
        try:
            response["addons_total"] = int(result["addons_total"])
        except Exception:
            pass

    # Pass through service-provided note if any; final decision done in route handler
    svc_note = result.get("note")
    if isinstance(svc_note, str) and svc_note.strip():
        response["note"] = svc_note

    return response


@app.post("/api/v1/quotes/estimate", response_model=QuoteResponse)
async def post_quote_estimate(payload: QuoteRequest) -> QuoteResponse:
    params = payload.model_dump()
    service = params.pop("service", None)
    if not service:
        raise HTTPException(status_code=400, detail="Missing required 'service' in payload")

    normalized_params = _normalize_params(params)
    # Resolve to canonical service key for consistent behavior
    canonical_service = _SERVICE_ALIASES.get(service, service)
    # Service-specific param adjustments: none required for levels handling.
    result = _run_service_calculation(service, normalized_params)
    # Attach service-provided note if available; otherwise fallback to static mapping
    note_from_service = result.get("note")
    if isinstance(note_from_service, str) and note_from_service.strip():
        result_note = note_from_service
    else:
        result_note = _SERVICE_NOTES.get(canonical_service, "this is a test note")
    result["note"] = result_note
    return QuoteResponse(**result)


def _normalize_params(params: Dict[str, Any]) -> Dict[str, Any]:
    """Generic normalization for request parameters sent to service modules.

    - Convert 'yes'/'no' (case-insensitive) and 'true'/'false' strings to booleans
    - Convert numeric-looking strings to integers
    - Rename legacy keys to current naming (e.g., 'extra_levels' -> 'levels')
    """
    normalized: Dict[str, Any] = {}
    for key, value in params.items():
        # yes/no or true/false strings to bool
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in {"yes", "true"}:
                value = True
            elif lowered in {"no", "false"}:
                value = False
            else:
                # convert pure integer strings to ints
                stripped = value.strip()
                if stripped.isdigit() or (stripped.startswith("-") and stripped[1:].isdigit()):
                    try:
                        value = int(stripped)
                    except Exception:
                        pass

        normalized[key] = value

    # Key renames
    # Consolidate to 'levels' as the canonical key (no support for extra_levels/extra_level)
    if "levels" not in normalized:
        if "number_of_levels" in normalized:
            normalized["levels"] = normalized.pop("number_of_levels")
        elif "level" in normalized:
            normalized["levels"] = normalized.pop("level")
    # pest_inspection removed from payload support

    # Normalize alias for owner neighbor access key
    if "owner_inspection_arranging_to_access_neighbors" in normalized and "owner_access_neighbors" not in normalized:
        normalized["owner_access_neighbors"] = normalized.pop(
            "owner_inspection_arranging_to_access_neighbors"
        )

    # Accept common typo for granny flat
    if "granny_flate" in normalized and "granny_flat" not in normalized:
        normalized["granny_flat"] = normalized.pop("granny_flate")

    # Backward compat: video_23 -> video
    if "video_23" in normalized and "video" not in normalized:
        normalized["video"] = normalized.pop("video_23")

    # Normalize property category key aliases/typos
    if "property_category" not in normalized:
        if "usage_type" in normalized:
            normalized["property_category"] = normalized.pop("usage_type")
        elif "property_usage" in normalized:
            normalized["property_category"] = normalized.pop("property_usage")
        elif "propert_usage" in normalized:
            normalized["property_category"] = normalized.pop("propert_usage")

    # Accept Swimming_pool as alias for swimming_pool param
    if "Swimming_pool" in normalized and "swimming_pool" not in normalized:
        normalized["swimming_pool"] = normalized.pop("Swimming_pool")

    return normalized


if __name__ == "__main__":
    # Run: uvicorn app:app --reload
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8020, reload=True)


