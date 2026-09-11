import React, { useState, useEffect } from 'react';
import { TraceabilityGraph, TraceabilityNode, SavedDesign } from '../types';
import { fetchDesigns, fetchTraceability } from '../api';
import { GitCommit, ArrowRight, ShieldCheck, CheckCircle, Database, Calculator, FileText, Check } from 'lucide-react';

export const TraceabilityView: React.FC = () => {
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [selectedDesignId, setSelectedDesignId] = useState<string>('');
  const [graph, setGraph] = useState<TraceabilityGraph | null>(null);
  const [selectedNode, setSelectedNode] = useState<TraceabilityNode | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDesigns();
  }, []);

  const loadDesigns = async () => {
    try {
      const data = await fetchDesigns();
      setDesigns(data);
      if (data.length > 0) {
        setSelectedDesignId(data[0].id);
        loadGraph(data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadGraph = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetchTraceability(id);
      setGraph(res);
      if (res.nodes && res.nodes.length > 0) {
        setSelectedNode(res.nodes[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDesign = (id: string) => {
    setSelectedDesignId(id);
    loadGraph(id);
  };

  // Group nodes by pipeline step
  const getStepColor = (type: string) => {
    switch (type) {
      case 'USER_BRIEF':
        return 'bg-blue-50 border-blue-200 text-blue-900';
      case 'EXTRACTED_REQUIREMENT':
        return 'bg-indigo-50 border-indigo-200 text-indigo-900';
      case 'CALCULATION':
        return 'bg-amber-50 border-amber-200 text-amber-900';
      case 'CATALOG_COMPONENT':
        return 'bg-slate-100 border-slate-300 text-slate-900';
      case 'RULE_CHECK':
        return 'bg-emerald-50 border-emerald-200 text-emerald-900';
      case 'DESIGN_DECISION':
        return 'bg-purple-50 border-purple-200 text-purple-900';
      case 'ENGINEER_APPROVAL':
        return 'bg-emerald-100 border-emerald-300 text-emerald-950';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Design Selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <GitCommit className="w-5 h-5 text-slate-800" />
            <h2 className="text-base font-bold text-slate-900">
              End-to-End Engineering Traceability & Audit Graph
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict audit chain: Brief → Structured Req → Sizing Calc → Catalog BOM → Compliance Rules → Decision → PE Approval
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">
            Select Design:
          </label>
          <select
            value={selectedDesignId}
            onChange={(e) => handleSelectDesign(e.target.value)}
            className="text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-medium text-slate-800 focus:ring-1 focus:ring-slate-900"
          >
            {designs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.id} — {d.title} ({d.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Loading audit trail...</div>
      ) : graph ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Audit Node Chain List */}
          <div className="lg:col-span-2 space-y-3 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Traceability Graph Nodes (Click to inspect parameters)
            </div>

            <div className="space-y-2">
              {graph.nodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all ${getStepColor(
                      node.type
                    )} ${isSelected ? 'ring-2 ring-slate-900 shadow-xs' : 'hover:border-slate-400'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-mono font-bold tracking-wider uppercase opacity-75">
                        {node.type.replace('_', ' ')}
                      </span>
                      {node.status && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            node.status === 'PASS' || node.status === 'APPROVED'
                              ? 'bg-emerald-200 text-emerald-950'
                              : 'bg-amber-200 text-amber-950'
                          }`}
                        >
                          {node.status}
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-sm mt-1">{node.label}</div>
                    <div className="text-xs mt-0.5 opacity-90">{node.description}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Node Inspector Panel */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 text-white shadow-md">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Node Parameter Inspector
            </div>

            {selectedNode ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[11px] font-mono text-sky-400 font-bold block">
                    {selectedNode.type}
                  </span>
                  <h3 className="text-base font-bold text-white mt-0.5">{selectedNode.label}</h3>
                  <p className="text-xs text-slate-300 mt-1">{selectedNode.description}</p>
                </div>

                <div className="border-t border-slate-800 pt-3">
                  <div className="text-xs font-bold text-slate-400 mb-2">Payload Data (JSON):</div>
                  <pre className="bg-slate-950 p-3 rounded-lg text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-96 border border-slate-800">
                    {JSON.stringify(selectedNode.data, null, 2)}
                  </pre>
                </div>

                <div className="text-[10.5px] text-slate-400 border-t border-slate-800 pt-3">
                  Governing Version: Catalog v{graph.catalog_version} • Rules v{graph.rule_version}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500">Select any node on the left to inspect.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
