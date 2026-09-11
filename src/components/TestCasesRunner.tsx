import React, { useState, useEffect } from 'react';
import { TestCase, TestRunResult } from '../types';
import { fetchTestCases, runTestCases } from '../api';
import { FlaskConical, Play, CheckCircle, XCircle, RefreshCw, AlertCircle } from 'lucide-react';

export const TestCasesRunner: React.FC = () => {
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [results, setResults] = useState<Record<string, TestRunResult>>({});
  const [runningAll, setRunningAll] = useState(false);
  const [runningSingle, setRunningSingle] = useState<string | null>(null);

  useEffect(() => {
    loadTestCases();
  }, []);

  const loadTestCases = async () => {
    try {
      const cases = await fetchTestCases();
      setTestCases(cases);
    } catch (err) {
      console.error('Failed to load test cases', err);
    }
  };

  const handleRunAll = async () => {
    setRunningAll(true);
    try {
      const res = await runTestCases();
      const resultMap: Record<string, TestRunResult> = {};
      res.results.forEach((r) => {
        resultMap[r.test_id] = r;
      });
      setResults(resultMap);
    } catch (err) {
      console.error(err);
    } finally {
      setRunningAll(false);
    }
  };

  const handleRunSingle = async (testId: string) => {
    setRunningSingle(testId);
    try {
      const res = await runTestCases(testId);
      if (res.results.length > 0) {
        setResults((prev) => ({ ...prev, [testId]: res.results[0] }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRunningSingle(null);
    }
  };

  const totalPassed = (Object.values(results) as TestRunResult[]).filter((r) => r.matched_expected).length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <FlaskConical className="w-5 h-5 text-slate-800" />
            <h2 className="text-base font-bold text-slate-900">
              Predefined Engineering Test Suite (Section 19)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated boundary tests verifying failure handling, missing info halts, and non-hallucination guarantees.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {Object.keys(results).length > 0 && (
            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
              {totalPassed} / {Object.keys(results).length} Tests Passed Expected
            </span>
          )}
          <button
            id="btn-run-all-predefined-tests"
            onClick={handleRunAll}
            disabled={runningAll}
            className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-sm transition-colors flex items-center space-x-1.5"
          >
            {runningAll ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Executing Test Suite...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Run All 8 Tests</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Test Cases Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {testCases.map((tc) => {
          const runRes = results[tc.id];
          const isRunning = runningSingle === tc.id;
          return (
            <div
              key={tc.id}
              className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-xs font-bold text-slate-500">{tc.id}</span>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      Expect: {tc.expected_result}
                    </span>
                    {runRes && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center space-x-1 ${
                          runRes.matched_expected
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {runRes.matched_expected ? (
                          <CheckCircle className="w-3 h-3 text-emerald-700" />
                        ) : (
                          <XCircle className="w-3 h-3 text-red-700" />
                        )}
                        <span>{runRes.actual}</span>
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="text-sm font-bold text-slate-900">{tc.name}</h3>
                <p className="text-xs text-slate-600 mt-1">{tc.description}</p>

                <div className="mt-2.5 p-2 bg-slate-50 rounded border border-slate-100 text-[11px] font-mono text-slate-700 line-clamp-2">
                  &quot;{tc.brief}&quot;
                </div>
              </div>

              {runRes && (
                <div
                  className={`p-2.5 rounded text-xs leading-relaxed ${
                    runRes.matched_expected
                      ? 'bg-emerald-50 text-emerald-950 border border-emerald-200'
                      : 'bg-red-50 text-red-950 border border-red-200'
                  }`}
                >
                  <strong className="block text-[11px] font-semibold mb-0.5">Execution Log:</strong>
                  {runRes.details}
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px]">{tc.notes}</span>
                <button
                  onClick={() => handleRunSingle(tc.id)}
                  disabled={isRunning || runningAll}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-2.5 py-1 rounded text-[11px] transition-colors"
                >
                  {isRunning ? 'Running...' : 'Run Test'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
