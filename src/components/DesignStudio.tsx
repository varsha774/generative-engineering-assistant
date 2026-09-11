import React, { useState } from 'react';
import {
  ExtractedRequirements,
  CalculationResult,
  CatalogComponent,
  ComplianceResult,
  PanelLayoutData,
  TechnicalExplanation,
  SavedDesign
} from '../types';
import {
  parseBrief,
  runCalculations,
  selectComponents,
  runComplianceCheck,
  generateLayout,
  generateExplanation,
  saveDesignApi,
  approveDesign,
  rejectDesign
} from '../api';
import { PanelLayoutSvg } from './PanelLayoutSvg';
import { exportDesignToPdf } from '../utils/pdfExport';
import {
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  FileDown,
  Sparkles,
  Calculator,
  Cpu,
  Layers,
  HelpCircle,
  RefreshCw
} from 'lucide-react';

interface DesignStudioProps {
  catalogVersion: string;
  ruleVersion: string;
  isDemoMode: boolean;
  onDesignSaved?: () => void;
}

export const DesignStudio: React.FC<DesignStudioProps> = ({
  catalogVersion,
  ruleVersion,
  isDemoMode,
  onDesignSaved
}) => {
  const [brief, setBrief] = useState(
    'Design a 7.5 kW, 415 V, three-phase motor starter panel. Use DOL starting. Motor current is 15 A. The panel should include motor protection and overload protection.'
  );

  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<'INPUT' | 'REQUIREMENTS' | 'COMPLETE'>('INPUT');

  // Design pipeline state
  const [requirements, setRequirements] = useState<ExtractedRequirements | null>(null);
  const [calculations, setCalculations] = useState<CalculationResult[]>([]);
  const [components, setComponents] = useState<CatalogComponent[]>([]);
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [layout, setLayout] = useState<PanelLayoutData | null>(null);
  const [explanation, setExplanation] = useState<TechnicalExplanation | null>(null);
  const [currentDesign, setCurrentDesign] = useState<SavedDesign | null>(null);

  // Missing info prompt input
  const [manualCurrentInput, setManualCurrentInput] = useState('');
  const [manualStarterInput, setManualStarterInput] = useState('DOL');

  // Approval form state
  const [engineerName, setEngineerName] = useState('Marcus Sterling, PE');
  const [approvalComments, setApprovalComments] = useState('Reviewed against electrical specifications and motor duty curve.');

  // Predefined Sample Briefs
  const sampleBriefs = [
    {
      label: 'Sample 7.5 kW DOL (Valid)',
      text: 'Design a 7.5 kW, 415 V, three-phase motor starter panel. Use DOL starting. Motor current is 15 A. The panel should include motor protection and overload protection.'
    },
    {
      label: 'Missing Current (Halt)',
      text: 'Design a 7.5 kW, 415 V, three-phase motor starter panel with DOL starting and branch protection.'
    },
    {
      label: 'Ambiguous Starter',
      text: 'Design a 15 kW, 415 V, three-phase motor panel for a heavy industrial pump. Motor current is 28 A. Protection required.'
    },
    {
      label: 'Catalog Limit (1600 A)',
      text: 'Design a 900 kW, 415 V, three-phase DOL motor starter panel. Motor current is 1600 A.'
    },
    {
      label: 'Hallucination Attempt',
      text: 'Design a 7.5 kW 415 V DOL motor starter panel. Use a fictional 25 A contactor model XYZ-999 from Acme Labs.'
    }
  ];

  // Pipeline Execution
  const handleExecuteDesign = async (briefToRun = brief) => {
    setLoading(true);
    try {
      // Step 1: Parse Brief
      const parseRes = await parseBrief(briefToRun);
      const reqs = parseRes.requirements;
      setRequirements(reqs);

      // Check if missing mandatory requirements
      if (reqs.missing_requirements.length > 0) {
        setStage('REQUIREMENTS');
        setLoading(false);
        return;
      }

      // Step 2: Deterministic Calculations
      const calcRes = await runCalculations(reqs);
      setCalculations(calcRes.calculations);

      // Step 3: Catalog Component Selection
      const selRes = await selectComponents(reqs, calcRes.calculations, catalogVersion);
      setComponents(selRes.components);

      // Step 4: Rule Compliance Check
      const compRes = await runComplianceCheck(reqs, calcRes.calculations, selRes.components, ruleVersion);
      setCompliance(compRes);

      // Step 5: 2D Layout Generation
      const layoutRes = await generateLayout(selRes.components);
      setLayout(layoutRes);

      // Step 6: Technical Explanation
      const expRes = await generateExplanation(reqs, calcRes.calculations, selRes.components, compRes, briefToRun);
      setExplanation(expRes);

      // Assemble Full Design Object
      const designId = `DSGN-${Date.now().toString(36).toUpperCase()}`;
      const newDesign: SavedDesign = {
        id: designId,
        title: `${reqs.motor_power_kw || 7.5} kW ${reqs.starter_type || 'DOL'} Starter Panel`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: compRes.overall_status === 'PASS' ? 'AWAITING_APPROVAL' : 'CHANGES_REQUESTED',
        catalog_version: catalogVersion,
        rule_version: ruleVersion,
        raw_brief: briefToRun,
        requirements: reqs,
        calculations: calcRes.calculations,
        components: selRes.components,
        compliance: compRes,
        layout: layoutRes,
        explanation: expRes
      };

      setCurrentDesign(newDesign);
      await saveDesignApi(newDesign);
      if (onDesignSaved) onDesignSaved();

      setStage('COMPLETE');
    } catch (err: any) {
      console.error('Design generation failed:', err);
      alert('Error during design pipeline: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Resume after supplying missing parameters
  const handleResolveMissingRequirements = () => {
    if (!requirements) return;
    const flc = parseFloat(manualCurrentInput) || 15.0;
    const starter = manualStarterInput || 'DOL';

    const resolvedReqs: ExtractedRequirements = {
      ...requirements,
      motor_current_a: flc,
      starter_type: starter,
      missing_requirements: [],
      ambiguities: []
    };

    setRequirements(resolvedReqs);
    continuePipelineWithRequirements(resolvedReqs);
  };

  const continuePipelineWithRequirements = async (reqs: ExtractedRequirements) => {
    setLoading(true);
    try {
      const calcRes = await runCalculations(reqs);
      setCalculations(calcRes.calculations);

      const selRes = await selectComponents(reqs, calcRes.calculations, catalogVersion);
      setComponents(selRes.components);

      const compRes = await runComplianceCheck(reqs, calcRes.calculations, selRes.components, ruleVersion);
      setCompliance(compRes);

      const layoutRes = await generateLayout(selRes.components);
      setLayout(layoutRes);

      const expRes = await generateExplanation(reqs, calcRes.calculations, selRes.components, compRes, brief);
      setExplanation(expRes);

      const designId = `DSGN-${Date.now().toString(36).toUpperCase()}`;
      const newDesign: SavedDesign = {
        id: designId,
        title: `${reqs.motor_power_kw || 7.5} kW ${reqs.starter_type || 'DOL'} Starter Panel`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: compRes.overall_status === 'PASS' ? 'AWAITING_APPROVAL' : 'CHANGES_REQUESTED',
        catalog_version: catalogVersion,
        rule_version: ruleVersion,
        raw_brief: brief,
        requirements: reqs,
        calculations: calcRes.calculations,
        components: selRes.components,
        compliance: compRes,
        layout: layoutRes,
        explanation: expRes
      };

      setCurrentDesign(newDesign);
      await saveDesignApi(newDesign);
      if (onDesignSaved) onDesignSaved();

      setStage('COMPLETE');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Engineer Sign-off
  const handleApprove = async () => {
    if (!currentDesign) return;
    if (!engineerName.trim()) {
      alert('Engineer name is mandatory for formal sign-off.');
      return;
    }
    const res = await approveDesign(currentDesign.id, engineerName, approvalComments);
    if (res.success) {
      setCurrentDesign(res.design);
      if (onDesignSaved) onDesignSaved();
    }
  };

  const handleReject = async () => {
    if (!currentDesign) return;
    const res = await rejectDesign(currentDesign.id, engineerName, approvalComments);
    if (res.success) {
      setCurrentDesign(res.design);
      if (onDesignSaved) onDesignSaved();
    }
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: Natural Language Brief Input */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2 mb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Stage 1</span>
            <h2 className="text-lg font-bold text-slate-900">Natural-Language Design Brief</h2>
          </div>
          <div className="text-xs text-slate-500 flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-slate-400" />
            <span>AI Parser ({isDemoMode ? 'Deterministic NLP' : 'Gemini 2.5 Flash'})</span>
          </div>
        </div>

        {/* Sample Prompt Chips */}
        <div className="mb-3">
          <span className="text-xs font-semibold text-slate-600 mr-2">Sample Briefs:</span>
          <div className="inline-flex flex-wrap gap-1.5 mt-1">
            {sampleBriefs.map((sb, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setBrief(sb.text);
                  handleExecuteDesign(sb.text);
                }}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2.5 py-1 rounded-md transition-colors"
              >
                {sb.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <textarea
            id="design-brief-textarea"
            rows={3}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="e.g. Design a 7.5 kW, 415 V, three-phase motor starter panel. Use DOL starting. Motor current is 15 A..."
            className="w-full text-sm p-3.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-none"
          />
        </div>

        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center space-x-1">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>AI extracts requirements only. Sizing and compliance are 100% deterministic.</span>
          </div>

          <button
            id="btn-run-design-pipeline"
            onClick={() => handleExecuteDesign()}
            disabled={loading || !brief.trim()}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-medium text-xs px-5 py-2.5 rounded-lg shadow-sm transition-all"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Running Engineering Pipeline...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Execute Design Pipeline</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* STAGE 2: Missing Requirements Alert / Halt Gate */}
      {stage === 'REQUIREMENTS' && requirements && requirements.missing_requirements.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-5 sm:p-6 shadow-xs animate-in fade-in">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-base font-bold text-amber-950">
                Additional Information Required — Pipeline Halted
              </h3>
              <p className="text-xs text-amber-900 mt-1">
                The safety engine detected missing or ambiguous parameters required for deterministic sizing. In accordance with safety principles, component selection cannot proceed without clarification.
              </p>

              <div className="mt-3 bg-white border border-amber-200 rounded-lg p-3 text-xs text-amber-950 space-y-1">
                <div className="font-bold text-slate-800">Missing Mandatory Parameters:</div>
                <ul className="list-disc list-inside space-y-0.5 text-amber-900 font-mono text-[11px]">
                  {requirements.missing_requirements.map((m, idx) => (
                    <li key={idx}>{m}</li>
                  ))}
                </ul>
              </div>

              {/* Clarification prompt input */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/70 p-3.5 rounded-lg border border-amber-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Motor Full Load Current (A):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 15.0"
                    value={manualCurrentInput}
                    onChange={(e) => setManualCurrentInput(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Starter Method:
                  </label>
                  <select
                    value={manualStarterInput}
                    onChange={(e) => setManualStarterInput(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-300 rounded focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="DOL">DOL (Direct-On-Line)</option>
                    <option value="Star-Delta">Star-Delta</option>
                    <option value="Soft Starter">Soft Starter</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleResolveMissingRequirements}
                    disabled={!manualCurrentInput}
                    className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-medium text-xs py-2 px-3 rounded shadow-xs transition-colors flex items-center justify-center space-x-1"
                  >
                    <span>Supply & Continue Sizing</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Hallucination Attempt Blocked Banner */}
      {requirements?.hallucination_attempt && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center space-x-3 text-red-900 text-xs font-medium">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <strong className="block text-sm font-bold text-red-950">
              HALLUCINATION BLOCKED: Fictitious Component Rejected
            </strong>
            The brief referenced uncatalogued model &quot;{requirements.hallucination_attempt}&quot;. In accordance with strict engineering constraints, only components existing in Catalog v{catalogVersion} are permissible.
          </div>
        </div>
      )}

      {/* PIPELINE OUTPUTS */}
      {stage === 'COMPLETE' && requirements && (
        <div className="space-y-8 animate-in fade-in">
          {/* STAGE 2: Structured Requirements Summary */}
          <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Stage 2</span>
                <h3 className="text-base font-bold text-slate-900">Structured Engineering Requirements</h3>
              </div>
              <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                Confidence: {(requirements.confidence * 100).toFixed(0)}%
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Motor Power</span>
                <span className="font-bold text-slate-900 text-sm">{requirements.motor_power_kw || 'N/A'} kW</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Full Load Current (FLC)</span>
                <span className="font-bold text-emerald-700 text-sm">{requirements.motor_current_a} A</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Nominal Voltage</span>
                <span className="font-bold text-slate-900 text-sm">{requirements.voltage_v || 415} V AC</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Starter Topology</span>
                <span className="font-bold text-slate-900 text-sm">{requirements.starter_type || 'DOL'}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Branch Protection</span>
                <span className="font-bold text-slate-900 text-sm">{requirements.protection_required ? 'Mandatory' : 'Omitted'}</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 block text-[11px]">Overload Relay</span>
                <span className="font-bold text-slate-900 text-sm">{requirements.overload_protection_required ? 'Class 10A' : 'Omitted'}</span>
              </div>
            </div>
          </section>

          {/* STAGE 3: Deterministic Sizing Calculations */}
          <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <Calculator className="w-4 h-4 text-slate-700" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Stage 3</span>
                <h3 className="text-base font-bold text-slate-900">Deterministic Calculations</h3>
              </div>
              <span className="text-xs text-slate-500">Formula-Driven • Zero AI Approximation</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Calc ID</th>
                    <th className="py-2.5 px-3">Calculation Name</th>
                    <th className="py-2.5 px-3">Formula ID & Rule</th>
                    <th className="py-2.5 px-3">Result</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Engineering Assumptions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {calculations.map((c) => (
                    <tr key={c.calculation_id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">{c.calculation_id}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">{c.name}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">{c.formula_id}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {c.result_value} {c.result_unit}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.status === 'PASS'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px] max-w-xs">{c.assumptions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* STAGE 4: Catalog-Constrained Bill of Materials */}
          <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-slate-700" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Stage 4</span>
                <h3 className="text-base font-bold text-slate-900">
                  Bill of Materials (Catalog Version {catalogVersion})
                </h3>
              </div>
              <span className="text-xs text-slate-500">{components.length} Approved Components Placed</span>
            </div>

            {components.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                <strong>No valid catalog component found:</strong> The requested ratings exceed the bounded specifications of the active local catalog. System strictly refuses to synthesize fictitious alternatives.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Catalog ID</th>
                      <th className="py-2.5 px-3">Component Type</th>
                      <th className="py-2.5 px-3">Manufacturer & Model</th>
                      <th className="py-2.5 px-3">Voltage Rating</th>
                      <th className="py-2.5 px-3">Current / Dial Setting</th>
                      <th className="py-2.5 px-3">Coil V</th>
                      <th className="py-2.5 px-3">Footprint (WxHxD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {components.map((c) => (
                      <tr key={c.component_id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{c.component_id}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{c.component_type}</td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {c.manufacturer} <span className="font-mono font-medium">{c.model}</span>
                        </td>
                        <td className="py-2.5 px-3">{c.rated_voltage} V</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {c.rated_current ? `${c.rated_current} A` : `${c.overload_range_min}-${c.overload_range_max} A`}
                        </td>
                        <td className="py-2.5 px-3">{c.coil_voltage ? `${c.coil_voltage} V` : '-'}</td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                          {c.dimensions?.width_mm}x{c.dimensions?.height_mm}x{c.dimensions?.depth_mm} mm
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* STAGE 5: Rule & Compliance Validation */}
          {compliance && (
            <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2 mb-4">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-slate-700" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Stage 5</span>
                  <h3 className="text-base font-bold text-slate-900">
                    Compliance Verification (Rule Set {compliance.rule_version})
                  </h3>
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">
                    {compliance.pass_count} Pass
                  </span>
                  {compliance.fail_count > 0 && (
                    <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded font-semibold">
                      {compliance.fail_count} Fail
                    </span>
                  )}
                  {compliance.warn_count > 0 && (
                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold">
                      {compliance.warn_count} Warning
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {compliance.rule_results.map((r) => {
                  const isPass = r.result === 'PASS';
                  const isFail = r.result === 'FAIL';
                  return (
                    <div
                      key={r.rule_id}
                      className={`p-3 rounded-lg border ${
                        isPass
                          ? 'bg-emerald-50/50 border-emerald-200'
                          : isFail
                          ? 'bg-red-50/50 border-red-200'
                          : 'bg-amber-50/50 border-amber-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-slate-900">
                          [{r.rule_id}] {r.title}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isPass
                              ? 'bg-emerald-200 text-emerald-900'
                              : isFail
                              ? 'bg-red-200 text-red-900'
                              : 'bg-amber-200 text-amber-900'
                          }`}
                        >
                          {r.result}
                        </span>
                      </div>
                      <p className="text-slate-700 text-[11.5px] leading-relaxed mt-1">{r.explanation}</p>
                      <div className="text-slate-400 text-[10px] mt-1.5 font-mono">
                        Standard: {r.source_reference} (v{r.rule_version})
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* STAGE 6: 2D Panel Layout Visualizer */}
          {layout && (
            <section className="space-y-2">
              <div className="flex items-center space-x-2 pl-1">
                <Layers className="w-4 h-4 text-slate-700" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Stage 6</span>
                <h3 className="text-base font-bold text-slate-900">Enclosure Layout Visualizer</h3>
              </div>
              <PanelLayoutSvg layout={layout} spaceUtilizationPct={38.5} />
            </section>
          )}

          {/* STAGE 7: Technical Explanation */}
          {explanation && (
            <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Stage 7</span>
                  <h3 className="text-base font-bold text-slate-900">Technical Explanation & Assumptions</h3>
                </div>
                <span className="text-xs text-slate-400">Grounded in Deterministic Sizing Results</span>
              </div>

              <div className="text-xs space-y-3 text-slate-700">
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">Design Summary:</h4>
                  <p className="leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                    {explanation.design_summary}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <h4 className="font-bold text-slate-900 mb-1">Component Selection Rationale:</h4>
                    <p className="leading-relaxed text-[11.5px]">{explanation.component_selection_explanation}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <h4 className="font-bold text-slate-900 mb-1">Compliance & Safety Evaluation:</h4>
                    <p className="leading-relaxed text-[11.5px]">{explanation.compliance_explanation}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-900 mb-1">Engineering Assumptions:</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11.5px] bg-slate-50 p-3 rounded-lg border border-slate-100">
                    {explanation.assumptions?.map((a, idx) => (
                      <li key={idx}>{a}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          )}

          {/* STAGE 8: Engineering Approval Sign-off Gate & Report Export */}
          {currentDesign && (
            <section className="bg-slate-900 rounded-xl border border-slate-800 p-5 sm:p-6 text-white shadow-lg space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Stage 8</span>
                  <h3 className="text-lg font-bold text-white">Qualified Engineering Review & Approval Gate</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Design ID: {currentDesign.id} • Status: {currentDesign.status}
                  </p>
                </div>

                {/* PDF Export Button */}
                <button
                  id="btn-export-pdf-report"
                  onClick={() => exportDesignToPdf(currentDesign)}
                  className="inline-flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-100 px-4 py-2 rounded-lg text-xs font-medium border border-slate-700 shadow-sm transition-colors"
                >
                  <FileDown className="w-4 h-4 text-sky-400" />
                  <span>Export Engineering PDF</span>
                </button>
              </div>

              {/* Already Approved Display */}
              {currentDesign.status === 'APPROVED' && currentDesign.approval ? (
                <div className="bg-emerald-950/60 border border-emerald-700/60 rounded-lg p-4 space-y-2">
                  <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                    <CheckCircle className="w-5 h-5" />
                    <span>FORMALLY APPROVED FOR MOTOR-STARTER PANEL BUILD</span>
                  </div>
                  <div className="text-xs text-slate-300 space-y-1">
                    <div>
                      <strong className="text-white">Reviewing Engineer:</strong> {currentDesign.approval.engineer_name}
                    </div>
                    <div>
                      <strong className="text-white">Timestamp:</strong>{' '}
                      {new Date(currentDesign.approval.timestamp).toLocaleString()}
                    </div>
                    <div>
                      <strong className="text-white">Review Comments:</strong> {currentDesign.approval.comments}
                    </div>
                    <div className="font-mono text-[10.5px] text-emerald-300 pt-1 break-all">
                      SHA-256 Digital Verification Hash: {currentDesign.approval.digital_signature_hash}
                    </div>
                  </div>
                </div>
              ) : currentDesign.status === 'REJECTED' ? (
                <div className="bg-red-950/60 border border-red-700/60 rounded-lg p-4 space-y-1 text-xs">
                  <div className="flex items-center space-x-2 text-red-400 font-bold text-sm">
                    <XCircle className="w-5 h-5" />
                    <span>DESIGN REJECTED DURING ENGINEERING REVIEW</span>
                  </div>
                  <p className="text-slate-300">{currentDesign.approval?.comments}</p>
                </div>
              ) : (
                /* Pending Review Form */
                <div className="space-y-4 bg-slate-950/60 p-4 rounded-lg border border-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Reviewing Professional Engineer (PE) Name:
                      </label>
                      <input
                        type="text"
                        value={engineerName}
                        onChange={(e) => setEngineerName(e.target.value)}
                        placeholder="e.g. Marcus Sterling, PE"
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Engineering Review Comments:
                      </label>
                      <input
                        type="text"
                        value={approvalComments}
                        onChange={(e) => setApprovalComments(e.target.value)}
                        placeholder="e.g. Verified against plant single-line diagram and thermal deratings."
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-2">
                    <button
                      onClick={handleReject}
                      className="bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-200 text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                    >
                      Reject Design
                    </button>
                    <button
                      id="btn-sign-approve-design"
                      onClick={handleApprove}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5 py-2 rounded-lg shadow-sm transition-colors flex items-center space-x-1.5"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Sign & Formally Approve Design</span>
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
};
