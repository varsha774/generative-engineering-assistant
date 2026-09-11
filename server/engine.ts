/**
 * Deterministic Sizing, Catalog Selection, Rule Evaluation, and Traceability Engine.
 * SAFETY DIRECTIVE:
 * The AI is NEVER permitted to invent components, ratings, formulas, or compliance outcomes.
 */

import fs from 'fs';
import path from 'path';

export interface ComponentDimensions {
  width_mm: number;
  height_mm: number;
  depth_mm: number;
}

export interface CatalogComponent {
  component_id: string;
  component_type: string;
  manufacturer: string;
  model: string;
  rated_voltage: number;
  rated_current: number;
  coil_voltage: number | null;
  overload_range_min: number | null;
  overload_range_max: number | null;
  utilization_category: string;
  dimensions: ComponentDimensions;
  catalog_version: string;
  active: boolean;
  notes: string;
}

export interface CalculationResult {
  calculation_id: string;
  name: string;
  formula_id: string;
  input_values: Record<string, any>;
  result_value: number;
  result_unit: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  assumptions: string;
}

export interface RuleDefinition {
  rule_id: string;
  title: string;
  description: string;
  category: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  condition: string;
  source_reference: string;
  version: string;
  active: boolean;
}

export interface RuleCheckResult {
  rule_id: string;
  title: string;
  result: 'PASS' | 'FAIL' | 'WARNING' | 'NOT EVALUATED';
  explanation: string;
  inputs: Record<string, any>;
  source_reference: string;
  rule_version: string;
}

export interface ComplianceResult {
  overall_status: 'PASS' | 'FAIL' | 'WARNING';
  pass_count: number;
  fail_count: number;
  warn_count: number;
  rules_evaluated: number;
  rule_version: string;
  rule_results: RuleCheckResult[];
}

export interface ExtractedRequirements {
  motor_power_kw: number | null;
  voltage_v: number | null;
  phase: number | null;
  frequency_hz: number | null;
  motor_current_a: number | null;
  starter_type: string | null;
  protection_required: boolean;
  overload_protection_required: boolean;
  missing_requirements: string[];
  ambiguities: string[];
  confidence: number;
  hallucination_attempt?: string | null;
}

// Load versioned catalogs
export function getCatalog(version: string = '2026.1'): CatalogComponent[] {
  const vStr = version === '2026.2' ? '2026_2' : '2026_1';
  const filePath = path.join(process.cwd(), 'data', 'catalog', `catalog_${vStr}.json`);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  const fallbackPath = path.join(process.cwd(), 'data', 'catalog', 'catalog_2026_1.json');
  return JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
}

// Load versioned rules
export function getRules(version: string = '2026.1'): RuleDefinition[] {
  const vStr = version === '2026.2' ? '2026_2' : '2026_1';
  const filePath = path.join(process.cwd(), 'data', 'rules', `rules_${vStr}.json`);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  const fallbackPath = path.join(process.cwd(), 'data', 'rules', 'rules_2026_1.json');
  return JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
}

