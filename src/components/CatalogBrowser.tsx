import React, { useState, useEffect } from 'react';
import { CatalogComponent, RuleDefinition } from '../types';
import { fetchCatalog, fetchRules } from '../api';
import { Database, ShieldCheck, Search, Filter } from 'lucide-react';

interface CatalogBrowserProps {
  catalogVersion: string;
  ruleVersion: string;
}

export const CatalogBrowser: React.FC<CatalogBrowserProps> = ({
  catalogVersion,
  ruleVersion
}) => {
  const [activeTab, setActiveTab] = useState<'CATALOG' | 'RULES'>('CATALOG');
  const [components, setComponents] = useState<CatalogComponent[]>([]);
  const [rules, setRules] = useState<RuleDefinition[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  useEffect(() => {
    loadData();
  }, [catalogVersion, ruleVersion]);

  const loadData = async () => {
    try {
      const catRes = await fetchCatalog(catalogVersion);
      setComponents(catRes.components || []);

      const ruleRes = await fetchRules(ruleVersion);
      setRules(ruleRes.rules || []);
    } catch (err) {
      console.error(err);
    }
  };

  const types = ['ALL', ...Array.from(new Set(components.map((c) => c.component_type)))];

  const filteredComponents = components.filter((c) => {
    const matchesSearch =
      c.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.component_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.manufacturer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'ALL' || c.component_type === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('CATALOG')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              activeTab === 'CATALOG'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Approved Component Catalog (v{catalogVersion})</span>
          </button>

          <button
            onClick={() => setActiveTab('RULES')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              activeTab === 'RULES'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Engineering Ruleset (v{ruleVersion})</span>
          </button>
        </div>

        {activeTab === 'CATALOG' && (
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search models..."
                className="w-full text-xs pl-8 pr-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium text-slate-700"
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Catalog Table */}
      {activeTab === 'CATALOG' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="text-xs text-slate-500 mb-3 flex items-center justify-between">
            <span>Showing {filteredComponents.length} components in approved catalog</span>
            <span className="text-[11px] text-slate-400 font-mono">Catalog Version: {catalogVersion}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Component ID</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Manufacturer & Model</th>
                  <th className="py-2.5 px-3">Voltage Rating</th>
                  <th className="py-2.5 px-3">Current / Range</th>
                  <th className="py-2.5 px-3">Coil V</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Footprint (mm)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredComponents.map((c) => (
                  <tr key={c.component_id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{c.component_id}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">{c.component_type}</td>
                    <td className="py-2.5 px-3 text-slate-700">
                      {c.manufacturer} <span className="font-mono font-medium">{c.model}</span>
                    </td>
                    <td className="py-2.5 px-3">{c.rated_voltage} V</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {c.rated_current
                        ? `${c.rated_current} A`
                        : c.overload_range_min
                        ? `${c.overload_range_min} - ${c.overload_range_max} A`
                        : '-'}
                    </td>
                    <td className="py-2.5 px-3">{c.coil_voltage ? `${c.coil_voltage} V` : '-'}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          c.active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {c.active ? 'Active' : 'Discontinued'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                      {c.dimensions?.width_mm}x{c.dimensions?.height_mm}x{c.dimensions?.depth_mm}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rules Table */}
      {activeTab === 'RULES' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="text-xs text-slate-500 flex items-center justify-between">
            <span>{rules.length} Active Compliance Rules in DEMO-IEC-UL-SUBSET-{ruleVersion}</span>
            <span className="text-[11px] text-slate-400 font-mono">Rule Set: {ruleVersion}</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {rules.map((r) => (
              <div
                key={r.rule_id}
                className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-slate-900 text-sm">[{r.rule_id}]</span>
                    <span className="font-bold text-slate-900">{r.title}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="bg-slate-200 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded">
                      {r.category}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        r.severity === 'ERROR'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {r.severity}
                    </span>
                  </div>
                </div>

                <p className="text-slate-600 text-xs leading-relaxed">{r.description}</p>

                <div className="bg-white p-2 rounded border border-slate-200 font-mono text-[11px] text-slate-800">
                  Condition: {r.condition}
                </div>

                <div className="text-slate-400 text-[10.5px] font-mono">
                  Source Reference: {r.source_reference} (Revision v{r.version})
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
