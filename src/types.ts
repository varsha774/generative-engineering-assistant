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

export interface TechnicalExplanation {
  design_summary: string;
  component_selection_explanation: string;
  calculation_explanation: string;
  compliance_explanation: string;
  assumptions: string[];
  warnings: string[];
  violations: string[];
  disclaimer: string;
}

export interface PanelLayoutData {
  enclosure_dimensions: {
    width_mm: number;
    height_mm: number;
    depth_mm: number;
  };
  din_rails: Array<{ id: string; y: number; width: number; x: number; height: number }>;
  wireways: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  components_placed: Array<{
    id: string;
    name: string;
    model: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rail: number;
    color: string;
    accent: string;
  }>;
  door_mounted_devices: Array<{
    id: string;
    name: string;
    x: number;
    y: number;
    r: number;
    color: string;
    label: string;
  }>;
  disclaimer: string;
}

export interface SavedDesign {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  status: 'DRAFT' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED' | 'HALTED_MISSING_INFO';
  catalog_version: string;
  rule_version: string;
  raw_brief: string;
  requirements: ExtractedRequirements;
  calculations: CalculationResult[];
  components: CatalogComponent[];
  compliance: ComplianceResult;
  layout: PanelLayoutData;
  explanation: TechnicalExplanation;
  approval?: {
    engineer_name: string;
    comments: string;
    timestamp: string;
    approval_status: 'APPROVED' | 'REJECTED';
    digital_signature_hash: string;
  };
}

export interface TraceabilityNode {
  id: string;
  type: string;
  label: string;
  description: string;
  status?: string;
  data: any;
}

export interface TraceabilityEdge {
  from: string;
  to: string;
  label: string;
}

export interface TraceabilityGraph {
  design_id: string;
  catalog_version: string;
  rule_version: string;
  nodes: TraceabilityNode[];
  edges: TraceabilityEdge[];
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  brief: string;
  forced_component?: string;
  expected_result: string;
  expected_stage: string;
  notes: string;
}

export interface TestRunResult {
  test_id: string;
  name: string;
  expected: string;
  actual: string;
  matched_expected: boolean;
  details: string;
}
