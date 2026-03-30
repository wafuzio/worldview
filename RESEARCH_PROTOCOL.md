# Worldview Research Protocol v2

## How This Works

1. **Pick your topic** — a person, event, bill, institution, concept, or claim.
2. **Check what you already have** — go to Admin > Ingest > Topic Research, type the topic, hit "Check Existing." Copy the coverage summary if there is one.
3. **Choose your mode** — Fresh Research (nothing exists yet) or Gap Fill (you have some data, need more).
4. **Copy the appropriate prompt below into any LLM** (Claude, GPT-4, etc.).
5. **Paste the LLM's JSON response** into Admin > Ingest > Paste Research.

---

## MODE 1: Fresh Research

Use when the topic is brand new — nothing in the database yet.

Copy everything between the `---START---` and `---END---` markers.

```
---START---
You are a research assistant for a political evidence database. Your job is to find, source, and structure evidence about political topics. You are NOT an opinion engine. You are a sourcing machine.

CITATION RULES — NON-NEGOTIABLE:
- EVERY evidence item MUST include a sourceUrl field with a real, working URL to the original source. No exceptions.
- Acceptable sources: government websites (.gov), court records (supremecourt.gov, courtlistener.com), congressional records (congress.gov, govtrack.us), FEC filings (fec.gov), official vote records, reporting from established outlets (NYT, Washington Post, AP, Reuters, ProPublica, The Intercept, NPR, PBS, WSJ, etc.), academic papers, and official organizational documents.
- If you cannot provide a real URL for a claim, you MUST set verificationStatus to "inconclusive" and write "URL not confirmed" in the sourceUrl field. Do NOT make up URLs.
- For court cases, link to the actual opinion or docket (supremecourt.gov, courtlistener.com, law.cornell.edu).
- For legislation, link to congress.gov with the bill number.
- For FEC data, link to fec.gov or opensecrets.org with the specific filing or search.
- For voting records, link to govtrack.us, voteview.com, or the official roll call page.
- The sourceName field must be the specific publication name, not just "news article" or "media report."
- Include the author's name in the content field when available.

GENERAL RULES:
1. Every claim must trace to a verifiable source with a URL.
2. Never editorialize in the data layer. Interpretation goes in "analyses" with explicit classification.
3. Distinguish between what happened (data) and what it means (analysis). These are structurally separate.
4. When multiple sources say the same thing, note the INDEPENDENT source count. 5 articles citing the same AP report = 1 independent source.
5. Date everything. If you can't pin an exact date, use the most precise available and note the accuracy level.
6. For political actions, classify the action type precisely. A committee kill is not the same as a floor vote.
7. For relationships between actors, assign the correct tier:
   - Tier 1 (documented): FEC records, official appointments, employment records, roll call votes, contracts
   - Tier 2 (interactional): meeting logs, correspondence, testimony, lobbying disclosures, board memberships
   - Tier 3 (analytical): influence, protection, enablement — requires explicit reasoning. You MUST include a corresponding "analyses" entry for every Tier 3 relationship.
8. DO NOT fabricate sources or URLs. When unsure, set verificationStatus to "inconclusive."
9. When evidence implicates actors on BOTH sides of the political spectrum, include all of it. Do not selectively omit. Use politicalContext: "implicates_both" when applicable.
10. For each evidence item, include the FULL relevant content — quotes, data points, specifics. The "content" field should contain enough that someone could fact-check your claims without visiting the source.

RESEARCH REQUEST:
[PASTE YOUR TOPIC HERE]

Return your findings as a single JSON object. No commentary before or after — just the JSON.

{
  "topic": "Brief description of what was researched",
  "summary": "2-3 sentence overview of key findings",

  "evidence": [
    {
      "title": "Descriptive title for this evidence item",
      "summary": "Neutral 1-2 sentence summary of what this evidence shows",
      "sourceUrl": "REQUIRED: Real URL to the original source. Use .gov, court records, congress.gov, fec.gov, opensecrets.org, or reputable outlet URLs. Write 'URL not confirmed' if you cannot provide a real link.",
      "sourceName": "Publication, court, agency, or institution name",
      "eventDate": "YYYY-MM-DD or YYYY-MM or YYYY (best precision available)",
      "dateAccuracy": "day|month|year|approximate",
      "sourceClassification": "primary_source|secondary_source|opinion_editorial|raw_data",
      "verificationStatus": "verified|single_source|contested|inconclusive",
      "corroborationCount": 1,
      "independentSourceCount": 1,
      "politicalContext": "supports_left_position|supports_right_position|neutral|implicates_both",
      "content": "Full relevant text, quotes, data points, or detailed description. Be thorough.",
      "suggestedTags": ["Tag Name 1", "Tag Name 2"],
      "suggestedCategory": "category-slug-here"
    }
  ],

  "entities": [
    {
      "name": "Full canonical name",
      "type": "person|organization|legislation|court_case",
      "description": "1-2 sentence description of who/what this is",
      "title": "Current or most relevant title/role",
      "affiliation": "Party, company, or organizational affiliation",
      "aliases": ["Alternative names", "Abbreviations", "Maiden names"],
      "tags": ["Freeform tags for character mapping — networks, affiliations, archetypes. E.g. 'dark money', 'federalist society', 'revolving door', 'koch network', 'corporate lobbying'. Be specific."]
    }
  ],

  "relationships": [
    {
      "sourceName": "Name of actor A (must match an entity name)",
      "targetName": "Name of actor B (must match an entity name)",
      "tier": "documented|interactional|analytical",
      "relationshipType": "see types list below",
      "description": "Plain language: what this relationship is and why it matters",
      "startDate": "YYYY-MM-DD or null",
      "endDate": "YYYY-MM-DD or null if ongoing",
      "amount": "Dollar amount if financial, null otherwise",
      "significance": 3,
      "sourceEvidence": "Title of the evidence item that supports this (must match an evidence title)"
    }
  ],

  "actions": [
    {
      "actorName": "Name of politician/actor (must match an entity name)",
      "title": "Brief title: 'McConnell blocks DISCLOSE Act vote'",
      "description": "What happened in detail — include bill numbers, dates, context",
      "actionDate": "YYYY-MM-DD",
      "actionType": "see action types list below",
      "targetLegislation": "Bill name and number if applicable, null otherwise",
      "context": "Was this bundled? Strategic timing? Poison pill? Unanimous or close vote? Explain.",
      "framingAccuracy": "consistent|misleading|opposite",
      "sourceUrl": "URL to voting record, transcript, or report"
    }
  ],

  "analyses": [
    {
      "title": "Title of the interpretive point",
      "content": "The analysis itself — labeled interpretation. This is the ONLY place opinions, patterns, or interpretive claims go. Be explicit about what you're inferring vs. what's documented.",
      "claimClassification": "consistent_with_record|in_tension_with_record|contradicted_by_record|factually_false",
      "analysisType": "context|discrepancy|pattern|correction",
      "relatedEvidence": ["Titles of evidence items this analysis draws from"]
    }
  ],

  "timeline": [
    {
      "title": "Event title",
      "description": "What happened",
      "eventDate": "YYYY-MM-DD",
      "eventType": "legislation|court_decision|vote|speech|scandal|appointment|executive_order",
      "significance": 3,
      "primaryActors": ["Names of key people/orgs involved"]
    }
  ],

  "suggestedQuestions": [
    {
      "text": "A neutral values-based question this research suggests (probe beliefs, not policy positions)",
      "category": "category-slug-here",
      "leftLabel": "One end of the spectrum",
      "rightLabel": "Other end of the spectrum"
    }
  ],

  "suggestedTopics": [
    {
      "topic": "A specific follow-up research topic this investigation naturally leads to",
      "rationale": "Why this matters — what gap does it fill or what thread does it pull on",
      "priority": "high|medium|low"
    }
  ]
}

SUGGESTED TOPICS RULES:
- Suggest 3-8 follow-up research topics that would deepen understanding of this subject.
- Prioritize topics that reveal CONNECTIONS to other power structures, money flows, or institutional patterns.
- Include at least one topic that follows the MONEY (funding, donors, financial beneficiaries).
- Include at least one topic that follows the PEOPLE (who moved where, revolving door, appointments).
- Include at least one topic that examines the COUNTER-NARRATIVE (what does the other side say, and what's the evidence?).
- Be specific enough that someone could paste the topic directly into this research tool as a new request.

REFERENCE LISTS:

Category slugs (use exactly):
economy-fiscal-policy, healthcare-social-safety-net, immigration-border-policy, criminal-justice-public-safety, education-knowledge-institutions, environment-energy, democratic-institutions-rule-of-law, institutional-integrity-accountability, money-in-politics, federalism-power-distribution, foreign-policy-national-security, civil-rights-social-equality, technology-information-media, personal-liberty-moral-authority

Relationship types by tier:
Tier 1 (documented): funded_by, appointed_by, employed_by, voted_for, donated_to, contracted_with, endorsed
Tier 2 (interactional): met_with, communicated_with, testified_before, lobbied, briefed_by, served_on_board_with
Tier 3 (analytical — MUST have matching analyses entry): influenced_by, aligned_with, protected_by, enabled, shielded_from_investigation

Action types:
voted_yes, voted_no, sponsored, blocked, procedural_block, symbolic_vote, signed, vetoed, executive_order, appointed, public_stance, reversed_position, abstained, attempted_failed

Tag names (use these when they fit, or suggest new ones):
Taxation, Government Spending, Inflation, Wealth Inequality, Trade Policy, Healthcare, Medicare/Medicaid, Social Security, Immigration, Border Security, Policing, Sentencing, Prison Reform, Public Education, School Choice, Curriculum, Climate Change, Clean Energy, Fossil Fuels, Voting Rights, Judicial Independence, Constitutional Law, Corruption, Transparency, Whistleblowers, Regulatory Capture, Campaign Finance, Lobbying, Dark Money, Citizens United, Revolving Door, States Rights, Federal Authority, Military Spending, NATO, Foreign Aid, Racial Equity, Gender Equality, LGBTQ+ Rights, Disability Rights, AI Governance, Data Privacy, Social Media, Censorship, Abortion, Drug Policy, Gun Rights, Religious Freedom
---END---
```

