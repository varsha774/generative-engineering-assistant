"""
SQLite Database Initialization and Schema Setup.
Creates all 12 required tables and seeds versioned catalog, rules, and initial demo design.
"""

import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "../../../data/panel_design.db")


def init_database():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. catalog_versions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS catalog_versions (
        version_id TEXT PRIMARY KEY,
        release_date TEXT,
        description TEXT,
        is_active INTEGER DEFAULT 1
    );
    """)

    # 2. components
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS components (
        component_id TEXT PRIMARY KEY,
        component_type TEXT,
        manufacturer TEXT,
        model TEXT,
        rated_voltage REAL,
        rated_current REAL,
        coil_voltage REAL,
        overload_range_min REAL,
        overload_range_max REAL,
        utilization_category TEXT,
        dimensions_json TEXT,
        catalog_version TEXT,
        active INTEGER DEFAULT 1,
        notes TEXT,
        FOREIGN KEY (catalog_version) REFERENCES catalog_versions (version_id)
    );
    """)

    # 3. rule_versions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS rule_versions (
        version_id TEXT PRIMARY KEY,
        release_date TEXT,
        standard_reference TEXT,
        is_active INTEGER DEFAULT 1
    );
    """)

    # 4. rules
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS rules (
        rule_id TEXT,
        version TEXT,
        title TEXT,
        description TEXT,
        category TEXT,
        severity TEXT,
        condition TEXT,
        source_reference TEXT,
        active INTEGER DEFAULT 1,
        PRIMARY KEY (rule_id, version),
        FOREIGN KEY (version) REFERENCES rule_versions (version_id)
    );
    """)

    # 5. designs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS designs (
        design_id TEXT PRIMARY KEY,
        title TEXT,
        created_at TEXT,
        updated_at TEXT,
        status TEXT,
        catalog_version TEXT,
        rule_version TEXT,
        raw_brief TEXT,
        ai_explanation_json TEXT,
        FOREIGN KEY (catalog_version) REFERENCES catalog_versions (version_id),
        FOREIGN KEY (rule_version) REFERENCES rule_versions (version_id)
    );
    """)

    # 6. requirements
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS requirements (
        requirement_id TEXT PRIMARY KEY,
        design_id TEXT,
        motor_power_kw REAL,
        voltage_v REAL,
        phase INTEGER,
        frequency_hz REAL,
        motor_current_a REAL,
        starter_type TEXT,
        protection_required INTEGER,
        overload_protection_required INTEGER,
        missing_requirements_json TEXT,
        ambiguities_json TEXT,
        confidence REAL,
        FOREIGN KEY (design_id) REFERENCES designs (design_id)
    );
    """)

    # 7. calculations
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS calculations (
        calculation_id TEXT,
        design_id TEXT,
        name TEXT,
        formula_id TEXT,
        input_values_json TEXT,
        result_value REAL,
        result_unit TEXT,
        status TEXT,
        assumptions TEXT,
        PRIMARY KEY (calculation_id, design_id),
        FOREIGN KEY (design_id) REFERENCES designs (design_id)
    );
    """)

    # 8. compliance_results
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS compliance_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        design_id TEXT,
        rule_id TEXT,
        rule_version TEXT,
        result TEXT,
        explanation TEXT,
        inputs_json TEXT,
        source_reference TEXT,
        FOREIGN KEY (design_id) REFERENCES designs (design_id)
    );
    """)

    # 9. layouts
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS layouts (
        layout_id TEXT PRIMARY KEY,
        design_id TEXT,
        enclosure_id TEXT,
        components_positions_json TEXT,
        svg_content TEXT,
        disclaimer TEXT,
        FOREIGN KEY (design_id) REFERENCES designs (design_id)
    );
    """)

    # 10. approvals
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS approvals (
        approval_id TEXT PRIMARY KEY,
        design_id TEXT,
        engineer_name TEXT,
        comments TEXT,
        timestamp TEXT,
        approval_status TEXT,
        digital_signature_hash TEXT,
        FOREIGN KEY (design_id) REFERENCES designs (design_id)
    );
    """)

    # 11. test_cases
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS test_cases (
        case_id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        brief TEXT,
        expected_result TEXT,
        expected_stage TEXT,
        notes TEXT
    );
    """)

    # 12. traceability_events
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS traceability_events (
        event_id TEXT PRIMARY KEY,
        design_id TEXT,
        stage TEXT,
        source_node TEXT,
        target_node TEXT,
        rationale TEXT,
        timestamp TEXT,
        FOREIGN KEY (design_id) REFERENCES designs (design_id)
    );
    """)

    # Seed catalog versions
    cursor.execute("INSERT OR REPLACE INTO catalog_versions VALUES ('2026.1', '2026-01-15', 'Initial production standard component catalog', 1)")
    cursor.execute("INSERT OR REPLACE INTO catalog_versions VALUES ('2026.2', '2026-06-01', 'Updated catalog with heavy-duty contactors and revisions', 1)")

    # Seed rule versions
    cursor.execute("INSERT OR REPLACE INTO rule_versions VALUES ('2026.1', '2026-01-15', 'DEMO-IEC-UL-SUBSET-2026.1', 1)")
    cursor.execute("INSERT OR REPLACE INTO rule_versions VALUES ('2026.2', '2026-06-01', 'DEMO-IEC-UL-SUBSET-2026.2 Enhanced Tolerance', 1)")

    # Load and seed JSON catalog
    cat_path = os.path.join(os.path.dirname(__file__), "../../../data/catalog/catalog_2026_1.json")
    if os.path.exists(cat_path):
        with open(cat_path, "r") as f:
            cat_data = json.load(f)
            for c in cat_data:
                cursor.execute("""
                INSERT OR REPLACE INTO components VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    c["component_id"],
                    c["component_type"],
                    c["manufacturer"],
                    c["model"],
                    c["rated_voltage"],
                    c["rated_current"],
                    c["coil_voltage"],
                    c["overload_range_min"],
                    c["overload_range_max"],
                    c["utilization_category"],
                    json.dumps(c["dimensions"]),
                    c["catalog_version"],
                    1 if c.get("active", True) else 0,
                    c.get("notes", "")
                ))

    # Load and seed Rules
    rules_path = os.path.join(os.path.dirname(__file__), "../../../data/rules/rules_2026_1.json")
    if os.path.exists(rules_path):
        with open(rules_path, "r") as f:
            rules_data = json.load(f)
            for r in rules_data:
                cursor.execute("""
                INSERT OR REPLACE INTO rules VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    r["rule_id"],
                    r["version"],
                    r["title"],
                    r["description"],
                    r["category"],
                    r["severity"],
                    r["condition"],
                    r["source_reference"],
                    1 if r.get("active", True) else 0
                ))

    conn.commit()
    conn.close()
    print("Database initialized successfully with all 12 tables and seed data.")


if __name__ == "__main__":
    init_database()
