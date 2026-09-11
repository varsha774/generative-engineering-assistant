"""
Deterministic Rules and Compliance Engine for Low-Voltage Motor-Starter Panels.
SAFETY DIRECTIVE:
All compliance determinations are produced deterministically based on versioned rules.
The AI is NEVER allowed to determine or override compliance.
"""

from typing import List, Dict, Any


class RulesEngine:
    def __init__(self, rules: List[Dict[str, Any]], rule_version: str = "2026.1"):
        self.rules = rules
        self.rule_version = rule_version

    def evaluate(
        self,
        requirements: Dict[str, Any],
        calculations: List[Dict[str, Any]],
        selected_components: List[Dict[str, Any]],
        system_voltage_v: float = 415.0
    ) -> Dict[str, Any]:
        """
        Evaluate all active rules against the supplied deterministic calculations and selected components.
        """
        results = []
        pass_count = 0
        fail_count = 0
        warn_count = 0

        # Build index maps for fast lookup
        calc_map = {c.get("calculation_id"): c for c in calculations}
        comp_by_type = {}
        for c in selected_components:
            comp_by_type.setdefault(c.get("component_type"), []).append(c)

        motor_current_a = requirements.get("motor_current_a", 0.0)
        protection_required = requirements.get("protection_required", True)

        contactor = comp_by_type.get("Contactor", [None])[0]
        overload = comp_by_type.get("Overload Relay", [None])[0]
        protection = comp_by_type.get("Circuit Protection", [None])[0]
        isolator = comp_by_type.get("Main Isolator", [None])[0]
        transformer = comp_by_type.get("Control Transformer", [None])[0]

        for rule in self.rules:
            rule_id = rule.get("rule_id")
            title = rule.get("title")
            version = rule.get("version", self.rule_version)
            source = rule.get("source_reference", "")
            active = rule.get("active", True)

            if not active:
                results.append({
                    "rule_id": rule_id,
                    "title": title,
                    "result": "NOT EVALUATED",
                    "explanation": "Rule is inactive in this ruleset.",
                    "inputs": {},
                    "source_reference": source,
                    "rule_version": version
                })
                continue

            # R001: Contactor current compatibility
            if rule_id == "R001":
                calc_cont = calc_map.get("CALC-001", {})
                req_cont_a = calc_cont.get("result_a", motor_current_a * 1.20)
                cont_rating = contactor.get("rated_current", 0) if contactor else 0

                status = "PASS" if cont_rating >= req_cont_a else "FAIL"
                explanation = (
                    f"Contactor rated at {cont_rating} A satisfies required {req_cont_a} A (>= 1.20x FLC)."
                    if status == "PASS" else
                    f"Contactor rating {cont_rating} A is below calculated minimum {req_cont_a} A."
                )
                results.append({
                    "rule_id": rule_id,
                    "title": title,
                    "result": status,
                    "inputs": {"required_rating_a": req_cont_a, "selected_contactor_a": cont_rating},
                    "explanation": explanation,
                    "source_reference": source,
                    "rule_version": version
                })

            # R002: Overload range compatibility
            elif rule_id == "R002":
                if not overload:
                    status = "FAIL"
                    explanation = "No overload relay selected."
                    results.append({
                        "rule_id": rule_id,
                        "title": title,
                        "result": status,
                        "inputs": {"motor_current_a": motor_current_a},
                        "explanation": explanation,
                        "source_reference": source,
                        "rule_version": version
                    })
                else:
                    ovr_min = overload.get("overload_range_min", 0.0)
                    ovr_max = overload.get("overload_range_max", 0.0)

                    # Check version-specific rule condition
                    if version == "2026.2":
                        # Stricter margin: min <= 0.80 * FLC and max >= 1.25 * FLC
                        req_lower = round(0.80 * motor_current_a, 2)
                        req_upper = round(1.25 * motor_current_a, 2)
                        status = "PASS" if (ovr_min <= req_lower and ovr_max >= req_upper) else "FAIL"
                        explanation = (
                            f"Overload range [{ovr_min}-{ovr_max} A] satisfies enhanced 2026.2 margins (<= {req_lower} A and >= {req_upper} A)."
                            if status == "PASS" else
                            f"Selected overload range [{ovr_min}-{ovr_max} A] does not satisfy Rule 2026.2 requirement: upper boundary must reach at least {req_upper} A (1.25x FLC)."
                        )
                        inputs = {"motor_current_a": motor_current_a, "ovr_range": [ovr_min, ovr_max], "required_range": [req_lower, req_upper]}
                    else:
                        # Version 2026.1: Simple inclusion
                        status = "PASS" if (ovr_min <= motor_current_a <= ovr_max) else "FAIL"
                        explanation = (
                            f"Overload range [{ovr_min}-{ovr_max} A] encompasses motor current of {motor_current_a} A."
                            if status == "PASS" else
                            f"Selected overload relay range [{ovr_min}-{ovr_max} A] does not cover required motor current of {motor_current_a} A."
                        )
                        inputs = {"motor_current_a": motor_current_a, "ovr_range": [ovr_min, ovr_max]}

                    results.append({
                        "rule_id": rule_id,
                        "title": title,
                        "result": status,
                        "inputs": inputs,
                        "explanation": explanation,
                        "source_reference": source,
                        "rule_version": version
                    })

            # R003: Required protection present
            elif rule_id == "R003":
                if not protection_required:
                    status = "PASS"
                    explanation = "Branch protection flagged optional by user specification."
                else:
                    status = "PASS" if protection is not None else "FAIL"
                    explanation = (
                        f"Branch protective device {protection.get('component_id')} ({protection.get('model')}) is present."
                        if status == "PASS" else
                        "Mandatory branch short-circuit protection is missing."
                    )
                results.append({
                    "rule_id": rule_id,
                    "title": title,
                    "result": status,
                    "inputs": {"protection_required": protection_required, "has_protection": protection is not None},
                    "explanation": explanation,
                    "source_reference": source,
                    "rule_version": version
                })

            # R004: Catalog component active
            elif rule_id == "R004":
                inactive_components = [c.get("component_id") for c in selected_components if not c.get("active", True)]
                status = "PASS" if not inactive_components else "FAIL"
                explanation = (
                    "All selected components are active and supported in the approved catalog."
                    if status == "PASS" else
                    f"Selected components are inactive or obsolete in catalog: {', '.join(inactive_components)}."
                )
                results.append({
                    "rule_id": rule_id,
                    "title": title,
                    "result": status,
                    "inputs": {"inactive_components": inactive_components},
                    "explanation": explanation,
                    "source_reference": source,
                    "rule_version": version
                })

            # R005: Voltage rating adequacy
            elif rule_id == "R005":
                underrated = [
                    c.get("component_id") for c in selected_components
                    if c.get("component_type") in ["Contactor", "Circuit Protection", "Main Isolator"]
                    and c.get("rated_voltage", 0) < system_voltage_v
                ]
                status = "PASS" if not underrated else "FAIL"
                explanation = (
                    f"All primary power components have rated insulation voltage >= system nominal {system_voltage_v} V."
                    if status == "PASS" else
                    f"Components underrated for system voltage: {', '.join(underrated)}."
                )
                results.append({
                    "rule_id": rule_id,
                    "title": title,
                    "result": status,
                    "inputs": {"system_voltage_v": system_voltage_v, "underrated": underrated},
                    "explanation": explanation,
                    "source_reference": source,
                    "rule_version": version
                })

            # R006: Main Isolator sizing
            elif rule_id == "R006":
                if not isolator:
                    status = "FAIL"
                    explanation = "Main incoming isolator missing."
                else:
                    req_iso_a = round(1.25 * motor_current_a, 2)
                    iso_rating = isolator.get("rated_current", 0)
                    status = "PASS" if iso_rating >= req_iso_a else "FAIL"
                    explanation = (
                        f"Main isolator rated at {iso_rating} A satisfies minimum 125% requirement ({req_iso_a} A)."
                        if status == "PASS" else
                        f"Main isolator rated at {iso_rating} A is under-sized for 125% motor current ({req_iso_a} A)."
                    )
                results.append({
                    "rule_id": rule_id,
                    "title": title,
                    "result": status,
                    "inputs": {"motor_current_a": motor_current_a, "isolator_rating_a": isolator.get("rated_current", 0) if isolator else 0},
                    "explanation": explanation,
                    "source_reference": source,
                    "rule_version": version
                })

            # R007: Enclosure spatial allowance
            elif rule_id == "R007":
                calc_space = calc_map.get("CALC-004", {})
                util_pct = calc_space.get("result_pct", 50.0)
                status = "PASS" if util_pct <= 70.0 else "WARNING"
                explanation = (
                    f"Backplate area utilization is {util_pct}% (within 70% thermal and wiring threshold)."
                    if status == "PASS" else
                    f"Backplate area utilization is {util_pct}% (exceeds recommended 70% threshold; consider larger enclosure)."
                )
                results.append({
                    "rule_id": rule_id,
                    "title": title,
                    "result": status,
                    "inputs": {"utilization_pct": util_pct, "max_allowed_pct": 70.0},
                    "explanation": explanation,
                    "source_reference": source,
                    "rule_version": version
                })

            # R008: Control circuit voltage compatibility
            elif rule_id == "R008":
                xfmr_sec = transformer.get("coil_voltage", 24) if transformer else 24
                cont_coil = contactor.get("coil_voltage", 24) if contactor else 24
                status = "PASS" if xfmr_sec == cont_coil else "FAIL"
                explanation = (
                    f"Contactor coil ({cont_coil} V) is matched with control transformer output ({xfmr_sec} V)."
                    if status == "PASS" else
                    f"Control voltage mismatch: contactor coil is {cont_coil} V but transformer secondary is {xfmr_sec} V."
                )
                results.append({
                    "rule_id": rule_id,
                    "title": title,
                    "result": status,
                    "inputs": {"contactor_coil_v": cont_coil, "transformer_sec_v": xfmr_sec},
                    "explanation": explanation,
                    "source_reference": source,
                    "rule_version": version
                })

        for r in results:
            if r["result"] == "PASS":
                pass_count += 1
            elif r["result"] == "FAIL":
                fail_count += 1
            elif r["result"] == "WARNING":
                warn_count += 1

        overall_status = "FAIL" if fail_count > 0 else ("WARNING" if warn_count > 0 else "PASS")

        return {
            "overall_status": overall_status,
            "pass_count": pass_count,
            "fail_count": fail_count,
            "warn_count": warn_count,
            "rules_evaluated": len(results),
            "rule_version": self.rule_version,
            "rule_results": results
        }