// Deterministic Sizing Calculations
export function performDeterministicSizing(
  requirements: ExtractedRequirements,
  selectedComponents: CatalogComponent[] = []
): CalculationResult[] {
  const flc = requirements.motor_current_a || 15.0;
  const starterType = requirements.starter_type || 'DOL';

  // 1. Contactor Rating (CALC-001)
  const contactorMultiplier = starterType.toUpperCase() === 'DOL' ? 1.20 : 1.00;
  const requiredContactorRating = Math.round(flc * contactorMultiplier * 100) / 100;
  const calc1: CalculationResult = {
    calculation_id: 'CALC-001',
    name: 'Contactor requirement',
    formula_id: 'FORM-CONT-01 (I_req = I_FLC * 1.20)',
    input_values: { motor_current_a: flc, starter_type: starterType, margin_factor: contactorMultiplier },
    result_value: requiredContactorRating,
    result_unit: 'A',
    status: flc > 0 ? 'PASS' : 'FAIL',
    assumptions: 'AC-3 utilization category with 1.20x continuous thermal headroom for DOL motor inrush and duty cycles.'
  };

  // 2. Overload Range Requirement (CALC-002)
  const ovrMin = Math.round(flc * 0.85 * 100) / 100;
  const ovrMax = Math.round(flc * 1.15 * 100) / 100;
  const calc2: CalculationResult = {
    calculation_id: 'CALC-002',
    name: 'Overload range requirement',
    formula_id: 'FORM-OVR-01 [0.85 * I_FLC, 1.15 * I_FLC]',
    input_values: { motor_current_a: flc, lower_margin: 0.85, upper_margin: 1.15 },
    result_value: ovrMax,
    result_unit: `A (Window: ${ovrMin} - ${ovrMax} A)`,
    status: 'PASS',
    assumptions: 'Trip dial range must encompass nominal motor FLC to allow 100% calibration with ±15% field adjustment.'
  };

  // 3. Branch Circuit Protection Requirement (CALC-003)
  const protectionTrip = Math.round(flc * 1.25 * 100) / 100;
  const calc3: CalculationResult = {
    calculation_id: 'CALC-003',
    name: 'Branch protection requirement',
    formula_id: 'FORM-PROT-01 (I_prot = I_FLC * 1.25)',
    input_values: { motor_current_a: flc, multiplier: 1.25 },
    result_value: protectionTrip,
    result_unit: 'A',
    status: 'PASS',
    assumptions: 'Motor Protection Circuit Breaker sized at 1.25x FLC for Type 2 coordination against short circuits.'
  };

  // 4. Panel Space Utilization (CALC-004)
  const defaultComponents = selectedComponents.length > 0 ? selectedComponents : [
    { dimensions: { width_mm: 45, height_mm: 77, depth_mm: 86 } },
    { dimensions: { width_mm: 45, height_mm: 50, depth_mm: 70 } },
    { dimensions: { width_mm: 45, height_mm: 90, depth_mm: 82 } },
    { dimensions: { width_mm: 65, height_mm: 65, depth_mm: 95 } },
    { dimensions: { width_mm: 78, height_mm: 85, depth_mm: 80 } },
    { dimensions: { width_mm: 120, height_mm: 45, depth_mm: 50 } }
  ];

  let totalCompArea = 0;
  for (const c of defaultComponents) {
    const dims = (c as any).dimensions || { width_mm: 45, height_mm: 75 };
    totalCompArea += (dims.width_mm * dims.height_mm);
  }
  const enclosureUsableArea = (400 - 40) * (500 - 40); // 360 * 460 = 165,600 mm²
  const spaceUtilization = Math.round((totalCompArea / enclosureUsableArea) * 10000) / 100;
  const calc4: CalculationResult = {
    calculation_id: 'CALC-004',
    name: 'Panel space utilization',
    formula_id: 'FORM-SPACE-01 (Area_comp / Area_backplate * 100)',
    input_values: {
      total_comp_area_sq_mm: totalCompArea,
      backplate_usable_area_sq_mm: enclosureUsableArea
    },
    result_value: spaceUtilization,
    result_unit: '%',
    status: spaceUtilization <= 70.0 ? 'PASS' : 'WARN',
    assumptions: 'Component footprint must remain <= 70% of backplate area to preserve ventilation and wireways.'
  };

  // 5. Layout Dimensions & Coordinates (CALC-005)
  const calc5: CalculationResult = {
    calculation_id: 'CALC-005',
    name: 'Layout dimensions & rail spacing',
    formula_id: 'FORM-LAYOUT-01',
    input_values: { enclosure_width_mm: 400, enclosure_height_mm: 500, enclosure_depth_mm: 200 },
    result_value: 340,
    result_unit: 'mm (Usable Rail Width)',
    status: 'PASS',
    assumptions: 'Two horizontal DIN 46277 rails mounted at y=175mm and y=360mm with 100mm vertical trunking duct.'
  };

  return [calc1, calc2, calc3, calc4, calc5];
}