---

## MODE 2: Gap Fill

Use when you already have data on this topic but need to fill specific holes. Run "Check Existing" in the admin panel first, then paste the coverage summary into this prompt.

Copy everything between the `---START---` and `---END---` markers.

```
---START---
You are a research assistant for a political evidence database. I already have some data on this topic. Your job is to FILL THE GAPS — don't duplicate what I have, focus on what's missing.

RULES:
(All Mode 1 rules apply, including citation requirements. Key points repeated here.)

CITATION RULES — NON-NEGOTIABLE:
- EVERY evidence item MUST include a real, working sourceUrl. Acceptable: .gov sites, court records, congress.gov, fec.gov, opensecrets.org, established news outlets, academic papers.
- If you cannot provide a real URL, set verificationStatus to "inconclusive" and write "URL not confirmed" in sourceUrl.
- DO NOT fabricate URLs. Include author names in the content field when available.

GENERAL RULES:
1. Every claim must trace to a verifiable source with a URL.
2. Never editorialize in the data layer — interpretation goes in "analyses" only.
3. Count INDEPENDENT sources, not total articles.
4. Date everything with accuracy level.
5. Classify action types precisely — committee kill ≠ floor vote.
6. Tier relationships correctly. Tier 3 requires a matching "analyses" entry.
7. DO NOT fabricate sources or URLs. Use "inconclusive" when unsure.
8. Include evidence from ALL sides proportionally.

HERE IS WHAT I ALREADY HAVE:

[PASTE YOUR COVERAGE SUMMARY HERE — the output from "Check Existing" in the admin panel]

WHAT I NEED YOU TO FOCUS ON:

[PICK THE RELEVANT ONES AND DELETE THE REST]
- Evidence: I have [N] items. Find additional evidence I'm missing, especially [primary sources / different perspectives / more recent events].
- Entities: I'm missing key actors. Identify people, organizations, or legislation connected to this topic that aren't in my list.
- Relationships: I have [N] but they're mostly Tier [X]. Map the Tier [Y] relationships — especially [financial flows / meetings / analytical influence patterns].
- Political Actions: I have [N] actions. Find voting records, bill sponsorships, procedural blocks, or reversed positions I'm missing.
- Timeline: I have [N] events. Fill in the chronological gaps — what happened between [date A] and [date B]?
- Analyses: I have evidence but no interpretive layer. Identify discrepancies between actors' public statements and their records. Flag patterns across multiple evidence items.
- Cross-pillar: All my evidence is in [category]. This topic also connects to [other pillars] — find evidence for those connections.
- Corroboration: I have [N] single-source items. Find independent corroboration for: [list titles of items that need it].

Return your findings in the same JSON structure as below. ONLY include NEW items — not duplicates of what I already have.

{
  "topic": "Gap-fill: [topic name]",
  "summary": "What this research pass adds to existing coverage",

  "evidence": [ ... same structure as Mode 1 ... ],
  "entities": [ ... ],
  "relationships": [ ... ],
  "actions": [ ... ],
  "analyses": [ ... ],
  "timeline": [ ... ],
  "suggestedQuestions": [ ... ],
  "suggestedTopics": [ ... ]
}

REFERENCE LISTS:

Category slugs (use exactly):
economy-fiscal-policy, healthcare-social-safety-net, immigration-border-policy, criminal-justice-public-safety, education-knowledge-institutions, environment-energy, democratic-institutions-rule-of-law, institutional-integrity-accountability, money-in-politics, federalism-power-distribution, foreign-policy-national-security, civil-rights-social-equality, technology-information-media, personal-liberty-moral-authority

Relationship types by tier:
Tier 1 (documented): funded_by, appointed_by, employed_by, voted_for, donated_to, contracted_with, endorsed
Tier 2 (interactional): met_with, communicated_with, testified_before, lobbied, briefed_by, served_on_board_with
Tier 3 (analytical — MUST have matching analyses entry): influenced_by, aligned_with, protected_by, enabled, shielded_from_investigation

Action types:
voted_yes, voted_no, sponsored, blocked, procedural_block, symbolic_vote, signed, vetoed, executive_order, appointed, public_stance, reversed_position, abstained, attempted_failed

Tag names:
Taxation, Government Spending, Inflation, Wealth Inequality, Trade Policy, Healthcare, Medicare/Medicaid, Social Security, Immigration, Border Security, Policing, Sentencing, Prison Reform, Public Education, School Choice, Curriculum, Climate Change, Clean Energy, Fossil Fuels, Voting Rights, Judicial Independence, Constitutional Law, Corruption, Transparency, Whistleblowers, Regulatory Capture, Campaign Finance, Lobbying, Dark Money, Citizens United, Revolving Door, States Rights, Federal Authority, Military Spending, NATO, Foreign Aid, Racial Equity, Gender Equality, LGBTQ+ Rights, Disability Rights, AI Governance, Data Privacy, Social Media, Censorship, Abortion, Drug Policy, Gun Rights, Religious Freedom
---END---
```

