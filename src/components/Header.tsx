import React from 'react';
import { ShieldAlert, Cpu, CheckCircle, Database, GitCommit, FileText, FlaskConical, BarChart3, Archive } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  catalogVersion: string;
  setCatalogVersion: (v: string) => void;
  ruleVersion: string;
  setRuleVersion: (v: string) => void;
  isDemoMode: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  catalogVersion,
  setCatalogVersion,
  ruleVersion,
  setRuleVersion,
  isDemoMode
}) => {
  const tabs = [
    { id: 'studio', label: 'Design Studio', icon: Cpu },
    { id: 'traceability', label: 'Traceability Graph', icon: GitCommit },
    { id: 'rule-demo', label: 'Rule Versioning Demo', icon: FileText },
    { id: 'test-cases', label: 'Test Suite (8 Cases)', icon: FlaskConical },
    { id: 'catalog-rules', label: 'Catalog & Rules', icon: Database },
    { id: 'archive', label: 'Designs Archive', icon: Archive },
    { id: 'metrics', label: 'Evaluation Metrics', icon: BarChart3 }
  ];

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-40">
      {/* Statutory Safety Warning Banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 flex items-center justify-between text-xs text-amber-900">
        <div className="flex items-center space-x-2 font-medium">
          <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>
            <strong>SAFETY DIRECTIVE:</strong> Engineering assistance system only. All component selections, sizing calculations, and compliance checks are deterministic. Does not replace qualified engineering review.
          </span>
        </div>
        <div className="flex items-center space-x-3">
          {isDemoMode && (
            <span className="bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide">
              Demo Mode Active (Deterministic Parser)
            </span>
          )}
          <span className="text-amber-800 text-[11px] hidden sm:inline">DEMO-IEC-UL-SUBSET</span>
        </div>
      </div>

      {/* Main App Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-wider shadow-sm">
              LV
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                Low-Voltage Motor-Starter Panel Design
              </h1>
              <p className="text-xs text-slate-500">
                Generative Engineering Assistant • DOL Starter Panel Subsystem
              </p>
            </div>
          </div>

          {/* Catalog and Rule Version Selectors */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-xs bg-slate-50 border border-slate-200 rounded-lg p-1.5">
              <span className="text-slate-500 font-medium pl-1">Catalog:</span>
              <select
                id="header-catalog-version-select"
                value={catalogVersion}
                onChange={(e) => setCatalogVersion(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="2026.1">v2026.1 (Standard)</option>
                <option value="2026.2">v2026.2 (Heavy-Duty)</option>
              </select>
            </div>

            <div className="flex items-center space-x-2 text-xs bg-slate-50 border border-slate-200 rounded-lg p-1.5">
              <span className="text-slate-500 font-medium pl-1">Rules:</span>
              <select
                id="header-rules-version-select"
                value={ruleVersion}
                onChange={(e) => setRuleVersion(e.target.value)}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="2026.1">v2026.1 (Standard Subset)</option>
                <option value="2026.2">v2026.2 (Enhanced Margin)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 sm:space-x-4 overflow-x-auto no-scrollbar border-t border-slate-100 pt-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`nav-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2.5 px-3 border-b-2 font-medium text-xs whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-slate-900 text-slate-900 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-900' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
