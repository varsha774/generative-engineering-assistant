/**
 * Frontend API client communicating with backend Express server.
 */

import {
  ExtractedRequirements,
  CalculationResult,
  CatalogComponent,
  ComplianceResult,
  PanelLayoutData,
  TechnicalExplanation,
  SavedDesign,
  TraceabilityGraph,
  TestCase,
  TestRunResult,
  RuleDefinition
} from './types';

export async function fetchSystemStatus() {
  const res = await fetch('/api/status');
  return res.json();
}

export async function fetchCatalog(version: string = '2026.1'): Promise<{ catalog_version: string; count: number; components: CatalogComponent[] }> {
  const res = await fetch(`/api/catalog?version=${version}`);
  return res.json();
}

export async function fetchRules(version: string = '2026.1'): Promise<{ rule_version: string; count: number; rules: RuleDefinition[] }> {
  const res = await fetch(`/api/rules?version=${version}`);
  return res.json();
}

export async function parseBrief(brief: string): Promise<{
  raw_brief: string;
  requirements: ExtractedRequirements;
  is_demo_mode: boolean;
  warning: string;
}> {
  const res = await fetch('/api/parse-brief', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brief })
  });
  if (!res.ok) throw new Error('Failed to parse design brief');
  return res.json();
}

export async function runCalculations(
  requirements: ExtractedRequirements,
  components: CatalogComponent[] = []
): Promise<{ calculations: CalculationResult[] }> {
  const res = await fetch('/api/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requirements, components })
  });
  if (!res.ok) throw new Error('Failed to calculate sizing');
  return res.json();
}

export async function selectComponents(
  requirements: ExtractedRequirements,
  calculations: CalculationResult[],
  catalogVersion: string = '2026.1',
  forcedComponentId?: string
): Promise<{
  components: CatalogComponent[];
  unmatched_types: string[];
  selection_log: string[];
  error?: string;
}> {
  const res = await fetch('/api/select-components', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requirements,
      calculations,
      catalog_version: catalogVersion,
      forced_component_id: forcedComponentId
    })
  });
  if (!res.ok) throw new Error('Failed to select components');
  return res.json();
}

export async function runComplianceCheck(
  requirements: ExtractedRequirements,
  calculations: CalculationResult[],
  components: CatalogComponent[],
  ruleVersion: string = '2026.1'
): Promise<ComplianceResult> {
  const res = await fetch('/api/compliance-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requirements,
      calculations,
      components,
      rule_version: ruleVersion
    })
  });
  if (!res.ok) throw new Error('Failed to check compliance');
  return res.json();
}

export async function generateLayout(
  components: CatalogComponent[],
  widthMm: number = 400,
  heightMm: number = 500
): Promise<PanelLayoutData> {
  const res = await fetch('/api/generate-layout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      components,
      enclosure_width_mm: widthMm,
      enclosure_height_mm: heightMm
    })
  });
  if (!res.ok) throw new Error('Failed to generate layout');
  return res.json();
}

export async function generateExplanation(
  requirements: ExtractedRequirements,
  calculations: CalculationResult[],
  components: CatalogComponent[],
  compliance: ComplianceResult,
  rawBrief: string
): Promise<TechnicalExplanation> {
  const res = await fetch('/api/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requirements,
      calculations,
      components,
      compliance,
      raw_brief: rawBrief
    })
  });
  if (!res.ok) throw new Error('Failed to generate explanation');
  return res.json();
}

export async function fetchDesigns(): Promise<SavedDesign[]> {
  const res = await fetch('/api/designs');
  return res.json();
}

export async function fetchDesign(id: string): Promise<SavedDesign> {
  const res = await fetch(`/api/designs/${id}`);
  if (!res.ok) throw new Error('Design not found');
  return res.json();
}

export async function saveDesignApi(design: SavedDesign): Promise<SavedDesign> {
  const res = await fetch('/api/designs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(design)
  });
  return res.json();
}

export async function deleteDesignApi(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`/api/designs/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function fetchTraceability(id: string): Promise<TraceabilityGraph> {
  const res = await fetch(`/api/designs/${id}/traceability`);
  return res.json();
}

export async function approveDesign(id: string, engineerName: string, comments: string) {
  const res = await fetch(`/api/designs/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ engineer_name: engineerName, comments })
  });
  return res.json();
}

export async function rejectDesign(id: string, engineerName: string, comments: string) {
  const res = await fetch(`/api/designs/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ engineer_name: engineerName, comments })
  });
  return res.json();
}

export async function fetchTestCases(): Promise<TestCase[]> {
  const res = await fetch('/api/test-cases');
  return res.json();
}

export async function runTestCases(testId?: string): Promise<{
  total_executed: number;
  passed_expected: number;
  results: TestRunResult[];
}> {
  const res = await fetch('/api/test-cases/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ test_id: testId })
  });
  return res.json();
}

export async function fetchEvaluationMetrics(): Promise<{
  metrics: Array<{ name: string; target: string; achieved: string; status: string; note: string }>;
  disclaimer: string;
}> {
  const res = await fetch('/api/evaluation-metrics');
  return res.json();
}
