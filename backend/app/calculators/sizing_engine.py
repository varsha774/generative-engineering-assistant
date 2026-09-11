"""
Deterministic Sizing Engine for Low-Voltage Motor-Starter Panels.
SAFETY DIRECTIVE:
All numerical calculations are strictly deterministic and rule-bound.
The AI is NEVER permitted to calculate or guess engineering values.
Note: These demo formulas represent an educational engineering subset
and do not replace a full licensed IEC 60947 / UL 508A engineering review.
"""

from typing import Dict, Any, List


def calculate_required_contactor_rating(
    motor_current_a: float,
    starter_type: str = "DOL",
    safety_margin: float = 1.20
) -> Dict[str, Any]:
    """
    Calculate minimum continuous operational current rating (AC-3 duty)
    for the motor contactor.
    Formula: I_req = I_FLC * safety_margin (Default 1.20 for DOL duty)
    """
    if motor_current_a <= 0:
        return {
            "calculation_id": "CALC-001",
            "name": "Contactor requirement",
            "input_current_a": motor_current_a,
            "result_a": 0,
            "unit": "A",
            "status": "FAIL",
            "formula_id": "FORM-CONT-01",
            "assumptions": "Motor full-load current must be positive non-zero.",
            "error": "Invalid motor current"
        }

    # For DOL, contactor carries full phase current under AC-3 starting surges
    multiplier = safety_margin if starter_type.upper() == "DOL" else 1.00
    calculated_rating = round(motor_current_a * multiplier, 2)

    return {
        "calculation_id": "CALC-001",
        "name": "Contactor requirement",
        "input_current_a": motor_current_a,
        "starter_type": starter_type,
        "multiplier": multiplier,
        "result_a": calculated_rating,
        "unit": "A",
        "status": "PASS",
        "formula_id": "FORM-CONT-01",
        "assumptions": f"AC-3 utilization category with {multiplier:.2f}x continuous thermal safety margin."
    }


def calculate_overload_range(
    motor_current_a: float,
    min_margin_pct: float = 0.85,
    max_margin_pct: float = 1.15
) -> Dict[str, Any]:
    """
    Calculate required thermal/electronic overload relay setting window.
    The relay dial range must cover at least [0.85*FLC, 1.15*FLC]
    to permit calibration at nominal 100% FLC.
    """
    if motor_current_a <= 0:
        return {
            "calculation_id": "CALC-002",
            "name": "Overload range requirement",
            "input_current_a": motor_current_a,
            "result_min_a": 0,
            "result_max_a": 0,
            "unit": "A",
            "status": "FAIL",
            "formula_id": "FORM-OVR-01",
            "assumptions": "Invalid motor current."
        }

    req_min = round(motor_current_a * min_margin_pct, 2)
    req_max = round(motor_current_a * max_margin_pct, 2)

    return {
        "calculation_id": "CALC-002",
        "name": "Overload range requirement",
        "input_current_a": motor_current_a,
        "nominal_setting_a": motor_current_a,
        "result_min_a": req_min,
        "result_max_a": req_max,
        "unit": "A",
        "status": "PASS",
        "formula_id": "FORM-OVR-01",
        "assumptions": f"Overload window must allow setting between {min_margin_pct*100:.0f}% and {max_margin_pct*100:.0f}% of FLC for Class 10A tripping curve."
    }


def calculate_protection_requirement(
    motor_current_a: float,
    starter_type: str = "DOL"
) -> Dict[str, Any]:
    """
    Calculate short-circuit and branch circuit protective device rating (MPCB / MCCB).
    Typically 1.25x to 1.6x motor full-load current for Type 2 coordination.
    """
    if motor_current_a <= 0:
        return {
            "calculation_id": "CALC-003",
            "name": "Branch protection requirement",
            "input_current_a": motor_current_a,
            "result_a": 0,
            "unit": "A",
            "status": "FAIL",
            "formula_id": "FORM-PROT-01",
            "assumptions": "Invalid motor current."
        }

    # Standard MPCB magnetic trip withstands 12-14x inrush while continuous trip handles 1.25x
    calculated_trip = round(motor_current_a * 1.25, 2)

    return {
        "calculation_id": "CALC-003",
        "name": "Branch protection requirement",
        "input_current_a": motor_current_a,
        "result_a": calculated_trip,
        "unit": "A",
        "status": "PASS",
        "formula_id": "FORM-PROT-01",
        "assumptions": "Branch circuit protective device sized at 1.25x FLC with Type 2 coordination."
    }


def calculate_panel_space(
    components: List[Dict[str, Any]],
    enclosure_width_mm: float = 400.0,
    enclosure_height_mm: float = 500.0
) -> Dict[str, Any]:
    """
    Calculate total component footprint versus enclosure backplate area.
    Ensures wireways, DIN rail gaps, and thermal clearances do not exceed 70% threshold.
    """
    total_comp_area_sq_mm = 0.0
    for comp in components:
        dims = comp.get("dimensions", {})
        w = dims.get("width_mm", 45)
        h = dims.get("height_mm", 75)
        total_comp_area_sq_mm += (w * h)

    usable_backplate_area = (enclosure_width_mm - 40.0) * (enclosure_height_mm - 40.0)
    utilization_pct = round((total_comp_area_sq_mm / usable_backplate_area) * 100.0, 2) if usable_backplate_area > 0 else 0.0

    status = "PASS" if utilization_pct <= 70.0 else "WARN"

    return {
        "calculation_id": "CALC-004",
        "name": "Panel space utilization",
        "total_component_area_sq_mm": round(total_comp_area_sq_mm, 2),
        "enclosure_usable_area_sq_mm": round(usable_backplate_area, 2),
        "result_pct": utilization_pct,
        "unit": "%",
        "status": status,
        "formula_id": "FORM-SPACE-01",
        "assumptions": "Maximum recommended component density is 70% of backplate area to preserve wiring duct channels and convective heat dissipation."
    }


def calculate_layout_dimensions(
    enclosure_dims: Dict[str, float]
) -> Dict[str, Any]:
    """
    Compute internal DIN rail coordinates and vertical channel clearances.
    """
    width = enclosure_dims.get("width_mm", 400.0)
    height = enclosure_dims.get("height_mm", 500.0)
    depth = enclosure_dims.get("depth_mm", 200.0)

    # Standard two-rail layout: Top rail (Protection + Contactor + Overload), Bottom rail (Control transformer + Terminals)
    rail_1_y = round(height * 0.35, 1)
    rail_2_y = round(height * 0.72, 1)
    rail_width = round(width - 60.0, 1)

    return {
        "calculation_id": "CALC-005",
        "name": "Layout dimensions and rail coordinates",
        "enclosure_width_mm": width,
        "enclosure_height_mm": height,
        "enclosure_depth_mm": depth,
        "din_rail_1_y_mm": rail_1_y,
        "din_rail_2_y_mm": rail_2_y,
        "din_rail_usable_width_mm": rail_width,
        "unit": "mm",
        "status": "PASS",
        "formula_id": "FORM-LAYOUT-01",
        "assumptions": "DIN 46277 / EN 50022 top-hat rails positioned with 100 mm vertical cable trunking gap."
    }