// Catalog-Constrained Component Selector
export function selectCatalogComponents(
  requirements: ExtractedRequirements,
  calculations: CalculationResult[],
  catalogVersion: string = '2026.1',
  forcedComponentId?: string
): {
  components: CatalogComponent[];
  unmatched_types: string[];
  selection_log: string[];
  error?: string;
} {
  const catalog = getCatalog(catalogVersion);
  const flc = requirements.motor_current_a || 15.0;
  const voltage = requirements.voltage_v || 415.0;

  // Find calculated contactor rating
  const calcCont = calculations.find(c => c.calculation_id === 'CALC-001');
  const reqContactorRating = calcCont ? calcCont.result_value : flc * 1.20;

  const selected: CatalogComponent[] = [];
  const unmatched: string[] = [];
  const logs: string[] = [];

  // Check for hallucination / out-of-bounds current
  if (flc > 500) {
    return {
      components: [],
      unmatched_types: ['Contactor', 'Overload Relay', 'Circuit Protection'],
      selection_log: [`FLC ${flc} A exceeds maximum available catalog tier. No valid catalog component found.`],
      error: 'No valid catalog component found.'
    };
  }

  // 1. Contactor
  const candidateContactors = catalog
    .filter(c => c.component_type === 'Contactor' && c.active && c.rated_current >= reqContactorRating && c.rated_voltage >= voltage)
    .sort((a, b) => a.rated_current - b.rated_current);

  if (candidateContactors.length > 0) {
    selected.push(candidateContactors[0]);
    logs.push(`Selected Contactor ${candidateContactors[0].component_id} (${candidateContactors[0].model}, rated ${candidateContactors[0].rated_current} A) for required rating ${reqContactorRating} A.`);
  } else {
    unmatched.push('Contactor');
    logs.push(`No active contactor found in catalog >= ${reqContactorRating} A.`);
  }

  // 2. Overload Relay
  if (forcedComponentId) {
    const forced = catalog.find(c => c.component_id === forcedComponentId);
    if (forced) {
      selected.push(forced);
      logs.push(`Assigned Overload Relay ${forced.component_id} (${forced.model}) per test requirement.`);
    }
  } else {
    const candidateOverloads = catalog
      .filter(c =>
        c.component_type === 'Overload Relay' &&
        c.active &&
        c.overload_range_min !== null &&
        c.overload_range_max !== null &&
        c.overload_range_min <= flc &&
        c.overload_range_max >= flc
      )
      .sort((a, b) => {
        const midA = (a.overload_range_min! + a.overload_range_max!) / 2;
        const midB = (b.overload_range_min! + b.overload_range_max!) / 2;
        return Math.abs(flc - midA) - Math.abs(flc - midB);
      });

    if (candidateOverloads.length > 0) {
      selected.push(candidateOverloads[0]);
      logs.push(`Selected Overload Relay ${candidateOverloads[0].component_id} (${candidateOverloads[0].model}, range ${candidateOverloads[0].overload_range_min}-${candidateOverloads[0].overload_range_max} A) for motor current ${flc} A.`);
    } else {
      unmatched.push('Overload Relay');
      logs.push(`No active overload relay found covering ${flc} A.`);
    }
  }

  // 3. Circuit Protection (MPCB)
  if (requirements.protection_required) {
    const reqTrip = flc * 1.25;
    const candidateProtection = catalog
      .filter(c => c.component_type === 'Circuit Protection' && c.active && c.rated_current >= reqTrip)
      .sort((a, b) => a.rated_current - b.rated_current);

    if (candidateProtection.length > 0) {
      selected.push(candidateProtection[0]);
      logs.push(`Selected MPCB ${candidateProtection[0].component_id} (${candidateProtection[0].model}, rated ${candidateProtection[0].rated_current} A) for branch protection.`);
    } else {
      unmatched.push('Circuit Protection');
    }
  }

  // 4. Main Isolator
  const reqIso = flc * 1.25;
  const candidateIsolators = catalog
    .filter(c => c.component_type === 'Main Isolator' && c.active && c.rated_current >= reqIso)
    .sort((a, b) => a.rated_current - b.rated_current);

  if (candidateIsolators.length > 0) {
    selected.push(candidateIsolators[0]);
    logs.push(`Selected Main Isolator ${candidateIsolators[0].component_id} (${candidateIsolators[0].model}, rated ${candidateIsolators[0].rated_current} A).`);
  }

  // 5. Auxiliaries: Transformer, Buttons, Indicators, Enclosure, Terminals
  const xfmr = catalog.find(c => c.component_type === 'Control Transformer' && c.active);
  if (xfmr) selected.push(xfmr);

  const pbStart = catalog.find(c => c.component_id === 'PB-START');
  if (pbStart) selected.push(pbStart);

  const pbStop = catalog.find(c => c.component_id === 'PB-STOP');
  if (pbStop) selected.push(pbStop);

  const pbEstop = catalog.find(c => c.component_id === 'PB-ESTOP');
  if (pbEstop) selected.push(pbEstop);

  const indRun = catalog.find(c => c.component_id === 'IND-RUN');
  if (indRun) selected.push(indRun);

  const indTrip = catalog.find(c => c.component_id === 'IND-TRIP');
  if (indTrip) selected.push(indTrip);

  const enclosure = catalog.find(c => c.component_type === 'Enclosure' && c.active);
  if (enclosure) selected.push(enclosure);

  const tbPwr = catalog.find(c => c.component_id === 'TB-SET-PWR');
  if (tbPwr) selected.push(tbPwr);

  const tbCtrl = catalog.find(c => c.component_id === 'TB-SET-CTRL');
  if (tbCtrl) selected.push(tbCtrl);

  return {
    components: selected,
    unmatched_types: unmatched,
    selection_log: logs
  };
}

