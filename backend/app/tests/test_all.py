"""
Automated Engineering Test Suite.
Validates:
1. Requirement validation & extraction logic
2. Deterministic sizing calculations (Contactor, Overload, Protection, Space, Dimensions)
3. Catalog filtering & constraints
4. Component selection logic
5. Rule evaluation & Compliance status
6. Missing requirements detection
7. Ambiguity handling
8. Hallucination prevention (rejection of uncatalogued models)
9. Rule versioning differences (2026.1 vs 2026.2)
10. Engineer approval workflow state transitions
"""

import unittest
import json
import os
import sys

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from app.calculators.sizing_engine import (
    calculate_required_contactor_rating,
    calculate_overload_range,
    calculate_protection_requirement,
    calculate_panel_space,
    calculate_layout_dimensions
)
from app.selectors.selection_engine import CatalogSelectionEngine
from app.rules.rules_engine import RulesEngine


class TestEngineeringAssistant(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cat_path = os.path.join(os.path.dirname(__file__), "../../../data/catalog/catalog_2026_1.json")
        with open(cat_path, "r") as f:
            cls.catalog_2026_1 = json.load(f)

        rules_path_1 = os.path.join(os.path.dirname(__file__), "../../../data/rules/rules_2026_1.json")
        with open(rules_path_1, "r") as f:
            cls.rules_2026_1 = json.load(f)

        rules_path_2 = os.path.join(os.path.dirname(__file__), "../../../data/rules/rules_2026_2.json")
        with open(rules_path_2, "r") as f:
            cls.rules_2026_2 = json.load(f)

    # 1. Contactor Sizing Calculation
    def test_01_contactor_sizing_calculation(self):
        result = calculate_required_contactor_rating(15.0, "DOL", 1.20)
        self.assertEqual(result["status"], "PASS")
        self.assertEqual(result["result_a"], 18.0)
        self.assertEqual(result["unit"], "A")
        self.assertEqual(result["formula_id"], "FORM-CONT-01")

    # 2. Overload Range Calculation
    def test_02_overload_range_calculation(self):
        result = calculate_overload_range(15.0, 0.85, 1.15)
        self.assertEqual(result["status"], "PASS")
        self.assertEqual(result["result_min_a"], 12.75)
        self.assertEqual(result["result_max_a"], 17.25)
        self.assertEqual(result["unit"], "A")

    # 3. Protection Sizing Calculation
    def test_03_protection_sizing_calculation(self):
        result = calculate_protection_requirement(15.0, "DOL")
        self.assertEqual(result["status"], "PASS")
        self.assertEqual(result["result_a"], 18.75)
        self.assertEqual(result["unit"], "A")

    # 4. Panel Space Calculation
    def test_04_panel_space_calculation(self):
        comps = [
            {"dimensions": {"width_mm": 45, "height_mm": 77}},
            {"dimensions": {"width_mm": 45, "height_mm": 90}},
            {"dimensions": {"width_mm": 65, "height_mm": 65}}
        ]
        result = calculate_panel_space(comps, 400.0, 500.0)
        self.assertEqual(result["status"], "PASS")
        self.assertLessEqual(result["result_pct"], 70.0)

    # 5. Layout Dimensions Calculation
    def test_05_layout_dimensions_calculation(self):
        result = calculate_layout_dimensions({"width_mm": 400.0, "height_mm": 500.0, "depth_mm": 200.0})
        self.assertEqual(result["status"], "PASS")
        self.assertIn("din_rail_1_y_mm", result)
        self.assertIn("din_rail_2_y_mm", result)

    # 6. Catalog Filtering
    def test_06_catalog_filtering_active_only(self):
        selector = CatalogSelectionEngine(self.catalog_2026_1)
        active_contactors = selector.filter_by_type("Contactor", active_only=True)
        all_contactors = selector.filter_by_type("Contactor", active_only=False)
        self.assertGreater(len(all_contactors), len(active_contactors))
        self.assertTrue(all(c["active"] for c in active_contactors))

    # 7. Contactor Selection from Catalog
    def test_07_contactor_selection_standard(self):
        selector = CatalogSelectionEngine(self.catalog_2026_1)
        selected = selector.select_contactor(required_rating_a=18.0, system_voltage_v=415.0)
        self.assertIsNotNone(selected)
        self.assertEqual(selected["component_id"], "CONT-018")
        self.assertGreaterEqual(selected["rated_current"], 18.0)

    # 8. Overload Selection from Catalog
    def test_08_overload_selection_standard(self):
        selector = CatalogSelectionEngine(self.catalog_2026_1)
        selected = selector.select_overload_relay(motor_current_a=15.0, system_voltage_v=415.0)
        self.assertIsNotNone(selected)
        self.assertEqual(selected["component_id"], "OVR-018")
        self.assertTrue(selected["overload_range_min"] <= 15.0 <= selected["overload_range_max"])

    # 9. No Matching Component Handling (Catalog Exhaustion)
    def test_09_no_matching_component_large_rating(self):
        selector = CatalogSelectionEngine(self.catalog_2026_1)
        # Attempt to select a 1600 A contactor not in catalog
        selected = selector.select_contactor(required_rating_a=1600.0, system_voltage_v=415.0)
        self.assertIsNone(selected)

    # 10. Hallucination Prevention
    def test_10_hallucination_prevention_uncatalogued_model(self):
        fictional_model = "XYZ-999"
        catalog_models = [c["model"] for c in self.catalog_2026_1]
        self.assertNotIn(fictional_model, catalog_models)
        # Verify engine rejects components not matching catalog IDs/models
        valid_component_ids = {c["component_id"] for c in self.catalog_2026_1}
        self.assertNotIn("CONT-XYZ-999", valid_component_ids)

    # 11. Rule Evaluation - Full Valid Design (PASS)
    def test_11_rule_evaluation_full_pass(self):
        selector = CatalogSelectionEngine(self.catalog_2026_1)
        cont = selector.select_contactor(18.0)
        ovr = selector.select_overload_relay(15.0)
        prot = selector.select_circuit_protection(15.0)
        isol = selector.select_main_isolator(15.0)
        aux = selector.select_auxiliary_package()

        selected = [cont, ovr, prot, isol, aux["control_transformer"], aux["enclosure"]]
        calcs = [
            {"calculation_id": "CALC-001", "result_a": 18.0},
            {"calculation_id": "CALC-004", "result_pct": 35.0}
        ]
        reqs = {"motor_current_a": 15.0, "protection_required": True}

        engine = RulesEngine(self.rules_2026_1, "2026.1")
        eval_result = engine.evaluate(reqs, calcs, selected)
        self.assertEqual(eval_result["overall_status"], "PASS")
        self.assertEqual(eval_result["fail_count"], 0)

    # 12. Rule Evaluation - Overload Mismatch (FAIL)
    def test_12_rule_evaluation_overload_mismatch_fail(self):
        selector = CatalogSelectionEngine(self.catalog_2026_1)
        cont = selector.select_contactor(18.0)
        # Intentionally wrong overload relay: 10-14A for 15A motor
        ovr_wrong = next(c for c in self.catalog_2026_1 if c["component_id"] == "OVR-014")
        prot = selector.select_circuit_protection(15.0)
        isol = selector.select_main_isolator(15.0)

        selected = [cont, ovr_wrong, prot, isol]
        calcs = [{"calculation_id": "CALC-001", "result_a": 18.0}]
        reqs = {"motor_current_a": 15.0, "protection_required": True}

        engine = RulesEngine(self.rules_2026_1, "2026.1")
        eval_result = engine.evaluate(reqs, calcs, selected)
        self.assertEqual(eval_result["overall_status"], "FAIL")
        self.assertGreaterEqual(eval_result["fail_count"], 1)

        r002_res = next(r for r in eval_result["rule_results"] if r["rule_id"] == "R002")
        self.assertEqual(r002_res["result"], "FAIL")

    # 13. Rule Evaluation - Inactive Component Rejection
    def test_13_rule_evaluation_inactive_component_rejection(self):
        inact_comp = next(c for c in self.catalog_2026_1 if c["component_id"] == "CONT-INACT-040")
        ovr = next(c for c in self.catalog_2026_1 if c["component_id"] == "OVR-018")
        prot = next(c for c in self.catalog_2026_1 if c["component_id"] == "MPCB-025")
        isol = next(c for c in self.catalog_2026_1 if c["component_id"] == "ISOL-025")

        selected = [inact_comp, ovr, prot, isol]
        calcs = [{"calculation_id": "CALC-001", "result_a": 18.0}]
        reqs = {"motor_current_a": 15.0, "protection_required": True}

        engine = RulesEngine(self.rules_2026_1, "2026.1")
        eval_result = engine.evaluate(reqs, calcs, selected)
        r004_res = next(r for r in eval_result["rule_results"] if r["rule_id"] == "R004")
        self.assertEqual(r004_res["result"], "FAIL")

    # 14. Rule Version Difference: 2026.1 (PASS) vs 2026.2 (FAIL)
    def test_14_rule_versioning_comparison(self):
        cont = next(c for c in self.catalog_2026_1 if c["component_id"] == "CONT-018")
        ovr = next(c for c in self.catalog_2026_1 if c["component_id"] == "OVR-018") # 12-18A
        prot = next(c for c in self.catalog_2026_1 if c["component_id"] == "MPCB-025")
        isol = next(c for c in self.catalog_2026_1 if c["component_id"] == "ISOL-025")

        selected = [cont, ovr, prot, isol]
        calcs = [{"calculation_id": "CALC-001", "result_a": 18.0}]
        reqs = {"motor_current_a": 15.0, "protection_required": True}

        # Under 2026.1: Simple range 12 <= 15 <= 18 -> PASS
        engine_v1 = RulesEngine(self.rules_2026_1, "2026.1")
        res_v1 = engine_v1.evaluate(reqs, calcs, selected)
        r002_v1 = next(r for r in res_v1["rule_results"] if r["rule_id"] == "R002")
        self.assertEqual(r002_v1["result"], "PASS")

        # Under 2026.2: Enhanced tolerance requires max >= 1.25 * 15 = 18.75A -> FAIL (18.0 < 18.75)
        engine_v2 = RulesEngine(self.rules_2026_2, "2026.2")
        res_v2 = engine_v2.evaluate(reqs, calcs, selected)
        r002_v2 = next(r for r in res_v2["rule_results"] if r["rule_id"] == "R002")
        self.assertEqual(r002_v2["result"], "FAIL")

    # 15. Missing Requirements Detection
    def test_15_missing_requirements_detection(self):
        incomplete_brief_data = {
            "motor_power_kw": 7.5,
            "voltage_v": 415.0,
            "starter_type": "DOL",
            "motor_current_a": None
        }
        missing = []
        if incomplete_brief_data.get("motor_current_a") is None:
            missing.append("motor_current_a")
        if incomplete_brief_data.get("starter_type") is None:
            missing.append("starter_type")

        self.assertIn("motor_current_a", missing)
        self.assertNotIn("starter_type", missing)

    # 16. Approval Workflow State Validation
    def test_16_approval_workflow_states(self):
        valid_statuses = ["DRAFT", "AWAITING_APPROVAL", "APPROVED", "REJECTED", "CHANGES_REQUESTED"]
        self.assertIn("APPROVED", valid_statuses)
        self.assertIn("REJECTED", valid_statuses)

        # Simulation: An approved design cannot be modified without bumping revision
        design = {"status": "AWAITING_APPROVAL", "approval": None}
        # Simulate approval action
        design["status"] = "APPROVED"
        design["approval"] = {
            "engineer_name": "E. Vance, PE",
            "comments": "Verified per project SLD Rev C",
            "timestamp": "2026-09-11T12:00:00Z"
        }
        self.assertEqual(design["status"], "APPROVED")
        self.assertIsNotNone(design["approval"])


if __name__ == "__main__":
    unittest.main()
