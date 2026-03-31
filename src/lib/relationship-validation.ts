// ============================================================
// RELATIONSHIP VALIDATION ("common sense" layer)
//
// Catches directional impossibilities, missing required fields
// by entity type, and structural red flags BEFORE data hits
// the database. Returns corrections + warnings so the pipeline
// can either auto-fix or skip bad data.
// ============================================================

import type { RelationshipInput, EntityInput } from './pipeline';

export type ValidationIssue = {
  severity: 'error' | 'warning' | 'auto_fixed';
  code: string;
  message: string;
  field?: string;
  suggestion?: string;
};

export type ValidatedRelationship = {
  relationship: RelationshipInput;
  issues: ValidationIssue[];
  dropped: boolean;
};

// ── Relationship direction rules ──
// Key: relationshipType. Value: which entity types are valid as SOURCE.
// If the source type is NOT in the allowed list, we flip or flag.

const DIRECTIONAL_RULES: Record<string, {
  validSourceTypes: string[];
  validTargetTypes: string[];
  description: string;
}> = {
  donated_to: {
    validSourceTypes: ['politician', 'donor', 'pac', 'corporation', 'lobbyist', 'organization', 'media_figure', 'party', 'operative'],
    validTargetTypes: ['politician', 'pac', 'party', 'organization'],
    description: 'Money flows from donor to recipient (campaign, PAC, org)',
  },
  funded_by: {
    validSourceTypes: ['pac', 'organization', 'party', 'corporation', 'politician'],
    validTargetTypes: ['politician', 'donor', 'pac', 'corporation', 'lobbyist', 'organization', 'media_figure', 'party'],
    description: 'Entity is funded BY the target (money flows target→source)',
  },
  appointed_by: {
    validSourceTypes: ['politician'],
    validTargetTypes: ['politician', 'organization', 'party'],
    description: 'Person was appointed by an authority figure or body',
  },
  employed_by: {
    validSourceTypes: ['politician', 'lobbyist', 'media_figure', 'operative'],
    validTargetTypes: ['organization', 'corporation', 'party', 'pac'],
    description: 'Person is employed by an organization',
  },
  lobbied: {
    validSourceTypes: ['lobbyist', 'corporation', 'organization', 'pac', 'donor'],
    validTargetTypes: ['politician', 'organization'],
    description: 'Entity lobbied a person or body',
  },
  endorsed: {
    validSourceTypes: ['politician', 'donor', 'organization', 'party', 'media_figure', 'pac', 'corporation', 'operative'],
    validTargetTypes: ['politician', 'party', 'legislation'],
    description: 'Entity endorsed a person, party, or legislation',
  },
  ruled_on: {
    validSourceTypes: ['politician'], // judges
    validTargetTypes: ['court_case', 'legislation'],
    description: 'Judge/court ruled on a case or law',
  },
  authored: {
    validSourceTypes: ['politician', 'organization', 'lobbyist', 'operative'],
    validTargetTypes: ['legislation', 'event'],
    description: 'Person or org authored a document/legislation',
  },
  founded: {
    validSourceTypes: ['politician', 'donor', 'lobbyist', 'corporation', 'media_figure', 'operative'],
    validTargetTypes: ['organization', 'pac', 'corporation', 'party'],
    description: 'Person founded an organization',
  },
};

// ── Financial relationships that MUST have dollar amounts ──

const FINANCIAL_REL_TYPES = new Set([
  'donated_to', 'funded_by', 'contracted_with',
]);

// ── Entity type minimum requirements ──
// What a node of this type should have before it's "credible"