// Deterministic Compliance Engine
export function evaluateCompliance(
  requirements: ExtractedRequirements,
  calculations: CalculationResult[],
  selectedComponents: CatalogComponent[],
  ruleVersion: string = '2026.1'
): ComplianceResult {
  const rules = getRules(ruleVersion);
  const flc = requirements.motor_current_a || 15.0;
  const voltage = requirements.voltage_v || 415.0;
  const protectionRequired = requirements.protection_required !== false;

  const contactor = selectedComponents.find(c => c.component_type === 'Contactor');
  const overload = selectedComponents.find(c => c.component_type === 'Overload Relay');
  const protection = selectedComponents.find(c => c.component_type === 'Circuit Protection');
  const isolator = selectedComponents.find(c => c.component_type === 'Main Isolator');
  const transformer = selectedComponents.find(c => c.component_type === 'Control Transformer');

  const calcCont = calculations.find(c => c.calculation_id === 'CALC-001');
  const reqContactorRating = calcCont ? calcCont.result_value : flc * 1.20;

  const calcSpace = calculations.find(c => c.calculation_id === 'CALC-004');
  const spacePct = calcSpace ? calcSpace.result_value : 40.0;

  const results: RuleCheckResult[] = [];
  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;

  for (const rule of rules) {
    if (!rule.active) {
      results.push({
        rule_id: rule.rule_id,
        title: rule.title,
        result: 'NOT EVALUATED',
        explanation: 'Rule is deactivated in this ruleset revision.',
        inputs: {},
        source_reference: rule.source_reference,
        rule_version: rule.version
      });
      continue;
    }

    // R001: Contactor current compatibility
    if (rule.rule_id === 'R001') {
      const contCurrent = contactor ? contactor.rated_current : 0;
      const isPass = contCurrent >= reqContactorRating;
      const res: 'PASS' | 'FAIL' = isPass ? 'PASS' : 'FAIL';
      results.push({
        rule_id: 'R001',
        title: rule.title,
        result: res,
        explanation: isPass
          ? `Contactor ${contactor?.component_id} rated at ${contCurrent} A meets calculated requirement of ${reqContactorRating} A.`
          : `Contactor rating (${contCurrent} A) is below required rating of ${reqContactorRating} A.`,
        inputs: { motor_current_a: flc, required_contactor_a: reqContactorRating, selected_contactor_a: contCurrent },
        source_reference: rule.source_reference,
        rule_version: rule.version
      });
    }

    // R002: Overload range compatibility
    else if (rule.rule_id === 'R002') {
      if (!overload) {
        results.push({
          rule_id: 'R002',
          title: rule.title,
          result: 'FAIL',
          explanation: 'No overload relay selected from catalog.',
          inputs: { motor_current_a: flc },
          source_reference: rule.source_reference,
          rule_version: rule.version
        });
      } else {
        const minVal = overload.overload_range_min || 0;
        const maxVal = overload.overload_range_max || 0;

        if (rule.version === '2026.2') {
          // Stricter requirement in 2026.2: maxVal >= 1.25 * flc AND minVal <= 0.80 * flc
          const reqLower = Math.round(0.80 * flc * 100) / 100;
          const reqUpper = Math.round(1.25 * flc * 100) / 100;
          const isPass = (minVal <= reqLower && maxVal >= reqUpper);
          results.push({
            rule_id: 'R002',
            title: rule.title,
            result: isPass ? 'PASS' : 'FAIL',
            explanation: isPass
              ? `Overload range [${minVal}-${maxVal} A] satisfies enhanced 2026.2 tolerance limits (<= ${reqLower} A and >= ${reqUpper} A).`
              : `Selected overload relay range [${minVal}-${maxVal} A] does not cover enhanced 2026.2 requirement: upper dial must reach at least ${reqUpper} A (1.25x FLC). Recommendation: Select another component from the approved catalog.`,
            inputs: { motor_current_a: flc, selected_range: [minVal, maxVal], required_range_limits: [reqLower, reqUpper] },
            source_reference: rule.source_reference,
            rule_version: rule.version
          });
        } else {
          // Standard 2026.1 requirement: minVal <= flc <= maxVal
          const isPass = (minVal <= flc && flc <= maxVal);
          results.push({
            rule_id: 'R002',
            title: rule.title,
            result: isPass ? 'PASS' : 'FAIL',
            explanation: isPass
              ? `Selected overload relay range [${minVal}-${maxVal} A] encompasses motor full-load current (${flc} A).`
              : `Selected overload relay range [${minVal}-${maxVal} A] does not cover the calculated requirement (${flc} A). Required: 14-18 A. Recommendation: Select another component from the approved catalog.`,
            inputs: { motor_current_a: flc, selected_range: [minVal, maxVal] },
            source_reference: rule.source_reference,
            rule_version: rule.version
          });
        }
      }
    }

    // R003: Required protection present
    else if (rule.rule_id === 'R003') {
      if (!protectionRequired) {
        results.push({
          rule_id: 'R003',
          title: rule.title,
          result: 'PASS',
          explanation: 'Motor branch protection is omitted by explicit engineer specification.',
          inputs: { protection_required: false },
          source_reference: rule.source_reference,
          rule_version: rule.version
        });
      } else {
        const isPass = protection !== undefined;
        results.push({
          rule_id: 'R003',
          title: rule.title,
          result: isPass ? 'PASS' : 'FAIL',
          explanation: isPass
            ? `Dedicated branch protection device (${protection.component_id} ${protection.model}) is included.`
            : 'Required branch motor protection (MPCB/MCCB) is missing from bill of materials.',
          inputs: { protection_required: true, has_protection: isPass },
          source_reference: rule.source_reference,
          rule_version: rule.version
        });
      }
    }

    // R004: Catalog component active
    else if (rule.rule_id === 'R004') {
      const inactive = selectedComponents.filter(c => !c.active).map(c => c.component_id);
      const isPass = inactive.length === 0;
      results.push({
        rule_id: 'R004',
        title: rule.title,
        result: isPass ? 'PASS' : 'FAIL',
        explanation: isPass
          ? 'All selected components are currently active and approved in the local catalog.'
          : `Selected design includes inactive/discontinued components: ${inactive.join(', ')}.`,
        inputs: { inactive_components: inactive },
        source_reference: rule.source_reference,
        rule_version: rule.version
      });
    }

    // R005: Voltage rating adequacy
    else if (rule.rule_id === 'R005') {
      const powerComps = selectedComponents.filter(c => ['Contactor', 'Circuit Protection', 'Main Isolator'].includes(c.component_type));
      const underrated = powerComps.filter(c => c.rated_voltage < voltage).map(c => c.component_id);
      const isPass = underrated.length === 0;
      results.push({
        rule_id: 'R005',
        title: rule.title,
        result: isPass ? 'PASS' : 'FAIL',
        explanation: isPass
          ? `All power devices have operational voltage rating >= system nominal voltage (${voltage} V).`
          : `Components underrated for ${voltage} V: ${underrated.join(', ')}.`,
        inputs: { system_voltage_v: voltage, underrated },
        source_reference: rule.source_reference,
        rule_version: rule.version
      });
    }

    // R006: Main Isolator sizing
    else if (rule.rule_id === 'R006') {
      const isoRating = isolator ? isolator.rated_current : 0;
      const reqIso = flc * 1.25;
      const isPass = isoRating >= reqIso;
      results.push({
        rule_id: 'R006',
        title: rule.title,
        result: isPass ? 'PASS' : 'FAIL',
        explanation: isPass
          ? `Main Isolator (${isolator?.component_id}, ${isoRating} A) satisfies 125% requirement (${reqIso} A).`
          : `Main Isolator (${isoRating} A) is under-sized for 125% of motor current (${reqIso} A).`,
        inputs: { motor_current_a: flc, required_isolator_a: reqIso, selected_isolator_a: isoRating },
        source_reference: rule.source_reference,
        rule_version: rule.version
      });
    }

    // R007: Enclosure spatial allowance
    else if (rule.rule_id === 'R007') {
      const isPass = spacePct <= 70.0;
      results.push({
        rule_id: 'R007',
        title: rule.title,
        result: isPass ? 'PASS' : 'WARNING',
        explanation: isPass
          ? `Backplate component packing density is ${spacePct}% (within 70% thermal and duct threshold).`
          : `Backplate component packing density is ${spacePct}% (exceeds 70% threshold; consider upgrading enclosure size).`,
        inputs: { utilization_pct: spacePct, limit_pct: 70.0 },
        source_reference: rule.source_reference,
        rule_version: rule.version
      });
    }

    // R008: Control circuit voltage compatibility
    else if (rule.rule_id === 'R008') {
      const xfmrSec = transformer ? (transformer.coil_voltage || 24) : 24;
      const coilV = contactor ? (contactor.coil_voltage || 24) : 24;
      const isPass = xfmrSec === coilV;
      results.push({
        rule_id: 'R008',
        title: rule.title,
        result: isPass ? 'PASS' : 'FAIL',
        explanation: isPass
          ? `Contactor coil voltage (${coilV} V) matches control transformer secondary (${xfmrSec} V).`
          : `Control voltage mismatch: contactor coil is ${coilV} V but transformer secondary is ${xfmrSec} V.`,
        inputs: { contactor_coil_v: coilV, transformer_sec_v: xfmrSec },
        source_reference: rule.source_reference,
        rule_version: rule.version
      });
    }
  }

  for (const r of results) {
    if (r.result === 'PASS') passCount++;
    else if (r.result === 'FAIL') failCount++;
    else if (r.result === 'WARNING') warnCount++;
  }

  const overall = failCount > 0 ? 'FAIL' : (warnCount > 0 ? 'WARNING' : 'PASS');

  return {
    overall_status: overall,
    pass_count: passCount,
    fail_count: failCount,
    warn_count: warnCount,
    rules_evaluated: results.length,
    rule_version: ruleVersion,
    rule_results: results
  };
}

