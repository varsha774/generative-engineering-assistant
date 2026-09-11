"""
FastAPI Application Entry Point for Generative Engineering Assistant.
Provides RESTful APIs for Motor-Starter Panel Design.
"""

from typing import Dict, Any, List, Optional
import json
import os
import uuid
import datetime

# Import local engines
from app.calculators.sizing_engine import (
    calculate_required_contactor_rating,
    calculate_overload_range,
    calculate_protection_requirement,
    calculate_panel_space,
    calculate_layout_dimensions
)
from app.selectors.selection_engine import CatalogSelectionEngine
from app.rules.rules_engine import RulesEngine


def load_catalog(version: str = "2026.1") -> List[Dict[str, Any]]:
    path = os.path.join(os.path.dirname(__file__), f"../../data/catalog/catalog_{version.replace('.', '_')}.json")
    if not os.path.exists(path):
        path = os.path.join(os.path.dirname(__file__), "../../data/catalog/catalog_2026_1.json")
    with open(path, "r") as f:
        return json.load(f)


def load_rules(version: str = "2026.1") -> List[Dict[str, Any]]:
    path = os.path.join(os.path.dirname(__file__), f"../../data/rules/rules_{version.replace('.', '_')}.json")
    if not os.path.exists(path):
        path = os.path.join(os.path.dirname(__file__), "../../data/rules/rules_2026_1.json")
    with open(path, "r") as f:
        return json.load(f)


def load_test_cases() -> List[Dict[str, Any]]:
    path = os.path.join(os.path.dirname(__file__), "../../data/test_cases/test_cases.json")
    with open(path, "r") as f:
        return json.load(f)


print("FastAPI / Python Engine backend modules loaded successfully.")