export const ENTITY_COMPLETENESS_RULES: Record<string, {
  requiredRelTypes: string[];
  minConnections: number;
  description: string;
}> = {
  pac: {
    requiredRelTypes: ['funded_by', 'donated_to'],
    minConnections: 3,
    description: 'PAC must have at least one funding source and one recipient',
  },
  corporation: {
    requiredRelTypes: ['donated_to', 'lobbied'],
    minConnections: 2,
    description: 'Corporation should have donation or lobbying connections',
  },
  lobbyist: {
    requiredRelTypes: ['lobbied', 'employed_by'],
    minConnections: 2,
    description: 'Lobbyist should have lobbying targets and employer',
  },
  donor: {
    requiredRelTypes: ['donated_to'],
    minConnections: 2,
    description: 'Donor must have at least one donation recipient and should show funding relationships',
  },
  operative: {
    requiredRelTypes: [],
    minConnections: 2,
    description: 'Operative should have connections showing institutional influence or organizational ties',
  },
  politician: {
    requiredRelTypes: [],
    minConnections: 1,
    description: 'Politician should have at least one connection',
  },
  organization: {
    requiredRelTypes: [],
    minConnections: 2,
    description: 'Organization should have structural connections',
  },
};

// ── Main validation function ──

export function validateRelationship(
  rel: RelationshipInput,
  entityLookup: Map<string, EntityInput>,
): ValidatedRelationship {
  const issues: ValidationIssue[] = [];
  let corrected = { ...rel };
  let dropped = false;

  const sourceEntity = entityLookup.get(rel.sourceName.toLowerCase()) ||
    entityLookup.get(rel.sourceName);
  const targetEntity = entityLookup.get(rel.targetName.toLowerCase()) ||
    entityLookup.get(rel.targetName);

  const sourceType = sourceEntity?.type || 'unknown';
  const targetType = targetEntity?.type || 'unknown';

  // 1. Check directional sanity
  const rule = DIRECTIONAL_RULES[rel.relationshipType];
  if (rule) {
    const sourceValid = rule.validSourceTypes.includes(sourceType) || sourceType === 'unknown';
    const targetValid = rule.validTargetTypes.includes(targetType) || targetType === 'unknown';

    if (!sourceValid && targetValid) {
      // Source type is wrong for this direction — check if flipping fixes it
      const flippedSourceValid = rule.validSourceTypes.includes(targetType);
      const flippedTargetValid = rule.validTargetTypes.includes(sourceType);

      if (flippedSourceValid && flippedTargetValid) {
        // Auto-fix: flip the direction
        corrected = {
          ...corrected,
          sourceName: rel.targetName,
          targetName: rel.sourceName,
        };
        issues.push({
          severity: 'auto_fixed',
          code: 'DIRECTION_FLIPPED',
          message: `"${rel.sourceName}" (${sourceType}) → "${rel.targetName}" (${targetType}) via "${rel.relationshipType}" was directionally impossible. Auto-flipped to "${rel.targetName}" → "${rel.sourceName}". Rule: ${rule.description}`,
          field: 'direction',
        });
      } else {
        issues.push({
          severity: 'warning',
          code: 'DIRECTION_SUSPECT',
          message: `"${rel.sourceName}" (${sourceType}) as source for "${rel.relationshipType}" is unusual. Expected source types: ${rule.validSourceTypes.join(', ')}. Rule: ${rule.description}`,
          field: 'sourceName',
          suggestion: 'Verify direction manually or re-research this relationship',
        });
      }
    } else if (sourceValid && !targetValid) {
      issues.push({
        severity: 'warning',
        code: 'TARGET_TYPE_MISMATCH',
        message: `"${rel.targetName}" (${targetType}) as target for "${rel.relationshipType}" is unusual. Expected target types: ${rule.validTargetTypes.join(', ')}`,
        field: 'targetName',
      });
    }
  }

  // 2. Check financial relationships have dollar amounts
  if (FINANCIAL_REL_TYPES.has(rel.relationshipType)) {
    if (!rel.amount && rel.amount !== 0) {
      issues.push({
        severity: 'warning',
        code: 'MISSING_AMOUNT',
        message: `Financial relationship "${rel.relationshipType}" between "${rel.sourceName}" and "${rel.targetName}" has no dollar amount. Financial connections without amounts are low-credibility.`,
        field: 'amount',
        suggestion: 'Re-research to find specific dollar amounts from FEC filings or financial disclosures',
      });
    }
  }

  // 3. Check for self-referential relationships
  if (rel.sourceName.toLowerCase().trim() === rel.targetName.toLowerCase().trim()) {
    issues.push({
      severity: 'error',
      code: 'SELF_REFERENTIAL',
      message: `Relationship from "${rel.sourceName}" to itself via "${rel.relationshipType}" — dropping`,
    });
    dropped = true;
  }

  // 4. Check significance is reasonable
  if (rel.significance !== undefined) {
    if (rel.significance < 1 || rel.significance > 5) {
      corrected.significance = Math.max(1, Math.min(5, rel.significance));
      issues.push({
        severity: 'auto_fixed',
        code: 'SIGNIFICANCE_CLAMPED',
        message: `Significance ${rel.significance} out of range, clamped to ${corrected.significance}`,
        field: 'significance',
      });
    }
  }

  // 5. Check description exists (empty descriptions = lazy data)
  if (!rel.description || rel.description.trim().length < 10) {
    issues.push({
      severity: 'warning',
      code: 'WEAK_DESCRIPTION',
      message: `Relationship "${rel.sourceName}" → "${rel.targetName}" (${rel.relationshipType}) has no meaningful description. This makes the connection uninformative on the graph.`,
      field: 'description',
      suggestion: 'Include specific context: when, how much, under what circumstances',
    });
  }

  // 6. Check date completeness for temporal relationships
  if (!rel.startDate && FINANCIAL_REL_TYPES.has(rel.relationshipType)) {
    issues.push({
      severity: 'warning',
      code: 'MISSING_DATE',
      message: `Financial relationship "${rel.relationshipType}" has no start date. Financial connections should be dated to specific cycles or time periods.`,
      field: 'startDate',
    });
  }

  // 7. Semantic sanity: PACs/orgs donating TO known individual megadonors is almost always reversed
  if (
    rel.relationshipType === 'donated_to' &&
    ['pac', 'organization'].includes(sourceType) &&
    ['politician', 'donor', 'operative', 'lobbyist', 'media_figure'].includes(targetType)
  ) {
    // This MIGHT be legitimate (PACs do donate to politicians' campaigns).
    // But flag it as needing verification if the target is a donor (almost certainly reversed)
    // or any non-politician individual.
    if (targetType === 'donor' || targetType !== 'politician') {
      issues.push({
        severity: 'warning',
        code: 'PAC_DONATING_TO_INDIVIDUAL',
        message: `"${rel.sourceName}" (${sourceType}) donating to "${rel.targetName}" (${targetType}) is unusual. PACs typically donate to campaigns, parties, or other PACs — not individual non-politicians. This relationship may be reversed (${rel.targetName} may have donated TO ${rel.sourceName}).`,
        field: 'direction',
        suggestion: 'Verify direction using FEC filings. If reversed, the relationship should be: target donated_to source.',
      });
    }
  }

  // 8. Check source evidence is referenced
  if (!rel.sourceEvidence) {
    issues.push({
      severity: 'warning',
      code: 'NO_SOURCE_EVIDENCE',
      message: `Relationship "${rel.sourceName}" → "${rel.targetName}" has no sourceEvidence reference. Unsourced connections reduce credibility.`,
      field: 'sourceEvidence',
    });
  }

  return {
    relationship: corrected,
    issues,
    dropped,
  };
}

