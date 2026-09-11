/**
 * Server Storage Layer for Designs, Approvals, Test Runs, and Metrics.
 * Backed by JSON file persistence in data/designs.json and in-memory caches.
 */

import fs from 'fs';
import path from 'path';

export interface SavedDesign {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  status: 'DRAFT' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED' | 'HALTED_MISSING_INFO';
  catalog_version: string;
  rule_version: string;
  raw_brief: string;
  requirements: any;
  calculations: any[];
  components: any[];
  compliance: any;
  layout: any;
  explanation: any;
  approval?: {
    engineer_name: string;
    comments: string;
    timestamp: string;
    approval_status: 'APPROVED' | 'REJECTED';
    digital_signature_hash: string;
  };
}

const STORAGE_FILE = path.join(process.cwd(), 'data', 'designs.json');

function ensureDataFile() {
  const dir = path.dirname(STORAGE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(STORAGE_FILE)) {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify([], null, 2));
  }
}

export function getAllDesigns(): SavedDesign[] {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

export function getDesignById(id: string): SavedDesign | undefined {
  const all = getAllDesigns();
  return all.find(d => d.id === id);
}

export function saveDesign(design: SavedDesign): SavedDesign {
  ensureDataFile();
  const all = getAllDesigns();
  const idx = all.findIndex(d => d.id === design.id);
  if (idx >= 0) {
    all[idx] = { ...design, updated_at: new Date().toISOString() };
  } else {
    all.unshift(design);
  }
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(all, null, 2));
  return design;
}

export function deleteDesign(id: string): boolean {
  ensureDataFile();
  const all = getAllDesigns();
  const filtered = all.filter(d => d.id !== id);
  if (filtered.length !== all.length) {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(filtered, null, 2));
    return true;
  }
  return false;
}
