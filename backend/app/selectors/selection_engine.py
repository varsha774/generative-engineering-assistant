"""
Catalog-Constrained Component Selection Engine.
STRICT SAFETY DIRECTIVE:
Components are strictly retrieved from the active catalog.
The system will NEVER synthesize, invent, or extrapolate component models or ratings.
"""

from typing import List, Dict, Any, Optional


class CatalogSelectionEngine:
    def __init__(self, catalog: List[Dict[str, Any]]):
        self.catalog = catalog

    def filter_by_type(self, component_type: str, active_only: bool = True) -> List[Dict[str, Any]]:
        return [
            c for c in self.catalog
            if c.get("component_type") == component_type and (not active_only or c.get("active", True))
        ]

    def select_contactor(
        self,
        required_rating_a: float,
        system_voltage_v: float = 415.0,
        coil_voltage_v: float = 24.0
    ) -> Optional[Dict[str, Any]]:
        """
        Find candidate contactors with rated_current >= required_rating_a
        and rated_voltage >= system_voltage_v, ranked by closest optimal rating.
        """
        candidates = [
            c for c in self.filter_by_type("Contactor")
            if c.get("rated_current", 0) >= required_rating_a
            and c.get("rated_voltage", 0) >= system_voltage_v
            and c.get("coil_voltage") == coil_voltage_v
        ]

        if not candidates:
            return None

        # Sort ascending by rated_current to pick closest adequate standard frame
        candidates.sort(key=lambda x: x.get("rated_current", 0))
        return candidates[0]

    def select_overload_relay(
        self,
        motor_current_a: float,
        system_voltage_v: float = 415.0
    ) -> Optional[Dict[str, Any]]:
        """
        Find overload relays whose dial range [min, max] encompasses motor_current_a.
        """
        candidates = [
            c for c in self.filter_by_type("Overload Relay")
            if (c.get("overload_range_min") is not None and c.get("overload_range_max") is not None)
            and (c["overload_range_min"] <= motor_current_a <= c["overload_range_max"])
            and c.get("rated_voltage", 0) >= system_voltage_v
        ]

        if not candidates:
            return None

        # Prefer the one where motor_current_a sits closest to mid-scale of adjustment range
        def mid_scale_delta(c):
            mid = (c["overload_range_min"] + c["overload_range_max"]) / 2.0
            return abs(motor_current_a - mid)

        candidates.sort(key=mid_scale_delta)
        return candidates[0]

    def select_circuit_protection(
        self,
        motor_current_a: float,
        system_voltage_v: float = 415.0
    ) -> Optional[Dict[str, Any]]:
        """
        Find MPCB or branch protective devices with rated_current >= 1.25 * motor_current_a.
        """
        required = motor_current_a * 1.25
        candidates = [
            c for c in self.filter_by_type("Circuit Protection")
            if c.get("rated_current", 0) >= required
            and c.get("rated_voltage", 0) >= system_voltage_v
        ]

        if not candidates:
            return None

        candidates.sort(key=lambda x: x.get("rated_current", 0))
        return candidates[0]

    def select_main_isolator(
        self,
        motor_current_a: float,
        system_voltage_v: float = 415.0
    ) -> Optional[Dict[str, Any]]:
        """
        Find main disconnect isolator with rating >= 1.25 * motor_current_a.
        """
        required = motor_current_a * 1.25
        candidates = [
            c for c in self.filter_by_type("Main Isolator")
            if c.get("rated_current", 0) >= required
            and c.get("rated_voltage", 0) >= system_voltage_v
        ]

        if not candidates:
            return None

        candidates.sort(key=lambda x: x.get("rated_current", 0))
        return candidates[0]

    def select_auxiliary_package(self) -> Dict[str, Any]:
        """
        Select standard control transformer, push buttons, indicators, terminals, and enclosure.
        """
        xfmr = next((c for c in self.filter_by_type("Control Transformer")), None)
        pb_start = next((c for c in self.filter_by_type("Push Button") if "START" in c["component_id"]), None)
        pb_stop = next((c for c in self.filter_by_type("Push Button") if "STOP" in c["component_id"] and "ESTOP" not in c["component_id"]), None)
        pb_estop = next((c for c in self.filter_by_type("Push Button") if "ESTOP" in c["component_id"]), None)
        ind_run = next((c for c in self.filter_by_type("Indicator") if "RUN" in c["component_id"]), None)
        ind_trip = next((c for c in self.filter_by_type("Indicator") if "TRIP" in c["component_id"]), None)
        enclosure = next((c for c in self.filter_by_type("Enclosure")), None)
        tb_pwr = next((c for c in self.filter_by_type("Terminal Block") if "PWR" in c["component_id"]), None)
        tb_ctrl = next((c for c in self.filter_by_type("Terminal Block") if "CTRL" in c["component_id"]), None)

        return {
            "control_transformer": xfmr,
            "push_button_start": pb_start,
            "push_button_stop": pb_stop,
            "push_button_estop": pb_estop,
            "indicator_run": ind_run,
            "indicator_trip": ind_trip,
            "enclosure": enclosure,
            "terminal_blocks_power": tb_pwr,
            "terminal_blocks_control": tb_ctrl
        }