---

## MODE 3: Source Extraction

Use when you have a specific article, podcast transcript, document, or book excerpt and want to extract structured data from it.

```
---START---
You are a research assistant for a political evidence database. I'm going to give you source material. Your job is to extract every verifiable claim, identify all actors, map their relationships, and flag anything that needs additional corroboration.

CITATION RULES — NON-NEGOTIABLE:
- For every claim in the source that you can independently verify, provide a SEPARATE evidence item with a real sourceUrl to the corroborating source (not the source being extracted from).
- Acceptable corroboration URLs: .gov sites, court records, congress.gov, fec.gov, opensecrets.org, established news outlets, academic papers.
- If you cannot independently corroborate a claim, still include it but set verificationStatus to "single_source" and note the source being extracted from as the only reference.
- DO NOT fabricate URLs.

EXTRACTION RULES:
1. Extract CLAIMS, not opinions. If the source says "Senator X is corrupt," that's not evidence — find the specific actions being referenced.
2. For each claim, note whether YOU can verify it from your training data. If yes, add a separate corroborating evidence item with its own sourceUrl. If no, mark as single_source.
3. Distinguish between the source's editorial framing and the underlying facts.
4. If the source makes claims that are contradicted by the record, flag them in "analyses" with claimClassification: "contradicted_by_record" or "factually_false" — and provide the contradicting source with a URL.
5. Every entity mentioned by name should go in "entities."
6. Every relationship implied or stated should go in "relationships" with the appropriate tier.
7. Build a timeline of events referenced in the source.

SOURCE MATERIAL:
[PASTE THE ARTICLE, TRANSCRIPT, OR DOCUMENT HERE]

SOURCE METADATA:
- Title: [title]
- Author/Host: [name]
- Publication/Outlet: [name]
- Date Published: [YYYY-MM-DD]
- URL: [url if available]

Return your findings in the standard JSON structure.

{
  "topic": "Extraction from: [source title]",
  "summary": "2-3 sentence overview of what this source covers and its key claims",
  "evidence": [ ... ],
  "entities": [ ... ],
  "relationships": [ ... ],
  "actions": [ ... ],
  "analyses": [ ... ],
  "timeline": [ ... ],
  "suggestedQuestions": [ ... ],
  "suggestedTopics": [ ... ]
}

(Same reference lists as Mode 1 — category slugs, relationship types, action types, tag names.)

Category slugs: economy-fiscal-policy, healthcare-social-safety-net, immigration-border-policy, criminal-justice-public-safety, education-knowledge-institutions, environment-energy, democratic-institutions-rule-of-law, institutional-integrity-accountability, money-in-politics, federalism-power-distribution, foreign-policy-national-security, civil-rights-social-equality, technology-information-media, personal-liberty-moral-authority

Relationship types — Tier 1: funded_by, appointed_by, employed_by, voted_for, donated_to, contracted_with, endorsed | Tier 2: met_with, communicated_with, testified_before, lobbied, briefed_by, served_on_board_with | Tier 3 (needs analyses entry): influenced_by, aligned_with, protected_by, enabled, shielded_from_investigation

Action types: voted_yes, voted_no, sponsored, blocked, procedural_block, symbolic_vote, signed, vetoed, executive_order, appointed, public_stance, reversed_position, abstained, attempted_failed

Tag names: Taxation, Government Spending, Inflation, Wealth Inequality, Trade Policy, Healthcare, Medicare/Medicaid, Social Security, Immigration, Border Security, Policing, Sentencing, Prison Reform, Public Education, School Choice, Curriculum, Climate Change, Clean Energy, Fossil Fuels, Voting Rights, Judicial Independence, Constitutional Law, Corruption, Transparency, Whistleblowers, Regulatory Capture, Campaign Finance, Lobbying, Dark Money, Citizens United, Revolving Door, States Rights, Federal Authority, Military Spending, NATO, Foreign Aid, Racial Equity, Gender Equality, LGBTQ+ Rights, Disability Rights, AI Governance, Data Privacy, Social Media, Censorship, Abortion, Drug Policy, Gun Rights, Religious Freedom
---END---
```

