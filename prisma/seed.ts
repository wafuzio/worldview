import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

// ============================================================
// WORLDVIEW SEED DATA — v3.0 (VALUES-FIRST QUESTIONS)
// ============================================================

async function main() {
  console.log('Seeding Worldview database...\n');

  // ──────────────────────────────────────────────
  // 1. THE 14 PILLARS
  // ──────────────────────────────────────────────

  const pillarData = [
    {
      name: 'Economy & Fiscal Policy',
      slug: 'economy-fiscal-policy',
      description: 'How government should manage the economy — taxation, spending, budgets, inflation, wealth distribution, and the balance between state intervention and free markets.',
      order: 1,
    },
    {
      name: 'Healthcare & Social Safety Net',
      slug: 'healthcare-social-safety-net',
      description: 'Government\'s role in providing healthcare, welfare benefits, and support systems for vulnerable populations. The spectrum from universal provision to market-based approaches.',
      order: 2,
    },
    {
      name: 'Immigration & Border Policy',
      slug: 'immigration-border-policy',
      description: 'Who can enter and reside in the country, border enforcement, deportation, and pathways to citizenship. Security imperatives versus humanitarian obligations.',
      order: 3,
    },
    {
      name: 'Criminal Justice & Public Safety',
      slug: 'criminal-justice-public-safety',
      description: 'Enforcement systems — policing, courts, prisons, and sentencing. How society maintains order, punishes crime, and rehabilitates offenders.',
      order: 4,
    },
    {
      name: 'Education & Knowledge Institutions',
      slug: 'education-knowledge-institutions',
      description: 'Public education policy, curriculum content, institutional authority, academic freedom, and the role of schools in shaping civic understanding.',
      order: 5,
    },
    {
      name: 'Environment & Energy',
      slug: 'environment-energy',
      description: 'Government intervention on climate change, pollution, natural resource management, and the transition between energy sources.',
      order: 6,
    },
    {
      name: 'Democratic Institutions & Rule of Law',
      slug: 'democratic-institutions-rule-of-law',
      description: 'The structural integrity of democracy — separation of powers, judicial independence, elections, constitutional process, and equal application of law.',
      order: 7,
    },
    {
      name: 'Institutional Integrity & Accountability',
      slug: 'institutional-integrity-accountability',
      description: 'Corruption, ethics enforcement, transparency, whistleblower protection, inspector general independence, and government accountability mechanisms.',
      order: 8,
    },
    {
      name: 'Money in Politics',
      slug: 'money-in-politics',
      description: 'Campaign finance, lobbying, dark money, Super PACs, revolving doors between government and industry, and whether money translates to unequal political influence.',
      order: 9,
    },
    {
      name: 'Federalism & Power Distribution',
      slug: 'federalism-power-distribution',
      description: 'Balance of power between national and state/local government. Where policy authority should reside and the principle of subsidiarity.',
      order: 10,
    },
    {
      name: 'Foreign Policy & National Security',
      slug: 'foreign-policy-national-security',
      description: 'The country\'s role in global affairs — military spending, intervention philosophy, alliances, trade agreements, and the tension between isolationism and internationalism.',
      order: 11,
    },
    {
      name: 'Civil Rights & Social Equality',
      slug: 'civil-rights-social-equality',
      description: 'Rights protections across identity groups — racial equity, gender equality, LGBTQ+ rights, disability rights, and the legal frameworks that protect or fail them.',
      order: 12,
    },
    {
      name: 'Technology, Information & Media Systems',
      slug: 'technology-information-media',
      description: 'AI governance, social media regulation, data privacy, algorithmic influence, platform moderation, censorship, and the information ecosystem\'s impact on democracy.',
      order: 13,
    },
    {
      name: 'Personal Liberty & Moral Authority',
      slug: 'personal-liberty-moral-authority',
      description: 'Whether government should legislate personal moral choices — abortion, drug policy, marriage, end-of-life decisions, religious expression, and the boundary between law and morality.',
      order: 14,
      isCrossCutting: true,
    },
  ];

  const categories = await Promise.all(
    pillarData.map((p) =>
      prisma.category.create({ data: p })
    )
  );

  const cat = Object.fromEntries(categories.map((c) => [c.slug, c]));
  console.log(`Created ${categories.length} pillars`);

  // ──────────────────────────────────────────────
  // 2. TAGS (broader set mapped to pillars)
  // ──────────────────────────────────────────────

  const tagData = [
    // Economy
    { name: 'Taxation', color: '#f97316' },
    { name: 'Government Spending', color: '#eab308' },
    { name: 'Inflation', color: '#ef4444' },
    { name: 'Wealth Inequality', color: '#dc2626' },
    { name: 'Trade Policy', color: '#f59e0b' },
    // Healthcare
    { name: 'Healthcare', color: '#ef4444' },
    { name: 'Medicare/Medicaid', color: '#e11d48' },
    { name: 'Social Security', color: '#be123c' },
    // Immigration
    { name: 'Immigration', color: '#3b82f6' },
    { name: 'Border Security', color: '#1d4ed8' },
    // Criminal Justice
    { name: 'Policing', color: '#64748b' },
    { name: 'Sentencing', color: '#475569' },
    { name: 'Prison Reform', color: '#334155' },
    // Education
    { name: 'Public Education', color: '#a855f7' },
    { name: 'School Choice', color: '#9333ea' },
    { name: 'Curriculum', color: '#7c3aed' },
    // Environment
    { name: 'Climate Change', color: '#22c55e' },
    { name: 'Clean Energy', color: '#16a34a' },
    { name: 'Fossil Fuels', color: '#65a30d' },
    // Democratic Institutions
    { name: 'Voting Rights', color: '#06b6d4' },
    { name: 'Judicial Independence', color: '#0891b2' },
    { name: 'Constitutional Law', color: '#0e7490' },
    // Institutional Integrity
    { name: 'Corruption', color: '#dc2626' },
    { name: 'Transparency', color: '#2563eb' },
    { name: 'Whistleblowers', color: '#7c3aed' },
    { name: 'Regulatory Capture', color: '#b91c1c' },
    // Money in Politics
    { name: 'Campaign Finance', color: '#059669' },
    { name: 'Lobbying', color: '#047857' },
    { name: 'Dark Money', color: '#064e3b' },
    { name: 'Citizens United', color: '#065f46' },
    { name: 'Revolving Door', color: '#0f766e' },
    // Federalism
    { name: 'States Rights', color: '#8b5cf6' },
    { name: 'Federal Authority', color: '#6d28d9' },
    // Foreign Policy
    { name: 'Military Spending', color: '#6b7280' },
    { name: 'NATO', color: '#4b5563' },
    { name: 'Foreign Aid', color: '#374151' },
    // Civil Rights
    { name: 'Racial Equity', color: '#ec4899' },
    { name: 'Gender Equality', color: '#db2777' },
    { name: 'LGBTQ+ Rights', color: '#c026d3' },
    { name: 'Disability Rights', color: '#a21caf' },
    // Technology
    { name: 'AI Governance', color: '#14b8a6' },
    { name: 'Data Privacy', color: '#0d9488' },
    { name: 'Social Media', color: '#0f766e' },
    { name: 'Censorship', color: '#115e59' },
    // Personal Liberty
    { name: 'Abortion', color: '#f43f5e' },
    { name: 'Drug Policy', color: '#e11d48' },
    { name: 'Gun Rights', color: '#9f1239' },
    { name: 'Religious Freedom', color: '#881337' },
  ];

  const tags = await Promise.all(
    tagData.map((t) => prisma.tag.create({ data: t }))
  );
  console.log(`Created ${tags.length} tags`);

  // Add synonyms for key tags
  const tagMap = Object.fromEntries(tags.map((t) => [t.name, t]));

  const synonymData = [
    { tagName: 'Immigration', phrases: ['border', 'migrants', 'deportation', 'asylum', 'refugee', 'undocumented', 'DACA'] },
    { tagName: 'Corruption', phrases: ['bribery', 'graft', 'kickbacks', 'pay-to-play', 'self-dealing', 'conflicts of interest'] },
    { tagName: 'Campaign Finance', phrases: ['political donations', 'PAC', 'Super PAC', 'fundraising', 'bundling', 'soft money'] },
    { tagName: 'Dark Money', phrases: ['anonymous donations', 'undisclosed donors', '501(c)(4)', 'shadow money'] },
    { tagName: 'Lobbying', phrases: ['lobbyist', 'K Street', 'influence peddling', 'special interests'] },
    { tagName: 'Revolving Door', phrases: ['industry-to-government', 'government-to-industry', 'former regulators'] },
    { tagName: 'Regulatory Capture', phrases: ['captured agency', 'industry influence on regulators', 'fox guarding henhouse'] },
    { tagName: 'Climate Change', phrases: ['global warming', 'greenhouse gas', 'carbon emissions', 'Paris Agreement'] },
    { tagName: 'Healthcare', phrases: ['ACA', 'Obamacare', 'universal healthcare', 'single payer', 'insurance'] },
    { tagName: 'Voting Rights', phrases: ['voter suppression', 'gerrymandering', 'voter ID', 'election integrity', 'ballot access'] },
    { tagName: 'Citizens United', phrases: ['Citizens United v FEC', 'corporate personhood', 'money is speech'] },
    { tagName: 'AI Governance', phrases: ['artificial intelligence regulation', 'algorithmic bias', 'AI safety', 'machine learning policy'] },
    { tagName: 'Data Privacy', phrases: ['surveillance', 'GDPR', 'CCPA', 'data collection', 'digital rights', 'tracking'] },
  ];

  for (const { tagName, phrases } of synonymData) {
    const tag = tagMap[tagName];
    if (tag) {
      await Promise.all(
        phrases.map((phrase) =>
          prisma.tagSynonym.create({ data: { tagId: tag.id, phrase } })
        )
      );
    }
  }
  console.log('Created tag synonyms');

  // ──────────────────────────────────────────────
  // 3. VALUES-BASED QUESTIONS
  // ──────────────────────────────────────────────
  // These questions probe foundational BELIEFS and VALUES
  // rather than policy positions. The downstream mapping
  // (stored in description) explains how answers connect
  // to policy implications. Cross-pillar links stored in
  // alignmentMap alongside axis weights.

  // Helper to build alignmentMap JSON with axis weights + cross-pillar links
  const am = (economic: number, social: number, authority: number, crossLinks: string[] = []) =>
    JSON.stringify({ economic, social, authority, crossPillarLinks: crossLinks });

  let questionCount = 0;

  // ── CONSENSUS ANCHORS ─────────────────────────
  // These are "receipt" questions. Nearly everyone agrees.
  // They don't affect alignment scores — they exist so the
  // tradeoff engine can say "You told us X, but your values
  // align you with positions that contradict X."

  await prisma.question.create({
    data: {
      text: 'Do you think there is too much money influencing politics in the United States?',
      description: 'Consensus anchor for money-in-politics contradictions.',
      categoryId: cat['money-in-politics'].id,
      order: 0,
      questionType: 'consensus',
      consensusText: 'You agreed that there is too much money influencing politics',
      leftLabel: 'Yes, way too much',
      rightLabel: 'No, it\'s fine as is',
      alignmentMap: am(0, 0, 0),
    },
  });

  await prisma.question.create({
    data: {
      text: 'Do you believe political corruption is a serious problem in the United States today?',
      description: 'Consensus anchor for institutional integrity contradictions.',
      categoryId: cat['institutional-integrity-accountability'].id,
      order: 0,
      questionType: 'consensus',
      consensusText: 'You agreed that political corruption is a serious problem',
      leftLabel: 'Yes, very serious',
      rightLabel: 'No, not really',
      alignmentMap: am(0, 0, 0),
    },
  });

  await prisma.question.create({
    data: {
      text: 'Should the government be transparent about how it makes decisions and spends taxpayer money?',
      description: 'Consensus anchor for transparency contradictions.',
      categoryId: cat['institutional-integrity-accountability'].id,
      order: 0,
      questionType: 'consensus',
      consensusText: 'You agreed the government should be transparent about decisions and spending',
      leftLabel: 'Yes, absolutely',
      rightLabel: 'Not necessarily',
      alignmentMap: am(0, 0, 0),
    },
  });

  await prisma.question.create({
    data: {
      text: 'Should elected officials be held to the same laws as everyone else?',
      description: 'Consensus anchor for rule-of-law contradictions.',
      categoryId: cat['democratic-institutions-rule-of-law'].id,
      order: 0,
      questionType: 'consensus',
      consensusText: 'You agreed that elected officials should be held to the same laws as everyone else',
      leftLabel: 'Yes, no exceptions',
      rightLabel: 'Some flexibility is needed',
      alignmentMap: am(0, 0, 0),
    },
  });

  await prisma.question.create({
    data: {
      text: 'Should the government work to ensure all citizens have a real opportunity to succeed regardless of where they were born or who their parents are?',
      description: 'Consensus anchor for equality-of-opportunity contradictions.',
      categoryId: cat['civil-rights-social-equality'].id,
      order: 0,
      questionType: 'consensus',
      consensusText: 'You agreed the government should ensure real opportunity for all citizens',
      leftLabel: 'Yes, that\'s fundamental',
      rightLabel: 'That\'s not the government\'s job',
      alignmentMap: am(0, 0, 0),
    },
  });

  await prisma.question.create({
    data: {
      text: 'Should people who work full time be able to afford basic necessities like housing, food, and healthcare?',
      description: 'Consensus anchor for economic dignity contradictions.',
      categoryId: cat['economy-fiscal-policy'].id,
      order: 0,
      questionType: 'consensus',
      consensusText: 'You agreed that full-time workers should be able to afford basic necessities',
      leftLabel: 'Yes, that should be the baseline',
      rightLabel: 'The market should set wages',
      alignmentMap: am(0, 0, 0),
    },
  });

  await prisma.question.create({
    data: {
      text: 'Do you think every citizen\'s vote should count equally, regardless of where they live?',
      description: 'Consensus anchor for voting equality contradictions.',
      categoryId: cat['democratic-institutions-rule-of-law'].id,
      order: 0,
      questionType: 'consensus',
      consensusText: 'You agreed that every citizen\'s vote should count equally',
      leftLabel: 'Yes, equal weight',
      rightLabel: 'Some variation is acceptable',
      alignmentMap: am(0, 0, 0),
    },
  });

  await prisma.question.create({
    data: {
      text: 'Should people in positions of power face consequences when they break the law?',
      description: 'Consensus anchor for accountability contradictions.',
      categoryId: cat['institutional-integrity-accountability'].id,
      order: 0,
      questionType: 'consensus',
      consensusText: 'You agreed that powerful people should face consequences for breaking the law',
      leftLabel: 'Yes, always',
      rightLabel: 'Depends on the circumstances',
      alignmentMap: am(0, 0, 0),
    },
  });

  console.log('Created 8 consensus anchor questions');
  questionCount += 8;

  // ── ECONOMY & FISCAL POLICY ──────────────────

  // Q1: Meritocracy belief (success = earned vs inherited)
  await prisma.question.create({
    data: {
      text: 'When you look at someone who\'s very wealthy, do you think most of their success came from their own hard work and smart choices, or mostly from advantages they started with like family money or connections?',
      description: 'Belief in meritocracy maps to lower support for wealth redistribution; belief in inherited advantage maps to support for progressive taxation and inheritance taxes.',
      categoryId: cat['economy-fiscal-policy'].id,
      order: 1,
      leftLabel: 'Almost entirely from their own hard work',
      rightLabel: 'Almost entirely from advantages they started with',
      alignmentMap: am(0.9, 0.3, 0, ['civil-rights-social-equality', 'education-knowledge-institutions']),
    },
  });

  // Q2: Attribution of poverty
  await prisma.question.create({
    data: {
      text: 'If you saw someone struggling financially, what would be your first thought?',
      description: 'Attribution of poverty to individual vs. structural factors predicts support for safety nets and government intervention.',
      categoryId: cat['economy-fiscal-policy'].id,
      order: 2,
      leftLabel: 'They probably haven\'t worked hard enough or made good choices',
      rightLabel: 'They probably faced circumstances beyond their control',
      alignmentMap: am(0.8, 0.4, 0.2, ['healthcare-social-safety-net', 'criminal-justice-public-safety']),
    },
  });

  // Q3: Tolerance for creative destruction
  await prisma.question.create({
    data: {
      text: 'When new technology or business makes old jobs disappear, is that mainly a problem that needs solving, or mainly just how progress works?',
      description: 'Higher tolerance for disruption maps to less support for job protection policies; lower tolerance maps to support for retraining, safety nets, and antitrust.',
      categoryId: cat['economy-fiscal-policy'].id,
      order: 3,
      leftLabel: 'It\'s a serious problem that needs active solutions',
      rightLabel: 'It\'s painful but the natural cost of progress',
      alignmentMap: am(0.7, 0.2, 0.3, ['technology-information-media', 'education-knowledge-institutions']),
    },
  });

  // Q4: Wealth concentration as destabilizing
  await prisma.question.create({
    data: {
      text: 'Can a society have some people become very wealthy while most people stay middle class or poor, without that creating serious problems? Or does extreme wealth concentration tend to cause problems even if you\'re fair about how it happened?',
      description: 'Belief that concentration itself is destabilizing maps to support for antitrust and wealth limits; belief in fairness-only maps to opposition.',
      categoryId: cat['economy-fiscal-policy'].id,
      order: 4,
      leftLabel: 'Wealth concentration is fine as long as it\'s earned fairly',
      rightLabel: 'Extreme concentration tends to create problems regardless of how it happened',
      alignmentMap: am(0.8, 0.2, 0.3, ['money-in-politics', 'democratic-institutions-rule-of-law']),
    },
  });

  // Q5: Human motivation without work requirement
  await prisma.question.create({
    data: {
      text: 'If people didn\'t have to work to survive—say everyone got enough money to live decently whether they worked or not—what do you think would happen? Would most people still choose to do something productive, or would many stop contributing?',
      description: 'Optimistic view of human motivation maps to openness to universal basic income and job guarantee programs; pessimistic view opposes them.',
      categoryId: cat['economy-fiscal-policy'].id,
      order: 5,
      leftLabel: 'Most would still work and contribute',
      rightLabel: 'Many would stop working and contributing',
      alignmentMap: am(0.7, 0.3, 0.2, ['personal-liberty-moral-authority']),
    },
  });
  questionCount += 5;

  // ── HEALTHCARE & SOCIAL SAFETY NET ───────────

  // Q1: Collective obligation to the sick
  await prisma.question.create({
    data: {
      text: 'Imagine someone in your community is sick and can\'t afford treatment. Is that something your community should help with the way you might help a friend, or is it mainly that person\'s responsibility to figure out?',
      description: 'Sense of collective obligation maps to support for universal healthcare and safety nets; belief in individual responsibility maps to market-based approaches.',
      categoryId: cat['healthcare-social-safety-net'].id,
      order: 1,
      leftLabel: 'Community should help the way you\'d help a friend',
      rightLabel: 'Mainly their responsibility to figure out',
      alignmentMap: am(0.7, 0.4, 0.3, ['personal-liberty-moral-authority', 'democratic-institutions-rule-of-law']),
    },
  });

  // Q2: Do people who need help want to self-provide? (with follow-up)
  const hcQ2 = await prisma.question.create({
    data: {
      text: 'Do you think most people who need help want to provide for themselves, or are many content to rely on others?',
      description: 'Belief that poverty reflects personal choice vs. circumstance predicts support for conditional vs. universal benefits.',
      categoryId: cat['healthcare-social-safety-net'].id,
      order: 2,
      leftLabel: 'Most want to provide for themselves',
      rightLabel: 'Many are content to rely on others',
      alignmentMap: am(0.6, 0.3, 0.2, ['economy-fiscal-policy', 'institutional-integrity-accountability']),
    },
  });

  // Follow-up: Why are they content to rely on help?
  await prisma.question.create({
    data: {
      text: 'If you\'re right that many would be content to rely on help, is that mainly because they\'re lazy, or because circumstances make it hard to get ahead even if you work?',
      description: 'Probes whether dependence attribution is moral judgment vs. structural understanding.',
      categoryId: cat['healthcare-social-safety-net'].id,
      order: 3,
      parentId: hcQ2.id,
      branchCondition: '>0',
      leftLabel: 'Mainly because they\'re lazy',
      rightLabel: 'Mainly because circumstances make it hard',
      alignmentMap: am(0.6, 0.4, 0.2, ['economy-fiscal-policy']),
    },
  });

  // Q3: Healthcare as commodity vs necessity
  await prisma.question.create({
    data: {
      text: 'Is healthcare more like food or water—something everyone needs to survive—or more like a car—something you can have different amounts of depending on what you can afford?',
      description: 'Viewing healthcare as universal need maps to single-payer or universal coverage support; viewing as commodity maps to market-based systems.',
      categoryId: cat['healthcare-social-safety-net'].id,
      order: 4,
      leftLabel: 'Like food/water—everyone needs the same basics',
      rightLabel: 'Like a car—can vary widely based on resources',
      alignmentMap: am(0.8, 0.3, 0.2, ['personal-liberty-moral-authority', 'civil-rights-social-equality']),
    },
  });

  // Q4: Fraud tolerance vs access barriers
  await prisma.question.create({
    data: {
      text: 'If you had to choose: System A catches every person cheating the system but makes it hard for people genuinely in need to get help, or System B makes it easy for people genuinely in need but some fraudsters slip through. Which system troubles you more?',
      description: 'Prioritizing anti-fraud maps to stricter eligibility; prioritizing access maps to more generous programs.',
      categoryId: cat['healthcare-social-safety-net'].id,
      order: 5,
      leftLabel: 'System B troubles me more (would tighten it)',
      rightLabel: 'System A troubles me more (would loosen it)',
      alignmentMap: am(0.5, 0.3, 0.4, ['institutional-integrity-accountability', 'criminal-justice-public-safety']),
    },
  });

  // Q5: Health outcomes — personal responsibility vs circumstance
  await prisma.question.create({
    data: {
      text: 'When someone has serious health problems—like obesity, addiction, or chronic disease—how much do you think that\'s usually due to their choices versus circumstances like where they grew up, their job, their income, or their genetics?',
      description: 'Attribution to personal choice maps to conditional health interventions; attribution to circumstance maps to universal support.',
      categoryId: cat['healthcare-social-safety-net'].id,
      order: 6,
      leftLabel: 'Mostly their choices',
      rightLabel: 'Mostly circumstances beyond their control',
      alignmentMap: am(0.5, 0.5, 0.2, ['personal-liberty-moral-authority', 'criminal-justice-public-safety']),
    },
  });
  questionCount += 6;

  // ── IMMIGRATION & BORDER POLICY ──────────────

  // Q1: In-group vs universal obligation
  await prisma.question.create({
    data: {
      text: 'Do you feel a different sense of responsibility toward people in your own country versus people in other countries? Should your government prioritize its own citizens even if it means less help for people elsewhere?',
      description: 'Strong in-group prioritization maps to restrictive immigration; belief in equal consideration maps to openness.',
      categoryId: cat['immigration-border-policy'].id,
      order: 1,
      leftLabel: 'Yes, much more responsibility to my own country',
      rightLabel: 'Equal responsibility to all people regardless of country',
      alignmentMap: am(0.3, 0.6, 0.4, ['foreign-policy-national-security', 'democratic-institutions-rule-of-law']),
    },
  });

  // Q2: Cultural diversity as enriching vs threatening
  await prisma.question.create({
    data: {
      text: 'When a community becomes more diverse—different religions, languages, cultural practices—does that feel exciting and enriching to you, or does it feel unsettling and like something is being lost?',
      description: 'Comfort with diversity maps to openness to immigration; discomfort maps to preference for cultural cohesion.',
      categoryId: cat['immigration-border-policy'].id,
      order: 2,
      leftLabel: 'Exciting and enriching',
      rightLabel: 'Unsettling and like something is lost',
      alignmentMap: am(0.1, 0.8, 0.3, ['civil-rights-social-equality']),
    },
  });

  // Q3: Newcomers as contributors vs competitors (REPLACED — original was factual/economic)
  await prisma.question.create({
    data: {
      text: 'When someone new moves into your neighborhood or community, is your first instinct to see them as someone who will contribute and add value, or as someone who might compete for limited resources?',
      description: 'Instinctive framing of newcomers as contributors vs. competitors predicts openness to immigration policy. Replaces factual economics question with dispositional probe.',
      categoryId: cat['immigration-border-policy'].id,
      order: 3,
      leftLabel: 'Will likely contribute and add value',
      rightLabel: 'Might compete for limited resources',
      alignmentMap: am(0.5, 0.5, 0.2, ['economy-fiscal-policy', 'healthcare-social-safety-net']),
    },
  });

  // Q4: Borders as pragmatic vs identity-preserving
  await prisma.question.create({
    data: {
      text: 'Should a country\'s borders and immigration rules be based mainly on what\'s economically or practically best, or should they also preserve something about the country\'s existing culture and identity?',
      description: 'Prioritizing pragmatism maps to more open immigration; prioritizing identity maps to more restrictive borders.',
      categoryId: cat['immigration-border-policy'].id,
      order: 4,
      leftLabel: 'Mainly practical/economic—culture takes second place',
      rightLabel: 'Should also preserve existing culture and identity',
      alignmentMap: am(0.3, 0.7, 0.3, ['democratic-institutions-rule-of-law', 'civil-rights-social-equality']),
    },
  });

  // Q5: Immigrant risk-taking — brave vs irresponsible
  await prisma.question.create({
    data: {
      text: 'How do you see people who risk everything to immigrate to a better life? Do you see that mainly as brave risk-taking, or mainly as irresponsible desperation?',
      description: 'Seeing immigrants as brave risk-takers maps to sympathy-based support; seeing as desperate maps to concern-based restriction.',
      categoryId: cat['immigration-border-policy'].id,
      order: 5,
      leftLabel: 'Mainly brave and admirable risk-taking',
      rightLabel: 'Mainly irresponsible desperation',
      alignmentMap: am(0.2, 0.6, 0.3, ['personal-liberty-moral-authority']),
    },
  });
  questionCount += 5;

  // ── CRIMINAL JUSTICE & PUBLIC SAFETY ──────────

  // Q1: Crime as moral failing vs circumstantial response
  await prisma.question.create({
    data: {
      text: 'When someone commits a crime, do you think that\'s mainly because they\'re a bad person, or mainly because they faced circumstances that pushed them toward it—poverty, abuse, desperation?',
      description: 'Attribution to character maps to punishment-focused justice; attribution to circumstance maps to rehabilitation-focused approaches.',
      categoryId: cat['criminal-justice-public-safety'].id,
      order: 1,
      leftLabel: 'Mainly a personal moral failing',
      rightLabel: 'Mainly circumstances that pushed them to it',
      alignmentMap: am(0.3, 0.5, 0.6, ['healthcare-social-safety-net', 'economy-fiscal-policy']),
    },
  });

  // Q2: Can people change after serious crime?
  await prisma.question.create({
    data: {
      text: 'If someone committed a serious crime years ago but has since shown real change, is that enough to trust them again? Or does serious crime create a permanent mark?',
      description: 'Belief in rehabilitation maps to restorative justice and prisoner reentry support; belief in permanent mark maps to longer sentences and restrictions.',
      categoryId: cat['criminal-justice-public-safety'].id,
      order: 2,
      leftLabel: 'Real change is enough to trust them again',
      rightLabel: 'Serious crime creates a permanent mark',
      alignmentMap: am(0.1, 0.5, 0.7, ['personal-liberty-moral-authority']),
    },
  });

  // Q3: Deterrence — harshness vs certainty
  await prisma.question.create({
    data: {
      text: 'Do you think strict punishments mainly prevent crime by scaring people into following the law, or is the certainty of being caught more important than how harsh the punishment is?',
      description: 'Belief in deterrent effect of harshness maps to support for longer sentences; belief in certainty-based deterrence maps to efficiency-focused approaches.',
      categoryId: cat['criminal-justice-public-safety'].id,
      order: 3,
      leftLabel: 'Harshness of punishment is the main deterrent',
      rightLabel: 'Certainty of being caught matters way more',
      alignmentMap: am(0.2, 0.3, 0.7, ['institutional-integrity-accountability']),
    },
  });

  // Q4: Justice system fairness across wealth (with follow-up)
  const cjQ4 = await prisma.question.create({
    data: {
      text: 'Do you think the criminal justice system treats rich and poor people equally, or does money allow some people to escape consequences that others can\'t?',
      description: 'Belief in systemic fairness maps to satisfaction with status quo; belief in inequality maps to support for reform and oversight.',
      categoryId: cat['criminal-justice-public-safety'].id,
      order: 4,
      leftLabel: 'Treats people equally regardless of money',
      rightLabel: 'Money allows escape from consequences',
      alignmentMap: am(0.4, 0.5, 0.4, ['institutional-integrity-accountability', 'civil-rights-social-equality']),
    },
  });

  // Follow-up: Should the system actively fix it?
  await prisma.question.create({
    data: {
      text: 'Should that inequality be something the system actively tries to fix, or is it just how systems work?',
      description: 'Probes whether acknowledged inequality triggers reform impulse or fatalistic acceptance.',
      categoryId: cat['criminal-justice-public-safety'].id,
      order: 5,
      parentId: cjQ4.id,
      branchCondition: '>0',
      leftLabel: 'Just how systems work — can\'t really fix it',
      rightLabel: 'Should be actively fixed',
      alignmentMap: am(0.4, 0.5, 0.5, ['institutional-integrity-accountability']),
    },
  });

  // Q5: Whose perspective matters most in sentencing
  await prisma.question.create({
    data: {
      text: 'When deciding on a sentence for someone convicted of a crime, what should matter most: what would help the victim heal, what would deter others, what would give the person a real chance to change, or what keeps society safe?',
      description: 'Victim-focused tends toward restorative justice; safety-focused tends toward incapacitation and preventive approaches.',
      categoryId: cat['criminal-justice-public-safety'].id,
      order: 6,
      leftLabel: 'What the victim needs most',
      rightLabel: 'What keeps society safest',
      alignmentMap: am(0.1, 0.4, 0.7, ['democratic-institutions-rule-of-law']),
    },
  });
  questionCount += 6;

  // ── EDUCATION & KNOWLEDGE INSTITUTIONS ───────

  // Q1: Purpose of education — sorting vs development
  await prisma.question.create({
    data: {
      text: 'What\'s the main purpose of education: to sort people into their natural roles in society by talent, or to develop the potential in every person regardless of background?',
      description: 'Sorting-oriented view maps to support for tracking/gifted programs; development-oriented maps to inclusive, mixed-ability approaches.',
      categoryId: cat['education-knowledge-institutions'].id,
      order: 1,
      leftLabel: 'Sort people by talent into roles',
      rightLabel: 'Develop potential in every person',
      alignmentMap: am(0.4, 0.6, 0.2, ['civil-rights-social-equality', 'economy-fiscal-policy']),
    },
  });

  // Q2: Parents vs experts on curriculum
  await prisma.question.create({
    data: {
      text: 'When schools teach something that some parents strongly disagree with, should the school prioritize what parents want for their kids, or prioritize what educators think kids need to learn?',
      description: 'Parental priority maps to curriculum flexibility and school choice; expert priority maps to standards-based approaches.',
      categoryId: cat['education-knowledge-institutions'].id,
      order: 2,
      leftLabel: 'Prioritize what parents want',
      rightLabel: 'Prioritize what educators think is needed',
      alignmentMap: am(0.2, 0.6, 0.5, ['personal-liberty-moral-authority', 'democratic-institutions-rule-of-law']),
    },
  });

  // Q3: Expert trust
  await prisma.question.create({
    data: {
      text: 'When a scientist or expert makes a claim about something, should people generally trust them because they know the field well, or should people be skeptical and want to verify it themselves?',
      description: 'High expert trust maps to support for expert-led institutions; skepticism maps to support for public input and oversight.',
      categoryId: cat['education-knowledge-institutions'].id,
      order: 3,
      leftLabel: 'Generally trust experts—that\'s what expertise is for',
      rightLabel: 'Should verify claims yourself—experts can be wrong or biased',
      alignmentMap: am(0.2, 0.3, 0.7, ['institutional-integrity-accountability', 'technology-information-media']),
    },
  });

  // Q4: Schools — reinforce vs challenge community values
  await prisma.question.create({
    data: {
      text: 'Should schools mostly reinforce the values kids are learning at home and in their community, or should they also expose kids to different viewpoints that might challenge those values?',
      description: 'Value-reinforcement view maps to conservative curriculum preferences; exposure view maps to interdisciplinary/diverse curriculum support.',
      categoryId: cat['education-knowledge-institutions'].id,
      order: 4,
      leftLabel: 'Mostly reinforce home and community values',
      rightLabel: 'Should also expose kids to challenging viewpoints',
      alignmentMap: am(0.1, 0.7, 0.4, ['personal-liberty-moral-authority', 'civil-rights-social-equality']),
    },
  });

  // Q5: School funding inequality
  await prisma.question.create({
    data: {
      text: 'Does it matter if some school districts are much better funded and have better facilities than others, or is that just a natural result of different communities having different resources?',
      description: 'Accepts inequality maps to local funding support; cares about inequality maps to equalization and central funding.',
      categoryId: cat['education-knowledge-institutions'].id,
      order: 5,
      leftLabel: 'Just natural result of different resources',
      rightLabel: 'Definitely matters and should be actively reduced',
      alignmentMap: am(0.6, 0.5, 0.3, ['economy-fiscal-policy', 'civil-rights-social-equality']),
    },
  });
  questionCount += 5;

  // ── ENVIRONMENT & ENERGY ─────────────────────

  // Q1: Hard environmental limits vs ingenuity
  await prisma.question.create({
    data: {
      text: 'Do you think human society will eventually hit hard limits—like running out of resources or destroying the environment—that we can\'t innovate our way past? Or do you think human ingenuity will always find solutions?',
      description: 'Belief in limits maps to support for conservation and carbon restrictions; belief in ingenuity maps to technology-forward approaches.',
      categoryId: cat['environment-energy'].id,
      order: 1,
      leftLabel: 'Will eventually hit hard limits',
      rightLabel: 'Human ingenuity will find solutions',
      alignmentMap: am(0.5, 0.2, 0.3, ['economy-fiscal-policy', 'technology-information-media']),
    },
  });

  // Q2: Individual choice vs government mandate
  await prisma.question.create({
    data: {
      text: 'Which would be more effective: asking people to make eco-friendly choices, rewarding businesses for sustainable practices, or having government set rules that require everyone to be sustainable?',
      description: 'Individual/business focus maps to market-based approaches; government mandate focus maps to regulatory approaches.',
      categoryId: cat['environment-energy'].id,
      order: 2,
      leftLabel: 'Individual and business choices',
      rightLabel: 'Government mandates and rules',
      alignmentMap: am(0.5, 0.2, 0.7, ['personal-liberty-moral-authority', 'democratic-institutions-rule-of-law']),
    },
  });

  // Q3: Urgency and certainty of environmental threats
  await prisma.question.create({
    data: {
      text: 'How confident are you that significant environmental change is happening and will be genuinely harmful to people\'s lives in the next 50 years?',
      description: 'Skepticism maps to lower priority for climate action; high confidence maps to support for aggressive climate policies.',
      categoryId: cat['environment-energy'].id,
      order: 3,
      leftLabel: 'Skeptical—will probably adapt fine',
      rightLabel: 'Very confident—will be genuinely harmful',
      alignmentMap: am(0.4, 0.2, 0.3, ['institutional-integrity-accountability']),
    },
  });

  // Q4: Intrinsic vs instrumental value of nature
  await prisma.question.create({
    data: {
      text: 'Is it important to protect forests, animals, and ecosystems mainly because humans need them, or because they have value in themselves independent of what they do for people?',
      description: 'Anthropocentric view maps to resource-use-focused policies; intrinsic value view maps to preservation-focused policies.',
      categoryId: cat['environment-energy'].id,
      order: 4,
      leftLabel: 'Important mainly because humans need them',
      rightLabel: 'Have value in themselves independent of humans',
      alignmentMap: am(0.3, 0.4, 0.2, ['personal-liberty-moral-authority']),
    },
  });
  questionCount += 4;

  // ── DEMOCRATIC INSTITUTIONS & RULE OF LAW ────

  // Q1: Majority rule vs permanent principles
  await prisma.question.create({
    data: {
      text: 'Should laws and constitutional rules change with what the current majority wants, or should they protect basic principles that even majorities can\'t override—like protecting unpopular minorities?',
      description: 'Majoritarianism maps to support for easier constitutional change; constitutionalism maps to support for strong courts and rights protections.',
      categoryId: cat['democratic-institutions-rule-of-law'].id,
      order: 1,
      leftLabel: 'Change with what current majority wants',
      rightLabel: 'Protect permanent principles majority can\'t override',
      alignmentMap: am(0.2, 0.5, 0.8, ['civil-rights-social-equality', 'personal-liberty-moral-authority']),
    },
  });

  // Q2: Excluding extreme viewpoints from participation
  await prisma.question.create({
    data: {
      text: 'Are there viewpoints or groups so extreme or harmful that it would be okay to exclude them from having a voice in politics? Or should everyone get to participate even if their views seem dangerous?',
      description: 'Exclusionist view maps to support for speech restrictions and deplatforming; inclusionist maps to opposition.',
      categoryId: cat['democratic-institutions-rule-of-law'].id,
      order: 2,
      leftLabel: 'Some groups should be excluded',
      rightLabel: 'Everyone should have voice even if dangerous',
      alignmentMap: am(0.1, 0.6, 0.6, ['personal-liberty-moral-authority', 'technology-information-media']),
    },
  });

  // Q3: Majority power vs checks and balances
  await prisma.question.create({
    data: {
      text: 'When one party or group has overwhelming support from voters, should they be able to govern pretty much how they want, or should there be strong checks and balances even when one side has majority support?',
      description: 'Majoritarian view maps to stronger executive/legislature power; checks-and-balances view maps to court and regulatory strength.',
      categoryId: cat['democratic-institutions-rule-of-law'].id,
      order: 3,
      leftLabel: 'Overwhelming support should translate to power',
      rightLabel: 'Checks and balances matter even with majority support',
      alignmentMap: am(0.2, 0.3, 0.9, ['institutional-integrity-accountability']),
    },
  });

  // Q4: Legal system fairness (with follow-up)
  const diQ4 = await prisma.question.create({
    data: {
      text: 'Do you think the legal system, overall, treats people fairly regardless of who they are, or do you think it\'s systematically rigged against certain groups?',
      description: 'Belief in fairness maps to trust in existing institutions; belief in bias maps to support for reform and systemic change.',
      categoryId: cat['democratic-institutions-rule-of-law'].id,
      order: 4,
      leftLabel: 'Treats people fairly overall',
      rightLabel: 'Systematically rigged against certain groups',
      alignmentMap: am(0.3, 0.6, 0.5, ['institutional-integrity-accountability', 'civil-rights-social-equality']),
    },
  });

  // Follow-up: Fixable vs structural?
  await prisma.question.create({
    data: {
      text: 'Is that something the system can fix by being more careful, or is it baked into the structure and would need deeper change?',
      description: 'Probes whether perceived bias triggers incremental or structural reform impulse.',
      categoryId: cat['democratic-institutions-rule-of-law'].id,
      order: 5,
      parentId: diQ4.id,
      branchCondition: '>0',
      leftLabel: 'Can be fixed by being more careful',
      rightLabel: 'Baked into structure—needs deeper change',
      alignmentMap: am(0.3, 0.6, 0.5, ['civil-rights-social-equality']),
    },
  });
  questionCount += 5;

  // ── INSTITUTIONAL INTEGRITY & ACCOUNTABILITY ─

  // Q1: Trust in power-holders
  await prisma.question.create({
    data: {
      text: 'Do you think people in positions of power generally try to do the right thing, or do they tend to abuse power for personal gain if given the chance?',
      description: 'Trust in power-holders maps to weaker accountability requirements; distrust maps to demand for transparency, checks, and oversight.',
      categoryId: cat['institutional-integrity-accountability'].id,
      order: 1,
      leftLabel: 'Generally try to do the right thing',
      rightLabel: 'Tend to abuse power if given the chance',
      alignmentMap: am(0.3, 0.2, 0.8, ['democratic-institutions-rule-of-law', 'money-in-politics']),
    },
  });

  // Q2: Corruption — rare exceptions or iceberg
  await prisma.question.create({
    data: {
      text: 'How common do you think corruption is among people in government and business leadership—are scandals rare exceptions from basically decent people, or are they just the visible tip of an iceberg?',
      description: 'Exceptions view maps to light oversight; iceberg view maps to support for aggressive anti-corruption measures.',
      categoryId: cat['institutional-integrity-accountability'].id,
      order: 2,
      leftLabel: 'Rare exceptions from basically decent people',
      rightLabel: 'Visible tip of an iceberg',
      alignmentMap: am(0.3, 0.2, 0.7, ['money-in-politics', 'democratic-institutions-rule-of-law']),
    },
  });

  // Q3: Transparency alone vs enforcement
  await prisma.question.create({
    data: {
      text: 'If government decision-making is transparent and people know what happened, is that enough? Or does there need to be enforcement—consequences for breaking rules—for accountability to actually work?',
      description: 'Transparency-focused maps to information-access policies; enforcement-focused maps to prosecution and penalty policies.',
      categoryId: cat['institutional-integrity-accountability'].id,
      order: 3,
      leftLabel: 'Transparency alone is enough',
      rightLabel: 'Need actual enforcement and consequences',
      alignmentMap: am(0.2, 0.2, 0.8, ['democratic-institutions-rule-of-law']),
    },
  });

  // Q4: Institutions self-correct vs need external pressure
  await prisma.question.create({
    data: {
      text: 'When an institution makes a mistake or acts wrongly, do they generally correct themselves once they realize it, or do they usually need external pressure—media, courts, protests—to change?',
      description: 'Self-correction view maps to weaker external oversight requirements; external pressure view maps to support for robust check mechanisms.',
      categoryId: cat['institutional-integrity-accountability'].id,
      order: 4,
      leftLabel: 'Generally self-correct once they realize it',
      rightLabel: 'Usually need external pressure',
      alignmentMap: am(0.2, 0.2, 0.7, ['democratic-institutions-rule-of-law']),
    },
  });
  questionCount += 4;

  // ── MONEY IN POLITICS ────────────────────────

  // Q1: Wealthy influence — solvable or inevitable
  await prisma.question.create({
    data: {
      text: 'Is it realistic to prevent wealthy people from having more political influence than others, or is that just how power works and always will?',
      description: 'Belief in solvability maps to support for campaign finance reform; belief in inevitability maps to acceptance of status quo.',
      categoryId: cat['money-in-politics'].id,
      order: 1,
      leftLabel: 'It\'s realistic to prevent it with right rules',
      rightLabel: 'That\'s just how power works inevitably',
      alignmentMap: am(0.5, 0.2, 0.6, ['democratic-institutions-rule-of-law', 'institutional-integrity-accountability']),
    },
  });

  // Q2: Money enables corruption vs shifts policy
  await prisma.question.create({
    data: {
      text: 'When wealthy donors give money to politicians, do you think the main problem is that it enables literal bribery and corruption, or that it pulls policy in directions favoring the wealthy without being corrupt?',
      description: 'Corruption concern maps to stronger enforcement; policy-pull concern maps to structural finance reform.',
      categoryId: cat['money-in-politics'].id,
      order: 2,
      leftLabel: 'Mainly enables corruption and bribery',
      rightLabel: 'Mainly pulls policy to favor wealthy, not corruption',
      alignmentMap: am(0.5, 0.2, 0.5, ['institutional-integrity-accountability', 'economy-fiscal-policy']),
    },
  });

  // Q3: Campaign spending as speech vs corrosion
  await prisma.question.create({
    data: {
      text: 'Should there be strict limits on how much money people and groups can spend on political campaigns, or is spending money on politics a form of speech that shouldn\'t be restricted?',
      description: 'Support for limits maps to campaign finance restrictions; speech view maps to opposition.',
      categoryId: cat['money-in-politics'].id,
      order: 3,
      leftLabel: 'Strict limits should exist',
      rightLabel: 'Shouldn\'t be restricted—it\'s speech',
      alignmentMap: am(0.5, 0.2, 0.5, ['personal-liberty-moral-authority']),
    },
  });
  questionCount += 3;

  // ── FEDERALISM & POWER DISTRIBUTION ──────────

  // Q1: Central vs dispersed power trust
  await prisma.question.create({
    data: {
      text: 'Generally speaking, do you trust government more when power is centralized at the national level or dispersed to states and local communities? Which is more likely to make decisions close to people?',
      description: 'National trust maps to federalist integration; local trust maps to state/local autonomy support.',
      categoryId: cat['federalism-power-distribution'].id,
      order: 1,
      leftLabel: 'Trust centralized national power more',
      rightLabel: 'Trust dispersed local power more',
      alignmentMap: am(0.4, 0.3, 0.8, ['democratic-institutions-rule-of-law', 'personal-liberty-moral-authority']),
    },
  });

  // Q2: Uniform national standards vs state freedom
  await prisma.question.create({
    data: {
      text: 'Is it important that different states follow roughly the same rules and standards (like health codes, educational requirements, environmental rules), or should states be free to make very different choices?',
      description: 'Uniformity preference maps to national standards support; freedom preference maps to decentralization support.',
      categoryId: cat['federalism-power-distribution'].id,
      order: 2,
      leftLabel: 'Important to have uniform standards',
      rightLabel: 'States should be free to choose differently',
      alignmentMap: am(0.4, 0.3, 0.7, ['education-knowledge-institutions', 'healthcare-social-safety-net']),
    },
  });

  // Q3: National protection of minorities vs state autonomy
  await prisma.question.create({
    data: {
      text: 'If a state majority wants to do something that would hurt minorities in that state, should the national government be able to stop it? Or should states have freedom to decide even if that risks harming minorities?',
      description: 'National protection focus maps to strong federal civil rights enforcement; state autonomy focus maps to devolution support.',
      categoryId: cat['federalism-power-distribution'].id,
      order: 3,
      leftLabel: 'National government should be able to stop it',
      rightLabel: 'States should have freedom to decide',
      alignmentMap: am(0.2, 0.6, 0.7, ['civil-rights-social-equality', 'democratic-institutions-rule-of-law']),
    },
  });
  questionCount += 3;

  // ── FOREIGN POLICY & NATIONAL SECURITY ───────

  // Q1: Cooperative vs zero-sum world
  await prisma.question.create({
    data: {
      text: 'Do you think countries can work together for mutual benefit, or is international relations ultimately a competition where one country\'s gain is another\'s loss?',
      description: 'Cooperative view maps to multilateralism and trade support; competitive view maps to unilateralism and protectionism.',
      categoryId: cat['foreign-policy-national-security'].id,
      order: 1,
      leftLabel: 'Can work together for mutual benefit',
      rightLabel: 'Ultimately competition and zero-sum',
      alignmentMap: am(0.4, 0.3, 0.5, ['democratic-institutions-rule-of-law']),
    },
  });

  // Q2: Military as security vs conflict-creator
  await prisma.question.create({
    data: {
      text: 'Is a strong military the best way to keep your country safe and respected in the world, or does military spending often create conflicts and enemies that reduce security?',
      description: 'Military strength view maps to defense spending support; conflict-creation view maps to military reduction support.',
      categoryId: cat['foreign-policy-national-security'].id,
      order: 2,
      leftLabel: 'Strong military is best security',
      rightLabel: 'Military spending creates conflicts and enemies',
      alignmentMap: am(0.5, 0.2, 0.6, ['economy-fiscal-policy']),
    },
  });

  // Q3: Spreading values — legitimate vs resentment
  await prisma.question.create({
    data: {
      text: 'Is it good for a powerful country to try to spread its system and values around the world, or does that usually create resentment and backfire?',
      description: 'Spreading view maps to interventionist policies; resentment concern maps to restraint and non-interference.',
      categoryId: cat['foreign-policy-national-security'].id,
      order: 3,
      leftLabel: 'Good to spread our values and system',
      rightLabel: 'Creates resentment and usually backfires',
      alignmentMap: am(0.2, 0.4, 0.6, ['personal-liberty-moral-authority']),
    },
  });

  // Q4: Alliances as mutual benefit vs burden
  await prisma.question.create({
    data: {
      text: 'Are military alliances—like NATO or other security partnerships—good deals that make everyone safer, or arrangements where your country ends up paying more to protect others?',
      description: 'Mutual benefit view maps to alliance support; burden view maps to alliance skepticism.',
      categoryId: cat['foreign-policy-national-security'].id,
      order: 4,
      leftLabel: 'Good deals that make everyone safer',
      rightLabel: 'Arrangements where we pay to protect others',
      alignmentMap: am(0.4, 0.2, 0.4, ['immigration-border-policy']),
    },
  });
  questionCount += 4;

  // ── CIVIL RIGHTS & SOCIAL EQUALITY ───────────

  // Q1: Historical injustice — ongoing vs overcome
  await prisma.question.create({
    data: {
      text: 'Does historical injustice—slavery, discrimination, exclusion—create ongoing disadvantages today that would still exist even if discrimination stopped completely? Or has past injustice been mostly overcome?',
      description: 'Ongoing disadvantage view maps to support for remedies; overcome view maps to opposition to targeted programs.',
      categoryId: cat['civil-rights-social-equality'].id,
      order: 1,
      leftLabel: 'Creates ongoing disadvantages today',
      rightLabel: 'Mostly overcome by now',
      alignmentMap: am(0.4, 0.8, 0.3, ['economy-fiscal-policy', 'education-knowledge-institutions']),
    },
  });

  // Q2: Identical treatment vs accounting for starting places
  await prisma.question.create({
    data: {
      text: 'Is fairness about treating everyone the same way regardless of background, or is it about accounting for different starting places so everyone gets a real equal shot?',
      description: 'Equal treatment view maps to colorblind policies; accounting-for-differences view maps to targeted/affirmative policies.',
      categoryId: cat['civil-rights-social-equality'].id,
      order: 2,
      leftLabel: 'Treating everyone identically',
      rightLabel: 'Accounting for different starting places',
      alignmentMap: am(0.4, 0.8, 0.3, ['education-knowledge-institutions', 'healthcare-social-safety-net']),
    },
  });

  // Q3: Discrimination as individual bias vs systemic pattern
  await prisma.question.create({
    data: {
      text: 'When people from different groups have very different outcomes—wealth, health, criminal justice treatment—is that mainly because of individual biases, or does it suggest systemic patterns in how institutions work?',
      description: 'Individual bias view maps to bias-training approaches; systemic pattern view maps to structural reform.',
      categoryId: cat['civil-rights-social-equality'].id,
      order: 3,
      leftLabel: 'Mainly individual biases',
      rightLabel: 'Suggests systemic patterns in institutions',
      alignmentMap: am(0.3, 0.7, 0.4, ['institutional-integrity-accountability', 'criminal-justice-public-safety']),
    },
  });

  // Q4: Group identity relevance to policy
  await prisma.question.create({
    data: {
      text: 'Should government policy ever explicitly consider someone\'s race, gender, or sexual orientation when making decisions, or should these characteristics always be irrelevant?',
      description: 'Identity-blind view maps to opposition to group-based policies; group-account view maps to support for recognition of difference.',
      categoryId: cat['civil-rights-social-equality'].id,
      order: 4,
      leftLabel: 'Should be irrelevant—identity-blind policy',
      rightLabel: 'Should explicitly account for group identity',
      alignmentMap: am(0.3, 0.8, 0.3, ['democratic-institutions-rule-of-law']),
    },
  });
  questionCount += 4;

  // ── TECHNOLOGY, INFORMATION & MEDIA SYSTEMS ──

  // Q1: Tech progress — positive vs creates serious harms
  await prisma.question.create({
    data: {
      text: 'Do new technologies mostly make life better, or do they often create serious problems—addiction, manipulation, job loss, privacy violation—that we don\'t catch until it\'s too late?',
      description: 'Optimism maps to pro-innovation policies; caution maps to support for regulation and precaution.',
      categoryId: cat['technology-information-media'].id,
      order: 1,
      leftLabel: 'Mostly make life better',
      rightLabel: 'Often create serious problems we don\'t catch',
      alignmentMap: am(0.4, 0.3, 0.5, ['institutional-integrity-accountability']),
    },
  });

  // Q2: Platform content rules — private vs government
  await prisma.question.create({
    data: {
      text: 'Should large tech platforms have the right to set their own rules about what content they allow, or should government set rules to make sure important speech isn\'t suppressed?',
      description: 'Platform autonomy maps to tech company freedom; government rules map to regulation and public oversight.',
      categoryId: cat['technology-information-media'].id,
      order: 2,
      leftLabel: 'Platforms should set their own rules',
      rightLabel: 'Government should set content rules',
      alignmentMap: am(0.3, 0.4, 0.6, ['personal-liberty-moral-authority', 'democratic-institutions-rule-of-law']),
    },
  });

  // Q3: Misinformation — fooled vs choose to believe
  await prisma.question.create({
    data: {
      text: 'When people believe false information, is that mainly because they were fooled by clever manipulation, or because they\'re drawn to information that matches what they want to believe?',
      description: 'Fooled view maps to support for content moderation and fact-checking; choice view maps to criticism of censorship.',
      categoryId: cat['technology-information-media'].id,
      order: 3,
      leftLabel: 'Mainly fooled by clever manipulation',
      rightLabel: 'Mainly choose to believe what they want',
      alignmentMap: am(0.2, 0.4, 0.5, ['personal-liberty-moral-authority']),
    },
  });

  // Q4: Privacy — fundamental right vs nothing-to-hide
  await prisma.question.create({
    data: {
      text: 'Is privacy important in itself—something people should be able to have even if they\'re not hiding anything—or is it mainly a concern for people who are actually doing something wrong?',
      description: 'Privacy-as-fundamental maps to strong data protection regulations; nothing-to-hide view maps to security/surveillance acceptance.',
      categoryId: cat['technology-information-media'].id,
      order: 4,
      leftLabel: 'Important in itself for everyone',
      rightLabel: 'Mainly a concern for people doing something wrong',
      alignmentMap: am(0.3, 0.4, 0.6, ['personal-liberty-moral-authority', 'democratic-institutions-rule-of-law']),
    },
  });

  // Q5: Information gatekeepers — concentration of power
  await prisma.question.create({
    data: {
      text: 'Do you think a small number of companies controlling what information most people see is a serious concentration of power that could be abused, or is that just how efficient systems work?',
      description: 'Efficiency view maps to light tech regulation; power-concern view maps to support for breaking up tech concentration.',
      categoryId: cat['technology-information-media'].id,
      order: 5,
      leftLabel: 'Not a serious problem—that\'s how systems work',
      rightLabel: 'Serious concentration of power that could be abused',
      alignmentMap: am(0.5, 0.3, 0.5, ['democratic-institutions-rule-of-law', 'institutional-integrity-accountability']),
    },
  });
  questionCount += 5;

  // ── PERSONAL LIBERTY & MORAL AUTHORITY ───────

  // Q1: Personal choice vs community/moral standards
  await prisma.question.create({
    data: {
      text: 'Should people be free to make their own choices about personal matters—how to live, what to believe, what to do with their body—even if others think those choices are wrong? Or should community or moral standards guide people\'s choices?',
      description: 'Individual freedom maps to libertarian positions; standards view maps to conservative social positions.',
      categoryId: cat['personal-liberty-moral-authority'].id,
      order: 1,
      leftLabel: 'Free to make own choices even if wrong',
      rightLabel: 'Should follow community or moral standards',
      alignmentMap: am(0.2, 0.9, 0.7, ['healthcare-social-safety-net', 'democratic-institutions-rule-of-law']),
    },
  });

  // Q2: Expert guidance vs own judgment
  await prisma.question.create({
    data: {
      text: 'When an expert or authority tells you to do something for your own good, should you generally follow their guidance, or should you trust your own judgment even if you disagree with the expert?',
      description: 'Expert deference maps to support for expert-led interventions; self-trust maps to skepticism of top-down mandates.',
      categoryId: cat['personal-liberty-moral-authority'].id,
      order: 2,
      leftLabel: 'Follow expert guidance',
      rightLabel: 'Trust my own judgment',
      alignmentMap: am(0.2, 0.4, 0.7, ['education-knowledge-institutions', 'healthcare-social-safety-net']),
    },
  });

  // Q3: Rules/consequences vs internal values
  await prisma.question.create({
    data: {
      text: 'Do most people generally do the right thing because of rules and potential consequences, or do most people have internal values that guide them even without external pressure?',
      description: 'Rule-dependence maps to support for enforcement and oversight; value-trust maps to light regulation and personal responsibility.',
      categoryId: cat['personal-liberty-moral-authority'].id,
      order: 3,
      leftLabel: 'Need rules and consequences',
      rightLabel: 'Most have internal values that guide them',
      alignmentMap: am(0.2, 0.4, 0.8, ['institutional-integrity-accountability', 'criminal-justice-public-safety']),
    },
  });

  // Q4: Paternalism — stop harmful self-choices?
  await prisma.question.create({
    data: {
      text: 'If someone is choosing to do something you think is genuinely harmful to themselves—like drug use, unhealthy eating, risky behavior—should society try to stop them, or is it their right to choose even if it harms them?',
      description: 'Paternalist view maps to interventionist policies; autonomy view maps to opposition to mandates.',
      categoryId: cat['personal-liberty-moral-authority'].id,
      order: 4,
      leftLabel: 'Society should try to stop harmful choices',
      rightLabel: 'Right to choose even if harmful to self',
      alignmentMap: am(0.2, 0.6, 0.7, ['healthcare-social-safety-net']),
    },
  });

  // Q5: Absolute morality vs contextual
  await prisma.question.create({
    data: {
      text: 'Do you think there are moral truths that are right and wrong for everyone, or does what\'s moral depend on a person\'s situation, culture, or context?',
      description: 'Universal morality maps to enforcement of moral standards; relativism maps to tolerance for moral diversity.',
      categoryId: cat['personal-liberty-moral-authority'].id,
      order: 5,
      leftLabel: 'Moral truths apply to everyone',
      rightLabel: 'Morality depends on context and perspective',
      alignmentMap: am(0.1, 0.8, 0.5, ['education-knowledge-institutions', 'democratic-institutions-rule-of-law']),
    },
  });
  questionCount += 5;

  console.log(`Created ${questionCount} values-based questions (with ${3} follow-ups)`);

  // ──────────────────────────────────────────────
  // 4. SAMPLE INSTITUTIONS
  // ──────────────────────────────────────────────

  await Promise.all([
    prisma.institution.create({
      data: {
        name: 'U.S. Congress',
        type: 'government',
        description: 'The legislative branch — Senate and House of Representatives',
      },
    }),
    prisma.institution.create({
      data: {
        name: 'Supreme Court of the United States',
        type: 'government',
        description: 'The highest court in the federal judiciary',
      },
    }),
    prisma.institution.create({
      data: {
        name: 'Federal Election Commission',
        type: 'regulatory_body',
        description: 'Regulates campaign finance in federal elections',
      },
    }),
    prisma.institution.create({
      data: {
        name: 'Securities and Exchange Commission',
        type: 'regulatory_body',
        description: 'Regulates securities markets and protects investors',
      },
    }),
  ]);

  console.log('Created institutions');

  // ──────────────────────────────────────────────
  // 5. SAMPLE ACTORS (for corruption map seeding)
  // ──────────────────────────────────────────────

  await Promise.all([
    prisma.politician.create({
      data: {
        name: 'Democratic Party',
        type: 'party',
        description: 'One of the two major political parties in the United States',
        affiliation: 'Democratic',
      },
    }),
    prisma.politician.create({
      data: {
        name: 'Republican Party',
        type: 'party',
        description: 'One of the two major political parties in the United States',
        affiliation: 'Republican',
      },
    }),
  ]);

  console.log('Created political actors');

  // ──────────────────────────────────────────────
  // DONE
  // ──────────────────────────────────────────────

  console.log('\nSeeding complete.');
  console.log(`  ${categories.length} pillars`);
  console.log(`  ${tags.length} tags`);
  console.log(`  ${questionCount} values-based questions`);
  console.log(`  Institutions and political actors`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