// ── Batch validation ──

export function validateRelationships(
  relationships: RelationshipInput[],
  entities: EntityInput[],
): { validated: ValidatedRelationship[]; summary: ValidationSummary } {
  // Build entity lookup map
  const entityLookup = new Map<string, EntityInput>();
  for (const entity of entities) {
    entityLookup.set(entity.name, entity);
    entityLookup.set(entity.name.toLowerCase(), entity);
    if (entity.aliases) {
      for (const alias of entity.aliases) {
        entityLookup.set(alias.toLowerCase(), entity);
      }
    }
  }

  const validated = relationships.map((rel) => validateRelationship(rel, entityLookup));

  const summary: ValidationSummary = {
    total: relationships.length,
    passed: validated.filter((v) => v.issues.length === 0).length,
    autoFixed: validated.filter((v) => v.issues.some((i) => i.severity === 'auto_fixed')).length,
    warnings: validated.filter((v) => v.issues.some((i) => i.severity === 'warning')).length,
    dropped: validated.filter((v) => v.dropped).length,
    issues: validated.flatMap((v) => v.issues),
  };

  return { validated, summary };
}

export type ValidationSummary = {
  total: number;
  passed: number;
  autoFixed: number;
  warnings: number;
  dropped: number;
  issues: ValidationIssue[];
};