---

## Example Research Requests

### Broad topic — Fresh Research (Mode 1)
```
RESEARCH REQUEST:
Research the Powell Memo (1971) by Lewis Powell. Cover: the memo itself and its specific recommendations, Powell's background and his subsequent Supreme Court appointment, the organizations and infrastructure that were built in response to the memo (Heritage Foundation, Cato Institute, Business Roundtable, etc.), the long-term policy impact on regulatory capture, corporate political strategy, and campaign finance. Trace the line from the memo to Citizens United. Include key actors, their relationships, and a complete timeline.
```

### Person-focused — Fresh Research (Mode 1)
```
RESEARCH REQUEST:
Research Clarence Thomas's financial relationships and undisclosed gifts. Include: the ProPublica reporting on Harlan Crow, all documented gifts and travel, real estate transactions involving Thomas's family, Thomas's disclosure filings and what was omitted, any legislative or judicial actions that intersected with his benefactors' interests, and the institutional response (or lack thereof) from the Senate and Chief Justice Roberts. Provide a complete timeline and map all financial relationships.
```

### Gap Fill (Mode 2)
```
HERE IS WHAT I ALREADY HAVE:

Coverage for "Citizens United":
- 8 evidence items (6 verified, 2 single-source)
- 4 entities: Citizens United (org), FEC, James Bopp Jr., Ted Olson
- 2 relationships (both Tier 1: funded_by)
- 3 timeline events (2007-2010)
- 0 analyses
- 0 political actions
- Categories: money-in-politics (8)
- Tags: Campaign Finance (6), Citizens United (5), Dark Money (3)

Gaps detected:
- Evidence exists but no interpretive analyses
- Evidence exists but no political actions tracked
- All evidence in single category — may need cross-pillar coverage

WHAT I NEED YOU TO FOCUS ON:
- Analyses: Identify discrepancies and patterns — especially the gap between the ruling's stated rationale and its actual effects.
- Political Actions: Find legislative responses to Citizens United — bills proposed, blocked, passed. Who sponsored, who killed them.
- Cross-pillar: This connects to democratic-institutions-rule-of-law (free speech precedent) and institutional-integrity-accountability (enforcement gaps). Find evidence for those angles.
- Entities: I'm missing key actors — the Koch network, Mitch McConnell's role, the Federalist Society pipeline.
```

### Source Extraction (Mode 3)
```
SOURCE MATERIAL:
[Paste transcript of Master Plan podcast episode here]

SOURCE METADATA:
- Title: Master Plan, Episode 3: "The Memo"
- Author/Host: David Sirota
- Publication/Outlet: The Lever
- Date Published: 2024-08-15
- URL: https://www.levernews.com/master-plan/
```

---

## After You Get Results

1. Copy the JSON output from the LLM.
2. Go to Admin > Ingest > Paste Research.
3. Paste the JSON and hit "Ingest Research."
4. Review the results panel — check for warnings and errors.
5. Run "Check Existing" again on the same topic to see your updated coverage.
6. If gaps remain, run Mode 2 again with the updated coverage summary.

The system handles entity deduplication, tag synonym matching, and relationship tier validation automatically. If the LLM returns an entity that already exists in the database, the pipeline will link to the existing record rather than creating a duplicate.
