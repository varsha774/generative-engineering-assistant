/**
 * Main Application Component for
 * Generative Engineering Assistant for Low-Voltage Motor-Starter Panel Design.
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { DesignStudio } from './components/DesignStudio';
import { TraceabilityView } from './components/TraceabilityView';
import { RuleUpdateDemo } from './components/RuleUpdateDemo';
import { TestCasesRunner } from './components/TestCasesRunner';
import { CatalogBrowser } from './components/CatalogBrowser';
import { DesignsArchive } from './components/DesignsArchive';
import { EvaluationDashboard } from './components/EvaluationDashboard';
import { fetchSystemStatus } from './api';
import { ShieldCheck, Info } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('studio');
  const [catalogVersion, setCatalogVersion] = useState('2026.1');
  const [ruleVersion, setRuleVersion] = useState('2026.1');
  const [isDemoMode, setIsDemoMode] = useState(true);

  useEffect(() => {
    fetchSystemStatus()
      .then((status) => {
        setIsDemoMode(status.is_demo_mode);
        if (status.active_catalog_version) setCatalogVersion(status.active_catalog_version);
        if (status.active_rule_version) setRuleVersion(status.active_rule_version);
      })
      .catch((err) => {
        console.warn('Backend status check:', err);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased">
      {/* Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        catalogVersion={catalogVersion}
        setCatalogVersion={setCatalogVersion}
        ruleVersion={ruleVersion}
        setRuleVersion={setRuleVersion}
        isDemoMode={isDemoMode}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'studio' && (
          <DesignStudio
            catalogVersion={catalogVersion}
            ruleVersion={ruleVersion}
            isDemoMode={isDemoMode}
          />
        )}

        {activeTab === 'traceability' && <TraceabilityView />}

        {activeTab === 'rule-demo' && <RuleUpdateDemo />}

        {activeTab === 'test-cases' && <TestCasesRunner />}

        {activeTab === 'catalog-rules' && (
          <CatalogBrowser catalogVersion={catalogVersion} ruleVersion={ruleVersion} />
        )}

        {activeTab === 'archive' && <DesignsArchive />}

        {activeTab === 'metrics' && <EvaluationDashboard />}
      </main>

      {/* Global Engineering Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            <span>
              LV Motor-Starter Panel Engineering Assistant • Version 2026.1 (Build 1.0.4-prod)
            </span>
          </div>
          <div className="text-center sm:text-right text-[11px] text-slate-400">
            Governing Standards: DEMO-IEC-60947-4-1 • DEMO-IEC-60204-1 • DEMO-IEC-61439-1 Annex D
          </div>
        </div>
      </footer>
    </div>
  );
}