// ── Entity completeness scoring ──
// Used by audit agent to find low-quality nodes

export type CompletenessScore = {
  entityName: string;
  entityType: string;
  score: number;       // 0-100
  connectionCount: number;
  missingRelTypes: string[];
  issues: string[];
};

export function scoreEntityCompleteness(
  entityName: string,
  entityType: string,
  relationships: { relationshipType: string; sourceName: string; targetName: string; amount?: number | null; description?: string | null }[],
): CompletenessScore {
  const rules = ENTITY_COMPLETENESS_RULES[entityType];
  const issues: string[] = [];
  let score = 50; // Start at neutral

  // Count actual connections
  const connected = relationships.filter(
    (r) => r.sourceName.toLowerCase() === entityName.toLowerCase() ||
           r.targetName.toLowerCase() === entityName.toLowerCase()
  );
  const connectionCount = connected.length;

  // Check minimum connections
  const minRequired = rules?.minConnections || 1;
  if (connectionCount === 0) {
    score -= 40;
    issues.push('Orphan node: no connections at all');
  } else if (connectionCount < minRequired) {
    score -= 20;
    issues.push(`Only ${connectionCount} connection(s), expected at least ${minRequired} for ${entityType}`);
  } else {
    score += Math.min(20, connectionCount * 5);
  }

  // Check required relationship types
  const relTypesPresent = new Set(connected.map((r) => r.relationshipType));
  const missingRelTypes: string[] = [];
  if (rules?.requiredRelTypes) {
    for (const reqType of rules.requiredRelTypes) {
      if (!relTypesPresent.has(reqType)) {
        missingRelTypes.push(reqType);
        score -= 15;
        issues.push(`Missing expected "${reqType}" relationship for ${entityType}`);
      }
    }
  }

  // Check financial relationship quality
  const financialRels = connected.filter((r) => FINANCIAL_REL_TYPES.has(r.relationshipType));
  if (financialRels.length > 0) {
    const withAmounts = financialRels.filter((r) => r.amount != null && r.amount > 0);
    if (withAmounts.length === 0) {
      score -= 15;
      issues.push('Has financial relationships but NONE have dollar amounts');
    } else if (withAmounts.length < financialRels.length) {
      score -= 5;
      issues.push(`${financialRels.length - withAmounts.length} of ${financialRels.length} financial relationships missing dollar amounts`);
    } else {
      score += 10;
    }
  }

  // Check description quality
  const withDescriptions = connected.filter((r) => r.description && r.description.trim().length > 10);
  if (connected.length > 0 && withDescriptions.length === 0) {
    score -= 10;
    issues.push('None of the connections have meaningful descriptions');
  }

  // Bonus for having sourced connections (implied by existence of evidence links — caller should pass this)
  // Penalty for directional issues checked elsewhere

  return {
    entityName,
    entityType,
    score: Math.max(0, Math.min(100, score)),
    connectionCount,
    missingRelTypes,
    issues,
  };
}
