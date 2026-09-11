import React, { useState, useEffect } from 'react';
import { SavedDesign } from '../types';
import { fetchDesigns, deleteDesignApi } from '../api';
import { exportDesignToPdf } from '../utils/pdfExport';
import { Archive, FileDown, Trash2, CheckCircle, Clock, XCircle, Search } from 'lucide-react';

interface DesignsArchiveProps {
  onSelectDesign?: (design: SavedDesign) => void;
}

export const DesignsArchive: React.FC<DesignsArchiveProps> = ({ onSelectDesign }) => {
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadDesigns();
  }, []);

  const loadDesigns = async () => {
    try {
      const data = await fetchDesigns();
      setDesigns(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Are you sure you want to delete design ${id}?`)) return;
    try {
      await deleteDesignApi(id);
      loadDesigns();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = designs.filter((d) => {
    const matchesStatus = filterStatus === 'ALL' || d.status === filterStatus;
    const matchesSearch =
      d.id.toLowerCase().includes(search.toLowerCase()) ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.raw_brief.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Archive className="w-5 h-5 text-slate-800" />
            <h2 className="text-base font-bold text-slate-900">Designs & Approvals Archive Ledger</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit history of generated motor-starter panels, compliance reviews, and engineer signatures.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Search designs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-slate-900"
          />

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="AWAITING_APPROVAL">Awaiting Approval</option>
            <option value="CHANGES_REQUESTED">Changes Requested</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Designs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((d) => {
          const isApproved = d.status === 'APPROVED';
          const isAwaiting = d.status === 'AWAITING_APPROVAL';
          const isRejected = d.status === 'REJECTED';

          return (
            <div
              key={d.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-xs font-bold text-slate-500">{d.id}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center space-x-1 ${
                      isApproved
                        ? 'bg-emerald-100 text-emerald-800'
                        : isAwaiting
                        ? 'bg-blue-100 text-blue-800'
                        : isRejected
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {isApproved ? (
                      <CheckCircle className="w-3 h-3 text-emerald-700" />
                    ) : isAwaiting ? (
                      <Clock className="w-3 h-3 text-blue-700" />
                    ) : (
                      <XCircle className="w-3 h-3 text-red-700" />
                    )}
                    <span>{d.status.replace('_', ' ')}</span>
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900">{d.title}</h3>
                <p className="text-xs text-slate-500 italic mt-1 line-clamp-2">&quot;{d.raw_brief}&quot;</p>

                {/* Technical Specs Tags */}
                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Current:</span>
                    <span className="font-bold text-slate-900">{d.requirements?.motor_current_a || '-'} A</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Voltage:</span>
                    <span className="font-bold text-slate-900">{d.requirements?.voltage_v || 415} V</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Topology:</span>
                    <span className="font-bold text-slate-900">{d.requirements?.starter_type || 'DOL'}</span>
                  </div>
                </div>

                {/* Approval details if signed */}
                {d.approval && (
                  <div className="mt-3 p-2 bg-slate-50 rounded text-[11px] text-slate-700 border border-slate-200">
                    <div>
                      <strong>Signed by:</strong> {d.approval.engineer_name}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {new Date(d.approval.timestamp).toLocaleString()}
                    </div>
                    {d.approval.digital_signature_hash && (
                      <div className="font-mono text-[9px] text-slate-400 truncate mt-0.5">
                        Hash: {d.approval.digital_signature_hash}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400">
                  Cat v{d.catalog_version} • Rules v{d.rule_version}
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => exportDesignToPdf(d)}
                    className="inline-flex items-center space-x-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded transition-colors"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>

                  <button
                    onClick={() => handleDelete(d.id)}
                    className="text-slate-400 hover:text-red-600 p-1.5 rounded transition-colors"
                    title="Delete Design"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center p-12 bg-white rounded-xl border border-slate-200 text-slate-500 text-xs">
          No saved designs match the selected criteria.
        </div>
      )}
    </div>
  );
};
