
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  Serializable: 'Serializable'
});

exports.Prisma.CategoryScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  description: 'description',
  order: 'order',
  isCrossCutting: 'isCrossCutting',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.QuestionScalarFieldEnum = {
  id: 'id',
  text: 'text',
  description: 'description',
  categoryId: 'categoryId',
  order: 'order',
  isActive: 'isActive',
  questionType: 'questionType',
  consensusText: 'consensusText',
  leftLabel: 'leftLabel',
  rightLabel: 'rightLabel',
  yesValue: 'yesValue',
  alignmentMap: 'alignmentMap',
  parentId: 'parentId',
  branchCondition: 'branchCondition',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PriorityComparisonScalarFieldEnum = {
  id: 'id',
  sessionId: 'sessionId',
  categoryAId: 'categoryAId',
  categoryBId: 'categoryBId',
  winnerId: 'winnerId',
  timeSpent: 'timeSpent',
  createdAt: 'createdAt'
};

exports.Prisma.PriorityRankingScalarFieldEnum = {
  id: 'id',
  sessionId: 'sessionId',
  categoryId: 'categoryId',
  rank: 'rank',
  wins: 'wins',
  losses: 'losses',
  weight: 'weight',
  createdAt: 'createdAt'
};

exports.Prisma.EvidenceScalarFieldEnum = {
  id: 'id',
  title: 'title',
  summary: 'summary',
  content: 'content',
  sourceUrl: 'sourceUrl',
  sourceName: 'sourceName',
  videoUrl: 'videoUrl',
  transcriptUrl: 'transcriptUrl',
  publishedAt: 'publishedAt',
  eventDate: 'eventDate',
  dateAccuracy: 'dateAccuracy',
  documentPath: 'documentPath',
  documentType: 'documentType',
  rawContent: 'rawContent',
  isProcessed: 'isProcessed',
  suggestedTags: 'suggestedTags',
  suggestedQuestions: 'suggestedQuestions',
  sourceClassification: 'sourceClassification',
  corroborationCount: 'corroborationCount',
  independentSourceCount: 'independentSourceCount',
  verificationStatus: 'verificationStatus',
  politicalContext: 'politicalContext',
  categoryId: 'categoryId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AnalysisScalarFieldEnum = {
  id: 'id',
  evidenceId: 'evidenceId',
  author: 'author',
  title: 'title',
  content: 'content',
  claimClassification: 'claimClassification',
  analysisType: 'analysisType',
  isDefaultVisible: 'isDefaultVisible',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EntityScalarFieldEnum = {
  id: 'id',
  name: 'name',
  type: 'type',
  aliases: 'aliases',
  description: 'description',
  wikiUrl: 'wikiUrl',
  tags: 'tags',
  title: 'title',
  affiliation: 'affiliation',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EvidenceEntityScalarFieldEnum = {
  id: 'id',
  evidenceId: 'evidenceId',
  entityId: 'entityId',
  mentions: 'mentions',
  sentiment: 'sentiment',
  context: 'context'
};

exports.Prisma.TagScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  color: 'color',
  createdAt: 'createdAt'
};

exports.Prisma.TagSynonymScalarFieldEnum = {
  id: 'id',
  tagId: 'tagId',
  phrase: 'phrase'
};

exports.Prisma.EvidenceTagScalarFieldEnum = {
  evidenceId: 'evidenceId',
  tagId: 'tagId'
};

exports.Prisma.QuestionEvidenceScalarFieldEnum = {
  questionId: 'questionId',
  evidenceId: 'evidenceId',
  relationship: 'relationship',
  note: 'note'
};

exports.Prisma.EvidenceExcerptScalarFieldEnum = {
  id: 'id',
  evidenceId: 'evidenceId',
  text: 'text',
  startIndex: 'startIndex',
  endIndex: 'endIndex',
  note: 'note',
  createdAt: 'createdAt'
};

exports.Prisma.ExcerptTagScalarFieldEnum = {
  excerptId: 'excerptId',
  tagId: 'tagId'
};

exports.Prisma.EventScalarFieldEnum = {
  id: 'id',
  title: 'title',
  description: 'description',
  eventDate: 'eventDate',
  endDate: 'endDate',
  dateAccuracy: 'dateAccuracy',
  location: 'location',
  eventType: 'eventType',
  significance: 'significance',
  primaryActors: 'primaryActors',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EventTagScalarFieldEnum = {
  eventId: 'eventId',
  tagId: 'tagId'
};

exports.Prisma.EventSourceScalarFieldEnum = {
  id: 'id',
  eventId: 'eventId',
  evidenceId: 'evidenceId',
  relationship: 'relationship',
  excerpt: 'excerpt',
  createdAt: 'createdAt'
};

exports.Prisma.SessionScalarFieldEnum = {
  id: 'id',
  userToken: 'userToken',
  nickname: 'nickname',
  economicScore: 'economicScore',
  socialScore: 'socialScore',
  authorityScore: 'authorityScore',
  overallScore: 'overallScore',
  weightedEconomicScore: 'weightedEconomicScore',
  weightedSocialScore: 'weightedSocialScore',
  weightedAuthorityScore: 'weightedAuthorityScore',
  detailedResults: 'detailedResults',
  isComplete: 'isComplete',
  completedAt: 'completedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AnswerScalarFieldEnum = {
  id: 'id',
  sessionId: 'sessionId',
  questionId: 'questionId',
  value: 'value',
  timeSpent: 'timeSpent',
  createdAt: 'createdAt'
};

exports.Prisma.SyntheticPlatformScalarFieldEnum = {
  id: 'id',
  sessionId: 'sessionId',
  platformPositions: 'platformPositions',
  partyDistances: 'partyDistances',
  platformSummary: 'platformSummary',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TradeoffStatementScalarFieldEnum = {
  id: 'id',
  sessionId: 'sessionId',
  sourceType: 'sourceType',
  priorityTopic: 'priorityTopic',
  priorityRank: 'priorityRank',
  alignedParty: 'alignedParty',
  conflictSummary: 'conflictSummary',
  tradeoffCost: 'tradeoffCost',
  consensusQuestionId: 'consensusQuestionId',
  severity: 'severity',
  createdAt: 'createdAt'
};

exports.Prisma.SessionComparisonScalarFieldEnum = {
  id: 'id',
  sessionAId: 'sessionAId',
  sessionBId: 'sessionBId',
  overallAgreement: 'overallAgreement',
  pillarAgreement: 'pillarAgreement',
  convergenceZones: 'convergenceZones',
  divergenceZones: 'divergenceZones',
  priorityOverlap: 'priorityOverlap',
  sharedBeliefConflicts: 'sharedBeliefConflicts',
  labelA: 'labelA',
  labelB: 'labelB',
  createdAt: 'createdAt'
};

exports.Prisma.PoliticianScalarFieldEnum = {
  id: 'id',
  name: 'name',
  type: 'type',
  description: 'description',
  imageUrl: 'imageUrl',
  title: 'title',
  affiliation: 'affiliation',
  economicScore: 'economicScore',
  socialScore: 'socialScore',
  authorityScore: 'authorityScore',
  positions: 'positions',
  tags: 'tags',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PoliticianPartyHistoryScalarFieldEnum = {
  id: 'id',
  politicianId: 'politicianId',
  party: 'party',
  startDate: 'startDate',
  endDate: 'endDate',
  reason: 'reason',
  createdAt: 'createdAt'
};

exports.Prisma.ActorRelationshipScalarFieldEnum = {
  id: 'id',
  sourceId: 'sourceId',
  targetId: 'targetId',
  tier: 'tier',
  relationshipType: 'relationshipType',
  startDate: 'startDate',
  endDate: 'endDate',
  significance: 'significance',
  description: 'description',
  amount: 'amount',
  currency: 'currency',
  analysisId: 'analysisId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ActorRelationshipEvidenceScalarFieldEnum = {
  relationshipId: 'relationshipId',
  evidenceId: 'evidenceId',
  excerpt: 'excerpt'
};

exports.Prisma.PoliticalActionScalarFieldEnum = {
  id: 'id',
  politicianId: 'politicianId',
  title: 'title',
  description: 'description',
  actionDate: 'actionDate',
  dateAccuracy: 'dateAccuracy',
  actionType: 'actionType',
  targetLegislation: 'targetLegislation',
  targetEntity: 'targetEntity',
  context: 'context',
  framingAccuracy: 'framingAccuracy',
  sourceUrl: 'sourceUrl',
  sourceDescription: 'sourceDescription',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PoliticianStanceScalarFieldEnum = {
  id: 'id',
  politicianId: 'politicianId',
  questionId: 'questionId',
  publicStance: 'publicStance',
  actionStance: 'actionStance',
  publicSource: 'publicSource',
  actionSource: 'actionSource',
  discrepancyNote: 'discrepancyNote',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PoliticianEvidenceScalarFieldEnum = {
  politicianId: 'politicianId',
  evidenceId: 'evidenceId',
  portrayal: 'portrayal',
  excerpt: 'excerpt'
};

exports.Prisma.StatementScalarFieldEnum = {
  id: 'id',
  politicianId: 'politicianId',
  text: 'text',
  statementType: 'statementType',
  madeAt: 'madeAt',
  source: 'source',
  context: 'context',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.FactCheckScalarFieldEnum = {
  id: 'id',
  statementId: 'statementId',
  evidenceId: 'evidenceId',
  relationship: 'relationship',
  analysis: 'analysis',
  createdAt: 'createdAt'
};

exports.Prisma.InstitutionScalarFieldEnum = {
  id: 'id',
  name: 'name',
  type: 'type',
  description: 'description',
  perceivedIntegrity: 'perceivedIntegrity',
  actualIntegrity: 'actualIntegrity',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.InstitutionEvidenceScalarFieldEnum = {
  institutionId: 'institutionId',
  evidenceId: 'evidenceId',
  relationship: 'relationship',
  note: 'note'
};

exports.Prisma.ResearchQueueScalarFieldEnum = {
  id: 'id',
  topic: 'topic',
  rationale: 'rationale',
  priority: 'priority',
  depth: 'depth',
  source: 'source',
  sourceRunId: 'sourceRunId',
  status: 'status',
  error: 'error',
  attempts: 'attempts',
  maxAttempts: 'maxAttempts',
  processedByRunId: 'processedByRunId',
  evidenceCreated: 'evidenceCreated',
  entitiesCreated: 'entitiesCreated',
  relationshipsCreated: 'relationshipsCreated',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  processedAt: 'processedAt'
};

exports.Prisma.AgentRunScalarFieldEnum = {
  id: 'id',
  runType: 'runType',
  status: 'status',
  topicsProcessed: 'topicsProcessed',
  topicsSucceeded: 'topicsSucceeded',
  topicsFailed: 'topicsFailed',
  topicsDiscovered: 'topicsDiscovered',
  evidenceCreated: 'evidenceCreated',
  entitiesCreated: 'entitiesCreated',
  maxTopics: 'maxTopics',
  depth: 'depth',
  log: 'log',
  startedAt: 'startedAt',
  completedAt: 'completedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};


exports.Prisma.ModelName = {
  Category: 'Category',
  Question: 'Question',
  PriorityComparison: 'PriorityComparison',
  PriorityRanking: 'PriorityRanking',
  Evidence: 'Evidence',
  Analysis: 'Analysis',
  Entity: 'Entity',
  EvidenceEntity: 'EvidenceEntity',
  Tag: 'Tag',
  TagSynonym: 'TagSynonym',
  EvidenceTag: 'EvidenceTag',
  QuestionEvidence: 'QuestionEvidence',
  EvidenceExcerpt: 'EvidenceExcerpt',
  ExcerptTag: 'ExcerptTag',
  Event: 'Event',
  EventTag: 'EventTag',
  EventSource: 'EventSource',
  Session: 'Session',
  Answer: 'Answer',
  SyntheticPlatform: 'SyntheticPlatform',
  TradeoffStatement: 'TradeoffStatement',
  SessionComparison: 'SessionComparison',
  Politician: 'Politician',
  PoliticianPartyHistory: 'PoliticianPartyHistory',
  ActorRelationship: 'ActorRelationship',
  ActorRelationshipEvidence: 'ActorRelationshipEvidence',
  PoliticalAction: 'PoliticalAction',
  PoliticianStance: 'PoliticianStance',
  PoliticianEvidence: 'PoliticianEvidence',
  Statement: 'Statement',
  FactCheck: 'FactCheck',
  Institution: 'Institution',
  InstitutionEvidence: 'InstitutionEvidence',
  ResearchQueue: 'ResearchQueue',
  AgentRun: 'AgentRun'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