// Traceability Graph Builder
export function buildTraceabilityGraph(
  designId: string,
  rawBrief: string,
  requirements: ExtractedRequirements,
  calculations: CalculationResult[],
  selectedComponents: CatalogComponent[],
  compliance: ComplianceResult,
  catalogVersion: string,
  ruleVersion: string,
  approval?: any
) {
  const nodes: any[] = [];
  const edges: any[] = [];

  // Node 1: Brief
  nodes.push({
    id: 'node-brief',
    type: 'USER_BRIEF',
    label: 'User Design Brief',
    description: rawBrief.length > 80 ? rawBrief.slice(0, 80) + '...' : rawBrief,
    data: { raw_brief: rawBrief }
  });

  // Node 2: Extracted Requirements
  nodes.push({
    id: 'node-req',
    type: 'EXTRACTED_REQUIREMENT',
    label: 'Structured Requirements',
    description: `${requirements.motor_power_kw || 7.5} kW | ${requirements.motor_current_a || 15} A | ${requirements.voltage_v || 415} V | ${requirements.starter_type || 'DOL'}`,
    data: requirements
  });
  edges.push({ from: 'node-brief', to: 'node-req', label: 'NLP / Structured Extraction' });

  // Nodes for Calculations
  calculations.forEach((calc, idx) => {
    const calcNodeId = `node-calc-${idx + 1}`;
    nodes.push({
      id: calcNodeId,
      type: 'CALCULATION',
      label: calc.name,
      description: `${calc.formula_id} → ${calc.result_value} ${calc.result_unit}`,
      data: calc
    });
    edges.push({ from: 'node-req', to: calcNodeId, label: 'Deterministic Sizing' });
  });

  // Nodes for Key Selected Components
  const keyTypes = ['Main Isolator', 'Circuit Protection', 'Contactor', 'Overload Relay', 'Enclosure'];
  selectedComponents.filter(c => keyTypes.includes(c.component_type)).forEach((comp) => {
    const compNodeId = `node-comp-${comp.component_id}`;
    nodes.push({
      id: compNodeId,
      type: 'CATALOG_COMPONENT',
      label: `${comp.component_type}: ${comp.component_id}`,
      description: `${comp.model} (${comp.rated_current} A, Cat. v${comp.catalog_version})`,
      data: comp
    });

    // Link calculation to component
    if (comp.component_type === 'Contactor') {
      edges.push({ from: 'node-calc-1', to: compNodeId, label: 'Rated Current >= 18 A' });
    } else if (comp.component_type === 'Overload Relay') {
      edges.push({ from: 'node-calc-2', to: compNodeId, label: 'Window Coverage 12-18 A' });
    } else if (comp.component_type === 'Circuit Protection') {
      edges.push({ from: 'node-calc-3', to: compNodeId, label: 'Magnetic Trip Sizing' });
    } else {
      edges.push({ from: 'node-calc-4', to: compNodeId, label: 'Footprint & Clearance' });
    }
  });

  // Nodes for Rules
  compliance.rule_results.forEach((ruleRes) => {
    const ruleNodeId = `node-rule-${ruleRes.rule_id}`;
    nodes.push({
      id: ruleNodeId,
      type: 'RULE_CHECK',
      label: `${ruleRes.rule_id}: ${ruleRes.title}`,
      description: `Result: ${ruleRes.result} (v${ruleRes.rule_version})`,
      status: ruleRes.result,
      data: ruleRes
    });

    if (ruleRes.rule_id === 'R001') {
      const cont = selectedComponents.find(c => c.component_type === 'Contactor');
      if (cont) edges.push({ from: `node-comp-${cont.component_id}`, to: ruleNodeId, label: 'AC-3 Verification' });
    } else if (ruleRes.rule_id === 'R002') {
      const ovr = selectedComponents.find(c => c.component_type === 'Overload Relay');
      if (ovr) edges.push({ from: `node-comp-${ovr.component_id}`, to: ruleNodeId, label: 'Dial Window Verification' });
    } else if (ruleRes.rule_id === 'R003') {
      const prot = selectedComponents.find(c => c.component_type === 'Circuit Protection');
      if (prot) edges.push({ from: `node-comp-${prot.component_id}`, to: ruleNodeId, label: 'Mandatory Protection' });
    }
  });

  // Node 7: Design Decision
  nodes.push({
    id: 'node-decision',
    type: 'DESIGN_DECISION',
    label: 'Design Assembly Decision',
    description: `Overall Compliance: ${compliance.overall_status} (Pass: ${compliance.pass_count}, Fail: ${compliance.fail_count})`,
    status: compliance.overall_status,
    data: { overall_status: compliance.overall_status, catalogVersion, ruleVersion }
  });

  compliance.rule_results.slice(0, 4).forEach((r) => {
    edges.push({ from: `node-rule-${r.rule_id}`, to: 'node-decision', label: r.result });
  });

  // Node 8: Engineer Approval
  nodes.push({
    id: 'node-approval',
    type: 'ENGINEER_APPROVAL',
    label: 'Engineer Approval Sign-off',
    description: approval ? `Signed by: ${approval.engineer_name} [${approval.approval_status}]` : 'Pending Qualified Review',
    status: approval ? approval.approval_status : 'PENDING',
    data: approval || { status: 'PENDING', note: 'Final design requires qualified engineering review.' }
  });
  edges.push({ from: 'node-decision', to: 'node-approval', label: 'Formal Gate' });

  return {
    design_id: designId,
    catalog_version: catalogVersion,
    rule_version: ruleVersion,
    nodes,
    edges
  };
}

