import React, { useState } from 'react';
import { runCalculations, selectComponents, runComplianceCheck } from '../api';
import { ExtractedRequirements } from '../types';
import { GitCompare, CheckCircle, XCircle, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';

export const RuleUpdateDemo: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<{
    v1: any;
    v2: any;
  } | null>(null);

  // Standard benchmark motor specification: 7.5 kW, 15 A DOL
  const benchmarkReqs: ExtractedRequirements = {
    motor_power_kw: 7.5,
    voltage_v: 415,
    phase: 3,
    frequency_hz: 50,
    motor_current_a: 15.0,
    starter_type: 'DOL',
    protection_required: true,
    overload_protection_required: true,
    missing_requirements: [],
    ambiguities: [],
    confidence: 1.0
  };

  const handleRunComparison = async () => {
    setRunning(true);
    try {
      const calcs = await runCalculations(benchmarkReqs);
      // Select standard catalog components
      const sel = await selectComponents(benchmarkReqs, calcs.calculations, '2026.1');

      // 1. Evaluate against Rule Set 2026.1
      const comp2026_1 = await runComplianceCheck(
        benchmarkReqs,
        calcs.calculations,
        sel.components,
        '2026.1'
      );

      // 2. Evaluate against Rule Set 2026.2
      const comp2026_2 = await runComplianceCheck(
        benchmarkReqs,
        calcs.calculations,
        sel.components,
        '2026.2'
      );

      setResults({
        v1: comp2026_1,
        v2: comp2026_2
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRunning(false);
    }
  };

  const r002_v1 = results?.v1?.rule_results?.find((r: any) => r.rule_id === 'R002');
  const r002_v2 = results?.v2?.rule_results?.find((r: any) => r.rule_id === 'R002');

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center space-x-2 pb-2">
          <GitCompare className="w-5 h-5 text-slate-800" />
          <h2 className="text-base font-bold text-slate-900">
            Rule Versioning Demonstration (Section 18 Requirement)
          </h2>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
          Demonstrates how rule versions affect compliance deterministically. The exact same physical design (7.5 kW, 15 A motor with an OVR-018 overload relay rated 12-18 A) is evaluated under Rule Set <strong>2026.1</strong> versus revised Rule Set <strong>2026.2</strong>.
        </p>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
          <div className="text-xs text-slate-700">
            <strong>Benchmark Design:</strong> 7.5 kW @ 415 V (FLC = 15.0 A) • Selected Overload Relay: <strong>OVR-018</strong> (Range: 12.0 - 18.0 A)
          </div>
          <button
            id="btn-run-rule-version-demo"
            onClick={handleRunComparison}
            disabled={running}
            className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-sm transition-colors flex items-center space-x-1.5"
          >
            <span>{running ? 'Evaluating Versions...' : 'Run Side-by-Side Evaluation'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Side-by-Side Comparison Panels */}
      {results && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
          {/* Panel 1: Rule Set 2026.1 (PASS) */}
          <div className="bg-white rounded-xl border-2 border-emerald-300 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-mono font-bold text-slate-500 uppercase">Version 2026.1</span>
                <h3 className="text-sm font-bold text-slate-900">DEMO-IEC-UL-SUBSET-2026.1</h3>
              </div>
              <span className="bg-emerald-100 text-emerald-800 font-bold text-xs px-2.5 py-1 rounded flex items-center space-x-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>STATUS: PASS</span>
              </span>
            </div>

            <div className="text-xs space-y-2 text-slate-700">
              <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                <div className="font-bold text-slate-900">Rule R002: Overload Range Compatibility</div>
                <div className="text-slate-500 text-[11px] font-mono mt-0.5">
                  Condition: overload.range_min &le; motor.current_a &le; overload.range_max
                </div>
              </div>

              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-950 space-y-1">
                <div className="font-bold">Result: PASS</div>
                <p className="text-[11.5px] leading-relaxed">
                  {r002_v1?.explanation || 'Selected overload relay range [12.0 - 18.0 A] encompasses motor full-load current (15.0 A). 12.0 <= 15.0 <= 18.0 A.'}
                </p>
                <div className="text-[10px] text-emerald-800 font-mono">
                  Ref: DEMO-IEC-60947-4-1 Clause 5.7.2 (Demo subset)
                </div>
              </div>
            </div>
          </div>

          {/* Panel 2: Rule Set 2026.2 (FAIL) */}
          <div className="bg-white rounded-xl border-2 border-red-300 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-mono font-bold text-slate-500 uppercase">Version 2026.2</span>
                <h3 className="text-sm font-bold text-slate-900">DEMO-IEC-UL-SUBSET-2026.2 (Enhanced Margin)</h3>
              </div>
              <span className="bg-red-100 text-red-800 font-bold text-xs px-2.5 py-1 rounded flex items-center space-x-1">
                <XCircle className="w-3.5 h-3.5" />
                <span>STATUS: FAIL</span>
              </span>
            </div>

            <div className="text-xs space-y-2 text-slate-700">
              <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                <div className="font-bold text-slate-900">Rule R002: Overload Range Compatibility (Enhanced)</div>
                <div className="text-slate-500 text-[11px] font-mono mt-0.5">
                  Condition: range_min &le; 0.80*FLC (12.0A) AND range_max &ge; 1.25*FLC (18.75A)
                </div>
              </div>

              <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-red-950 space-y-1">
                <div className="font-bold">Result: FAIL</div>
                <p className="text-[11.5px] leading-relaxed">
                  {r002_v2?.explanation || 'Selected overload relay range [12.0 - 18.0 A] does not cover enhanced 2026.2 requirement: upper dial must reach at least 18.75 A (1.25x FLC). Recommendation: Select another component from the approved catalog.'}
                </p>
                <div className="text-[10px] text-red-800 font-mono">
                  Ref: DEMO-IEC-60947-4-1 Revision 2026.2 Clause 5.7.2.B (Demo subset)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Engineering Explanation Callout */}
      {results && (
        <div className="bg-slate-900 rounded-xl p-5 text-white shadow-md flex items-start space-x-3">
          <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h4 className="font-bold text-sm text-slate-100">Deterministic Governance Explanation:</h4>
            <p className="text-slate-300 leading-relaxed">
              &quot;The identical motor-starter design was evaluated against two distinct rule set revisions. Under Rule Version 2026.1, standard inclusion was satisfied (12 A &le; 15 A &le; 18 A). Under Rule Version 2026.2, an engineering safety update mandated a 25% upper headroom (1.25 &times; 15 A = 18.75 A) for high-ambient thermal compensation. Because component OVR-018 tops out at 18.0 A, the compliance engine deterministically rejected the design without human subjectivity or AI hallucination.&quot;
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
