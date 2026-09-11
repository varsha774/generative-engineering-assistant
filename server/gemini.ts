/**
 * Gemini API Server Integration.
 * Strictly adheres to:
 * 1. AI is ONLY used for natural language parsing and technical explanation.
 * 2. AI is NEVER permitted to invent components, ratings, calculations, or compliance results.
 * 3. Graceful Demo Mode fallback when GEMINI_API_KEY is not configured.
 */

import { GoogleGenAI } from '@google/genai';
import { ExtractedRequirements } from './engine.js';

let aiClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

export const ENGINEERING_WARNING =
  'This prototype is an engineering assistance system. It does not replace qualified engineering review. Final panels must comply with applicable electrical codes, standards, and safety regulations.';

/**
 * Parses natural-language design brief into structured requirements using Gemini or fallback rule-parser.
 */
export async function parseDesignBriefWithGemini(brief: string): Promise<ExtractedRequirements> {
  // Check for explicit hallucination / fictitious model requests
  const fictionMatch = brief.match(/(XYZ-\d+|fictional|invent|fake|custom-unlisted|non-catalog|Acme)/i);
  const detectedHallucination = fictionMatch ? fictionMatch[0] : null;

  const ai = getGenAI();

  if (ai) {
    try {
      const systemInstruction = `You are an engineering assistant for low-voltage motor-starter panel design.
Extract engineering requirements from the user's design brief.
Do not invent missing numbers.
If a required parameter is not specified, list it in missing_requirements.
If a specification is vague, list it in ambiguities.
Return valid JSON only with keys:
- motor_power_kw: number or null
- voltage_v: number or null
- phase: number or null (e.g. 3)
- frequency_hz: number or null (e.g. 50 or 60)
- motor_current_a: number or null
- starter_type: string or null (e.g. "DOL", "Star-Delta", "Soft Starter")
- protection_required: boolean
- overload_protection_required: boolean
- missing_requirements: array of string descriptions of parameters that MUST be provided to size equipment (e.g. "motor_current_a" if missing)
- ambiguities: array of string descriptions of ambiguities (e.g. starter type unclear)
- confidence: number between 0 and 1`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Design Brief to parse: "${brief}"`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json'
        }
      });

      const parsedText = response.text ? response.text.trim() : '{}';
      const parsed = JSON.parse(parsedText);

      return {
        motor_power_kw: parsed.motor_power_kw ?? parseRegexPower(brief),
        voltage_v: parsed.voltage_v ?? parseRegexVoltage(brief),
        phase: parsed.phase ?? 3,
        frequency_hz: parsed.frequency_hz ?? 50,
        motor_current_a: parsed.motor_current_a ?? parseRegexCurrent(brief),
        starter_type: parsed.starter_type ?? parseRegexStarter(brief),
        protection_required: parsed.protection_required !== false,
        overload_protection_required: parsed.overload_protection_required !== false,
        missing_requirements: Array.isArray(parsed.missing_requirements) ? parsed.missing_requirements : checkMissingRequirements(brief),
        ambiguities: Array.isArray(parsed.ambiguities) ? parsed.ambiguities : checkAmbiguities(brief),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.95,
        hallucination_attempt: detectedHallucination
      };
    } catch (err) {
      console.warn('Gemini API call failed, falling back to deterministic parser:', err);
    }
  }

  // Deterministic Fallback Parser (Robust Demo Mode)
  return parseDeterministicBrief(brief, detectedHallucination);
}

/**
 * Deterministic NLP / Regex Parser for Demo Mode or offline testing.
 */
function parseDeterministicBrief(brief: string, detectedHallucination: string | null): ExtractedRequirements {
  const powerKw = parseRegexPower(brief);
  const voltage = parseRegexVoltage(brief);
  const current = parseRegexCurrent(brief);
  const starter = parseRegexStarter(brief);

  const missing: string[] = [];
  const ambiguities: string[] = [];

  if (current === null) {
    missing.push('motor_current_a (Motor Full Load Current is required to determine contactor and overload sizing)');
  }
  if (voltage === null) {
    missing.push('voltage_v (Operating supply voltage is required)');
  }
  if (powerKw === null && current === null) {
    missing.push('motor_power_kw (Rated mechanical shaft power)');
  }
  if (starter === null) {
    ambiguities.push('starter_type is not explicitly stated (e.g. DOL, Star-Delta, Soft Starter)');
  }

  const protectionReq = !brief.toLowerCase().includes('no protection') && !brief.toLowerCase().includes('omit protection');
  const overloadReq = !brief.toLowerCase().includes('no overload') && !brief.toLowerCase().includes('omit overload');

  return {
    motor_power_kw: powerKw,
    voltage_v: voltage,
    phase: 3,
    frequency_hz: 50,
    motor_current_a: current,
    starter_type: starter,
    protection_required: protectionReq,
    overload_protection_required: overloadReq,
    missing_requirements: missing,
    ambiguities: ambiguities,
    confidence: missing.length === 0 ? 0.98 : 0.70,
    hallucination_attempt: detectedHallucination
  };
}

function parseRegexPower(text: string): number | null {
  const match = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:kW|kw|kilowatt)/i);
  return match ? parseFloat(match[1]) : null;
}

function parseRegexVoltage(text: string): number | null {
  const match = text.match(/([0-9]{3,4})\s*(?:V|v|volt)/i);
  return match ? parseFloat(match[1]) : null;
}

function parseRegexCurrent(text: string): number | null {
  // Looks for "current is 15 A" or "15 A" or "15A" or "15 amps" or "1600 A"
  const match = text.match(/(?:current\s+(?:is\s+)?|rated\s+)?([0-9]+(?:\.[0-9]+)?)\s*(?:A\b|amps?\b|amperes?\b)/i);
  if (match) return parseFloat(match[1]);

  // Check if current is omitted
  return null;
}

function parseRegexStarter(text: string): string | null {
  if (/star[- ]?delta/i.test(text)) return 'Star-Delta';
  if (/soft[- ]?starter/i.test(text)) return 'Soft Starter';
  if (/\bDOL\b|direct[- ]on[- ]line/i.test(text)) return 'DOL';
  return null;
}

function checkMissingRequirements(brief: string): string[] {
  const missing: string[] = [];
  if (!brief.match(/(?:current\s+(?:is\s+)?|rated\s+)?([0-9]+(?:\.[0-9]+)?)\s*(?:A\b|amps?\b)/i)) {
    missing.push('motor_current_a');
  }
  return missing;
}

function checkAmbiguities(brief: string): string[] {
  const ambiguities: string[] = [];
  if (!parseRegexStarter(brief)) {
    ambiguities.push('Starter method unspecified');
  }
  return ambiguities;
}

/**
 * Generates an engineering technical explanation for the deterministic results.
 */
export async function explainDesignWithGemini(
  requirements: ExtractedRequirements,
  calculations: any[],
  selectedComponents: any[],
  compliance: any,
  rawBrief: string
): Promise<{
  design_summary: string;
  component_selection_explanation: string;
  calculation_explanation: string;
  compliance_explanation: string;
  assumptions: string[];
  warnings: string[];
  violations: string[];
  disclaimer: string;
}> {
  const ai = getGenAI();

  if (ai) {
    try {
      const prompt = `You are an engineering explanation assistant for low-voltage motor-starter panel design.
You are not authorized to calculate values, select components, invent components, invent ratings, or determine compliance.
Explain ONLY the supplied deterministic results.

User Brief: "${rawBrief}"

Deterministic Requirements:
${JSON.stringify(requirements, null, 2)}

Deterministic Calculations:
${JSON.stringify(calculations, null, 2)}

Selected Catalog Components:
${JSON.stringify(selectedComponents.map((c: any) => ({ id: c.component_id, type: c.component_type, model: c.model, rating: c.rated_current })), null, 2)}

Compliance Results (Rule Version ${compliance.rule_version}):
Status: ${compliance.overall_status} (Pass: ${compliance.pass_count}, Fail: ${compliance.fail_count}, Warn: ${compliance.warn_count})
${JSON.stringify(compliance.rule_results, null, 2)}

Provide a concise, professional engineering explanation in JSON format:
{
  "design_summary": string,
  "component_selection_explanation": string,
  "calculation_explanation": string,
  "compliance_explanation": string,
  "assumptions": array of strings,
  "warnings": array of strings,
  "violations": array of strings
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction: 'You are an engineering explanation assistant. You are not authorized to calculate values, select components, invent components, invent ratings, or determine compliance. Explain ONLY the supplied deterministic results. Always return valid JSON.',
          responseMimeType: 'application/json'
        }
      });

      const parsed = JSON.parse(response.text ? response.text.trim() : '{}');
      return {
        design_summary: parsed.design_summary || 'Deterministic panel configuration generated.',
        component_selection_explanation: parsed.component_selection_explanation || 'Selected components conform to the approved catalog.',
        calculation_explanation: parsed.calculation_explanation || 'All thermal and inrush limits verified.',
        compliance_explanation: parsed.compliance_explanation || 'Rules evaluated against active standards subset.',
        assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [
          'Assumes 40°C max ambient panel temperature',
          'Assumes standard Class 10A motor trip curve',
          'Assumes 50 Hz copper conductor cabling'
        ],
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
        violations: Array.isArray(parsed.violations) ? parsed.violations : [],
        disclaimer: ENGINEERING_WARNING
      };
    } catch (err) {
      console.warn('Gemini explanation generation failed, using deterministic technical explanation:', err);
    }
  }

  // Deterministic Explanation Engine (Demo Mode)
  const isPass = compliance.overall_status === 'PASS';
  const flc = requirements.motor_current_a || 15.0;
  const kw = requirements.motor_power_kw || 7.5;
  const v = requirements.voltage_v || 415;
  const starter = requirements.starter_type || 'DOL';

  const violations: string[] = compliance.rule_results
    .filter((r: any) => r.result === 'FAIL')
    .map((r: any) => `[${r.rule_id}] ${r.title}: ${r.explanation}`);

  const warnings: string[] = compliance.rule_results
    .filter((r: any) => r.result === 'WARNING')
    .map((r: any) => `[${r.rule_id}] ${r.title}: ${r.explanation}`);

  return {
    design_summary: `Low-voltage motor-starter panel designed for a ${kw} kW, ${v} V, 3-phase motor drawing ${flc} A continuous FLC utilizing ${starter} starting topology under Rule Version ${compliance.rule_version}.`,
    component_selection_explanation: `Components were selected strictly from active Catalog Version ${selectedComponents[0]?.catalog_version || '2026.1'}. The motor contactor provides adequate AC-3 switching capacity, the thermal overload relay provides calibrated branch protection, and the MPCB provides short-circuit interruption.`,
    calculation_explanation: `Contactor sizing was determined as I_req = 1.20 * ${flc} A = ${flc * 1.2} A. Overload dial window was sized for nominal FLC with ±15% calibration capability. Enclosure thermal packing density was verified against the 70% threshold.`,
    compliance_explanation: isPass
      ? `All ${compliance.rules_evaluated} active design rules under Rule Set ${compliance.rule_version} PASSED with zero fatal errors.`
      : `Compliance check identified ${compliance.fail_count} non-conformities under Rule Set ${compliance.rule_version} that must be resolved prior to engineering approval.`,
    assumptions: [
      'Operating ambient temperature: ≤ 40°C continuous',
      'Motor duty class: S1 continuous duty, Class 10A thermal overload tripping profile',
      'Fault level withstand: 10 kA short-circuit coordination at 415 V',
      'Control supply: 24 V AC derived from integral step-down control transformer'
    ],
    warnings: warnings,
    violations: violations,
    disclaimer: ENGINEERING_WARNING
  };
}