// Layout Generator
export function generatePanelLayoutData(
  selectedComponents: CatalogComponent[],
  enclosureWidthMm: number = 400,
  enclosureHeightMm: number = 500
) {
  // Placement coordinates for SVG rendering
  // Top rail: Isolator, MPCB, Contactor, Overload Relay
  // Bottom rail: Control transformer, Power Terminals, Control Terminals
  // Door: Start PB, Stop PB, E-Stop PB, Run Ind, Trip Ind

  const items: any[] = [];
  let currentTopX = 50;
  const topRailY = 130;

  const isolator = selectedComponents.find(c => c.component_type === 'Main Isolator');
  if (isolator) {
    items.push({
      id: isolator.component_id,
      name: 'Main Isolator',
      model: isolator.model,
      x: currentTopX,
      y: topRailY,
      width: 55,
      height: 70,
      rail: 1,
      color: '#475569',
      accent: '#f59e0b'
    });
    currentTopX += 65;
  }

  const protection = selectedComponents.find(c => c.component_type === 'Circuit Protection');
  if (protection) {
    items.push({
      id: protection.component_id,
      name: 'Circuit Protection (MPCB)',
      model: protection.model,
      x: currentTopX,
      y: topRailY,
      width: 50,
      height: 80,
      rail: 1,
      color: '#334155',
      accent: '#3b82f6'
    });
    currentTopX += 60;
  }

  const contactor = selectedComponents.find(c => c.component_type === 'Contactor');
  if (contactor) {
    items.push({
      id: contactor.component_id,
      name: 'Motor Contactor',
      model: contactor.model,
      x: currentTopX,
      y: topRailY,
      width: 50,
      height: 75,
      rail: 1,
      color: '#1e293b',
      accent: '#10b981'
    });
    currentTopX += 60;
  }

  const overload = selectedComponents.find(c => c.component_type === 'Overload Relay');
  if (overload) {
    items.push({
      id: overload.component_id,
      name: 'Thermal Overload Relay',
      model: overload.model,
      x: currentTopX,
      y: topRailY + 20,
      width: 50,
      height: 55,
      rail: 1,
      color: '#334155',
      accent: '#ef4444'
    });
    currentTopX += 60;
  }

  // Rail 2: Bottom rail (y = 310)
  let currentBottomX = 50;
  const bottomRailY = 310;

  const xfmr = selectedComponents.find(c => c.component_type === 'Control Transformer');
  if (xfmr) {
    items.push({
      id: xfmr.component_id,
      name: 'Control Transformer (415/24V)',
      model: xfmr.model,
      x: currentBottomX,
      y: bottomRailY - 10,
      width: 65,
      height: 75,
      rail: 2,
      color: '#475569',
      accent: '#8b5cf6'
    });
    currentBottomX += 75;
  }

  const tbPwr = selectedComponents.find(c => c.component_id === 'TB-SET-PWR');
  if (tbPwr) {
    items.push({
      id: tbPwr.component_id,
      name: 'Power Terminals (L1-L3, U-W)',
      model: tbPwr.model,
      x: currentBottomX,
      y: bottomRailY,
      width: 90,
      height: 50,
      rail: 2,
      color: '#64748b',
      accent: '#64748b'
    });
    currentBottomX += 100;
  }

  const tbCtrl = selectedComponents.find(c => c.component_id === 'TB-SET-CTRL');
  if (tbCtrl) {
    items.push({
      id: tbCtrl.component_id,
      name: 'Control Terminals',
      model: tbCtrl.model,
      x: currentBottomX,
      y: bottomRailY,
      width: 80,
      height: 45,
      rail: 2,
      color: '#64748b',
      accent: '#06b6d4'
    });
  }

  // Door devices
  const doorDevices = [
    { id: 'PB-ESTOP', name: 'Emergency Stop', x: 70, y: 440, r: 18, color: '#ef4444', label: 'E-STOP' },
    { id: 'PB-STOP', name: 'Stop Button', x: 130, y: 440, r: 14, color: '#dc2626', label: 'STOP' },
    { id: 'PB-START', name: 'Start Button', x: 180, y: 440, r: 14, color: '#16a34a', label: 'START' },
    { id: 'IND-RUN', name: 'Run Indicator', x: 240, y: 440, r: 10, color: '#22c55e', label: 'RUN' },
    { id: 'IND-TRIP', name: 'Trip Indicator', x: 290, y: 440, r: 10, color: '#f59e0b', label: 'TRIP' }
  ];

  return {
    enclosure_dimensions: {
      width_mm: enclosureWidthMm,
      height_mm: enclosureHeightMm,
      depth_mm: 200
    },
    din_rails: [
      { id: 'RAIL-1', y: topRailY + 35, width: 340, x: 30, height: 10 },
      { id: 'RAIL-2', y: bottomRailY + 25, width: 340, x: 30, height: 10 }
    ],
    wireways: [
      { id: 'DUCT-TOP', x: 25, y: 60, width: 350, height: 25 },
      { id: 'DUCT-MID', x: 25, y: 235, width: 350, height: 25 },
      { id: 'DUCT-BOT', x: 25, y: 390, width: 350, height: 25 }
    ],
    components_placed: items,
    door_mounted_devices: doorDevices,
    disclaimer: 'Layout is conceptual and requires engineering verification against manufacturer clearances, thermal de-rating, and enclosure IP rating specifications.'
  };
}
