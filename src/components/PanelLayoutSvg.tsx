import React, { useState } from 'react';
import { PanelLayoutData } from '../types';
import { Info, Layers } from 'lucide-react';

interface PanelLayoutSvgProps {
  layout: PanelLayoutData;
  spaceUtilizationPct?: number;
}

export const PanelLayoutSvg: React.FC<PanelLayoutSvgProps> = ({ layout, spaceUtilizationPct = 38.5 }) => {
  const [hoveredComp, setHoveredComp] = useState<any>(null);

  const encWidth = layout.enclosure_dimensions?.width_mm || 400;
  const encHeight = layout.enclosure_dimensions?.height_mm || 500;

  return (
    <div className="bg-slate-900 rounded-xl p-4 sm:p-6 text-white border border-slate-800 shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 mb-4 gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold tracking-wide uppercase text-slate-200">
              2D Enclosure Backplate & Door Layout
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Dimensions: {encWidth}mm (W) x {encHeight}mm (H) x 200mm (D) • Standard Two-Rail Configuration
          </p>
        </div>

        {/* Packing Density Indicator */}
        <div className="flex items-center space-x-3 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
          <div className="text-xs">
            <span className="text-slate-400">Backplate Density: </span>
            <span className={`font-bold ${spaceUtilizationPct <= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {spaceUtilizationPct}%
            </span>
            <span className="text-slate-500 text-[10px]"> (Max 70%)</span>
          </div>
          <div className="w-16 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${spaceUtilizationPct <= 70 ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ width: `${Math.min(spaceUtilizationPct, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative flex justify-center items-center bg-slate-950/60 rounded-lg p-2 sm:p-4 border border-slate-800 overflow-x-auto">
        <svg
          viewBox={`0 0 ${encWidth} ${encHeight}`}
          className="w-full max-w-[480px] h-auto select-none"
          style={{ maxHeight: '520px' }}
        >
          <defs>
            {/* Duct slot pattern */}
            <pattern id="duct-slots" width="8" height="25" patternUnits="userSpaceOnUse">
              <rect x="2" y="2" width="4" height="21" fill="#1e293b" rx="1" />
            </pattern>
            {/* Metal backplate gradient */}
            <linearGradient id="backplate-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            {/* DIN Rail metal shine */}
            <linearGradient id="din-rail-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="50%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#64748b" />
            </linearGradient>
          </defs>

          {/* Outer Enclosure Frame */}
          <rect
            x="4"
            y="4"
            width={encWidth - 8}
            height={encHeight - 8}
            fill="url(#backplate-grad)"
            stroke="#475569"
            strokeWidth="3"
            rx="6"
          />

          {/* Usable Backplate Margin */}
          <rect
            x="20"
            y="20"
            width={encWidth - 40}
            height={encHeight - 40}
            fill="none"
            stroke="#334155"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {/* Wireway Trunking Ducts */}
          {layout.wireways?.map((duct) => (
            <g key={duct.id}>
              <rect
                x={duct.x}
                y={duct.y}
                width={duct.width}
                height={duct.height}
                fill="#334155"
                stroke="#475569"
                strokeWidth="1"
                rx="2"
              />
              <rect
                x={duct.x}
                y={duct.y}
                width={duct.width}
                height={duct.height}
                fill="url(#duct-slots)"
              />
              <text
                x={duct.x + 10}
                y={duct.y + 16}
                fill="#94a3b8"
                fontSize="9"
                fontFamily="monospace"
              >
                CABLE TRUNKING ({duct.id})
              </text>
            </g>
          ))}

          {/* DIN Rails */}
          {layout.din_rails?.map((rail) => (
            <g key={rail.id}>
              <rect
                x={rail.x}
                y={rail.y}
                width={rail.width}
                height={rail.height}
                fill="url(#din-rail-grad)"
                stroke="#475569"
                strokeWidth="1"
                rx="1"
              />
              {/* Rail mounting screw holes */}
              {[rail.x + 15, rail.x + 100, rail.x + 200, rail.x + 300].map((hx, idx) => (
                <circle key={idx} cx={hx} cy={rail.y + 5} r="2" fill="#334155" />
              ))}
            </g>
          ))}

          {/* Placed Components on Rails */}
          {layout.components_placed?.map((comp) => {
            const isHovered = hoveredComp?.id === comp.id;
            return (
              <g
                key={comp.id}
                onMouseEnter={() => setHoveredComp(comp)}
                onMouseLeave={() => setHoveredComp(null)}
                className="cursor-pointer transition-transform"
              >
                {/* Component Body */}
                <rect
                  x={comp.x}
                  y={comp.y}
                  width={comp.width}
                  height={comp.height}
                  fill={comp.color}
                  stroke={isHovered ? '#38bdf8' : comp.accent}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  rx="3"
                />

                {/* Accent Top Strip */}
                <rect
                  x={comp.x}
                  y={comp.y}
                  width={comp.width}
                  height="6"
                  fill={comp.accent}
                  rx="2"
                />

                {/* Component Label */}
                <text
                  x={comp.x + comp.width / 2}
                  y={comp.y + 20}
                  textAnchor="middle"
                  fill="#f8fafc"
                  fontSize="8.5"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  {comp.id}
                </text>

                <text
                  x={comp.x + comp.width / 2}
                  y={comp.y + 32}
                  textAnchor="middle"
                  fill="#cbd5e1"
                  fontSize="7.5"
                  fontFamily="sans-serif"
                >
                  {comp.name.split(' ')[0]}
                </text>

                <text
                  x={comp.x + comp.width / 2}
                  y={comp.y + 44}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="6.5"
                  fontFamily="monospace"
                >
                  {comp.model}
                </text>

                {/* Terminal dots */}
                <circle cx={comp.x + 8} cy={comp.y + comp.height - 8} r="2.5" fill="#f59e0b" />
                <circle cx={comp.x + comp.width - 8} cy={comp.y + comp.height - 8} r="2.5" fill="#f59e0b" />
              </g>
            );
          })}

          {/* Door Line Divider */}
          <line
            x1="20"
            y1="415"
            x2={encWidth - 20}
            y2="415"
            stroke="#334155"
            strokeWidth="1.5"
            strokeDasharray="6 3"
          />
          <text
            x="30"
            y="412"
            fill="#64748b"
            fontSize="8"
            fontFamily="monospace"
            letterSpacing="1"
          >
            ENCLOSURE DOOR PANEL DEVICES
          </text>

          {/* Door Mounted Controls (Push Buttons & Indicator Lamps) */}
          {layout.door_mounted_devices?.map((dev) => (
            <g key={dev.id} className="cursor-pointer">
              {/* Outer bezel */}
              <circle
                cx={dev.x}
                cy={dev.y}
                r={dev.r + 3}
                fill="#1e293b"
                stroke="#64748b"
                strokeWidth="1.5"
              />
              {/* Actuator / Lens */}
              <circle
                cx={dev.x}
                cy={dev.y}
                r={dev.r}
                fill={dev.color}
                stroke="#f8fafc"
                strokeWidth="1"
              />
              {/* Label */}
              <text
                x={dev.x}
                y={dev.y + dev.r + 14}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize="7.5"
                fontWeight="bold"
                fontFamily="sans-serif"
              >
                {dev.label}
              </text>
            </g>
          ))}
        </svg>

        {/* Hover Information Tooltip Overlay */}
        {hoveredComp && (
          <div className="absolute top-4 right-4 bg-slate-900/95 border border-slate-700 p-3 rounded-lg shadow-xl text-xs max-w-[220px] pointer-events-none backdrop-blur-sm z-20">
            <div className="font-bold text-sky-400">{hoveredComp.name}</div>
            <div className="text-slate-300 font-mono text-[11px] mt-0.5">{hoveredComp.id}</div>
            <div className="text-slate-400 text-[11px]">Model: {hoveredComp.model}</div>
            <div className="text-slate-400 text-[10px] mt-1">
              Position: X={hoveredComp.x}mm, Y={hoveredComp.y}mm
            </div>
            <div className="text-slate-400 text-[10px]">
              Footprint: {hoveredComp.width}mm x {hoveredComp.height}mm
            </div>
          </div>
        )}
      </div>

      {/* Engineering Clearance & Layout Disclaimer */}
      <div className="mt-3 flex items-start space-x-2 text-[11px] text-slate-400 bg-slate-850 p-2.5 rounded-lg border border-slate-800">
        <Info className="w-3.5 h-3.5 text-sky-400 flex-shrink-0 mt-0.5" />
        <div>
          <span>{layout.disclaimer}</span>
          <span className="block text-slate-500 text-[10px] mt-0.5">
            Clearances conform to DEMO-IEC-61439-1 Annex D for 415 V industrial installations.
          </span>
        </div>
      </div>
    </div>
  );
};
