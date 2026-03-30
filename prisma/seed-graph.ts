import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

/**
 * GRAPH SEED DATA — Corruption Map
 *
 * The Powell Memo → Citizens United pipeline
 *
 * This seeds the actor relationship graph with documented connections
 * tracing the legalization of corporate influence in American politics
 * from the early 1970s through the 2010s.
 *
 * All relationships are real and documented. Sources noted in descriptions.
 */

async function main() {
  console.log('Seeding graph data...\n');

  // ──────────────────────────────────────────────
  // 1. ACTORS (Politicians, Organizations, etc.)
  // ──────────────────────────────────────────────

  const actors: Record<string, { name: string; type: string; description: string; title?: string; affiliation?: string; tags?: string }> = {
    powell: {
      name: 'Lewis F. Powell Jr.',
      type: 'politician',
      description: 'Corporate lawyer who authored the Powell Memo (1971) urging corporate America to aggressively influence politics and courts. Appointed to Supreme Court by Nixon two months later.',
      title: 'Associate Justice, U.S. Supreme Court (1972–1987)',
      affiliation: 'Republican',
      tags: JSON.stringify(['powell memo', 'citizens united pipeline', 'corporate influence', 'nixon appointee']),
    },
    nixon: {
      name: 'Richard Nixon',
      type: 'politician',
      description: 'Appointed Lewis Powell to the Supreme Court in 1971, just two months after Powell wrote the memo that would reshape corporate influence in American politics.',
      title: '37th President of the United States',
      affiliation: 'Republican',
      tags: JSON.stringify(['watergate', 'supreme court appointments']),
    },
    uschamber: {
      name: 'U.S. Chamber of Commerce',
      type: 'organization',
      description: 'The Powell Memo was addressed to the Chamber. It became the blueprint for corporate political mobilization. The Chamber grew into the largest dark money spender in U.S. politics.',
      tags: JSON.stringify(['dark money', 'lobbying', 'powell memo', 'corporate influence']),
    },
    heritage: {
      name: 'Heritage Foundation',
      type: 'organization',
      description: 'Founded in 1973 by Paul Weyrich and Edwin Feulner with funding from Joseph Coors, directly inspired by the Powell Memo\'s call for conservative intellectual infrastructure.',
      tags: JSON.stringify(['powell memo pipeline', 'conservative think tank', 'koch network', 'project 2025']),
    },
    cato: {
      name: 'Cato Institute',
      type: 'organization',
      description: 'Libertarian think tank co-founded by Charles Koch in 1977. Part of the intellectual infrastructure the Powell Memo called for.',
      tags: JSON.stringify(['koch network', 'libertarian', 'deregulation']),
    },
    federalist_society: {
      name: 'Federalist Society',
      type: 'organization',
      description: 'Founded in 1982 to promote originalist and textualist legal philosophy. Became the dominant pipeline for conservative judicial appointments. Funded by Koch network, Scaife, and Olin foundations.',
      tags: JSON.stringify(['judicial pipeline', 'dark money', 'koch network', 'supreme court']),
    },
    koch_charles: {
      name: 'Charles Koch',
      type: 'corporation',
      description: 'Co-founder of Koch Industries political network. Co-founded Cato Institute. Major funder of Heritage Foundation, Federalist Society, Americans for Prosperity, and dozens of other organizations designed to shift policy rightward.',
      title: 'CEO, Koch Industries',
      tags: JSON.stringify(['koch network', 'dark money', 'citizens united', 'deregulation']),
    },
    koch_david: {
      name: 'David Koch',
      type: 'corporation',
      description: 'Co-founder of Koch political network. 1980 Libertarian VP candidate. Major funder of Americans for Prosperity and conservative policy infrastructure.',
      title: 'Executive VP, Koch Industries',
      tags: JSON.stringify(['koch network', 'dark money', 'americans for prosperity']),
    },
    afp: {
      name: 'Americans for Prosperity',
      type: 'pac',
      description: 'Founded 2004 by David Koch and Richard Fink. Dark money advocacy group that became one of the largest political spending organizations in the U.S. Key player in Tea Party mobilization.',
      tags: JSON.stringify(['koch network', 'dark money', 'tea party', 'anti-regulation']),
    },
    scaife: {
      name: 'Richard Mellon Scaife',
      type: 'corporation',
      description: 'Billionaire heir to Mellon banking fortune. Major funder of Heritage Foundation, Federalist Society, and conservative media infrastructure.',
      title: 'Publisher, Pittsburgh Tribune-Review',
      tags: JSON.stringify(['dark money', 'conservative funding', 'heritage foundation']),
    },
    olin: {
      name: 'John M. Olin Foundation',
      type: 'organization',
      description: 'Conservative foundation that funded law & economics programs at major universities and the Federalist Society. Spent $370M+ promoting free-market ideology in academia before closing in 2005.',
      tags: JSON.stringify(['dark money', 'federalist society', 'law and economics', 'academic capture']),
    },
    weyrich: {
      name: 'Paul Weyrich',
      type: 'lobbyist',
      description: 'Conservative activist who co-founded Heritage Foundation (1973), ALEC (1973), and the Moral Majority (1979). Key architect of the New Right coalition.',
      title: 'Co-founder, Heritage Foundation & ALEC',
      tags: JSON.stringify(['heritage foundation', 'ALEC', 'moral majority', 'new right']),
    },
    alec: {
      name: 'American Legislative Exchange Council (ALEC)',
      type: 'organization',
      description: 'Founded 1973 by Paul Weyrich. Produces model legislation for state legislatures drafted by corporate members. Koch Industries, ExxonMobil, and PhRMA are major funders.',
      tags: JSON.stringify(['model legislation', 'corporate influence', 'state politics', 'koch network']),
    },
    citizens_united_org: {
      name: 'Citizens United',
      type: 'organization',
      description: 'Conservative nonprofit that brought the landmark Supreme Court case Citizens United v. FEC (2010), which ruled that corporate political spending is protected speech.',
      tags: JSON.stringify(['citizens united', 'campaign finance', 'dark money']),
    },
    roberts: {
      name: 'John Roberts',
      type: 'politician',
      description: 'Chief Justice who authored the majority opinion in McCutcheon v. FEC and presided over Citizens United. Federalist Society member. Appointed by George W. Bush.',
      title: 'Chief Justice, U.S. Supreme Court (2005–present)',
      affiliation: 'Republican',
      tags: JSON.stringify(['federalist society', 'citizens united', 'campaign finance']),
    },
    kennedy: {
      name: 'Anthony Kennedy',
      type: 'politician',
      description: 'Authored the majority opinion in Citizens United v. FEC (2010), ruling that the First Amendment prohibits restrictions on independent political expenditures by corporations.',
      title: 'Associate Justice, U.S. Supreme Court (1988–2018)',
      affiliation: 'Republican',
      tags: JSON.stringify(['citizens united', 'campaign finance', 'reagan appointee']),
    },
    thomas: {
      name: 'Clarence Thomas',
      type: 'politician',
      description: 'Joined Citizens United majority. Has faced scrutiny for undisclosed gifts from Harlan Crow and other conservative donors with business before the Court.',
      title: 'Associate Justice, U.S. Supreme Court (1991–present)',
      affiliation: 'Republican',
      tags: JSON.stringify(['citizens united', 'harlan crow', 'ethics violations', 'federalist society']),
    },
    alito: {
      name: 'Samuel Alito',
      type: 'politician',
      description: 'Joined Citizens United majority. Federalist Society member. Has faced scrutiny for undisclosed trips funded by conservative donors.',
      title: 'Associate Justice, U.S. Supreme Court (2006–2025)',
      affiliation: 'Republican',
      tags: JSON.stringify(['citizens united', 'federalist society', 'ethics concerns']),
    },
    scalia: {
      name: 'Antonin Scalia',
      type: 'politician',
      description: 'Joined Citizens United majority. Founding faculty adviser of the Federalist Society. Champion of originalist interpretation.',
      title: 'Associate Justice, U.S. Supreme Court (1986–2016)',
      affiliation: 'Republican',
      tags: JSON.stringify(['citizens united', 'federalist society', 'originalism', 'reagan appointee']),
    },
    crow: {
      name: 'Harlan Crow',
      type: 'corporation',
      description: 'Billionaire real estate developer. Major conservative donor who provided undisclosed luxury travel, property deals, and private school tuition for Clarence Thomas over two decades.',
      title: 'Chairman, Crow Holdings',
      tags: JSON.stringify(['dark money', 'clarence thomas', 'judicial ethics', 'conservative donor']),
    },
    leonard_leo: {
      name: 'Leonard Leo',
      type: 'lobbyist',
      description: 'Co-chairman of the Federalist Society and architect of the conservative supermajority on the Supreme Court. Controls a network of dark money nonprofits that spent $600M+ on judicial confirmation battles.',
      title: 'Co-chairman, Federalist Society',
      tags: JSON.stringify(['federalist society', 'dark money', 'judicial appointments', 'supreme court']),
    },
    mcconnell: {
      name: 'Mitch McConnell',
      type: 'politician',
      description: 'Senate Majority Leader who blocked Merrick Garland\'s nomination and fast-tracked three Trump Supreme Court picks. Long-time opponent of campaign finance reform. Named plaintiff in McConnell v. FEC.',
      title: 'U.S. Senator, Kentucky (1985–present)',
      affiliation: 'Republican',
      tags: JSON.stringify(['campaign finance', 'supreme court', 'garland blockade', 'citizens united supporter']),
    },
    buckley_v_valeo: {
      name: 'Buckley v. Valeo (1976)',
      type: 'organization',
      description: 'Supreme Court ruling that equated money with speech, striking down spending limits while allowing contribution limits. Powell concurred. Set the legal foundation for Citizens United 34 years later.',
      tags: JSON.stringify(['money is speech', 'campaign finance', 'supreme court', 'first amendment']),
    },
    citizens_united_case: {
      name: 'Citizens United v. FEC (2010)',
      type: 'organization',
      description: 'Supreme Court ruling that corporations and unions can spend unlimited amounts on elections. Kennedy authored. Roberts, Scalia, Thomas, Alito joined. Opened the floodgates for dark money in politics.',
      tags: JSON.stringify(['citizens united', 'dark money', 'campaign finance', 'supreme court']),
    },
    mccutcheon: {
      name: 'McCutcheon v. FEC (2014)',
      type: 'organization',
      description: 'Supreme Court ruling striking down aggregate contribution limits. Roberts authored. Further eroded campaign finance restrictions post-Citizens United.',
      tags: JSON.stringify(['campaign finance', 'supreme court', 'aggregate limits']),
    },
    reagan: {
      name: 'Ronald Reagan',
      type: 'politician',
      description: 'Appointed Scalia and Kennedy to the Supreme Court. His presidency represented the political fruition of the conservative infrastructure Powell\'s memo inspired.',
      title: '40th President of the United States',
      affiliation: 'Republican',
      tags: JSON.stringify(['supreme court appointments', 'deregulation', 'conservative revolution']),
    },
    gw_bush: {
      name: 'George W. Bush',
      type: 'politician',
      description: 'Appointed Roberts and Alito to the Supreme Court, both of whom joined the Citizens United majority. Federalist Society influenced both selections.',
      title: '43rd President of the United States',
      affiliation: 'Republican',
      tags: JSON.stringify(['supreme court appointments', 'federalist society influence']),
    },
    ghw_bush: {
      name: 'George H.W. Bush',
      type: 'politician',
      description: 'Appointed Clarence Thomas to the Supreme Court in 1991.',
      title: '41st President of the United States',
      affiliation: 'Republican',
      tags: JSON.stringify(['supreme court appointments']),
    },
    coors: {
      name: 'Joseph Coors',
      type: 'corporation',
      description: 'Coors Brewing Company chairman. Provided seed funding for the Heritage Foundation in 1973 after reading the Powell Memo. Also funded ALEC and other conservative infrastructure.',
      title: 'Chairman, Coors Brewing Company',
      tags: JSON.stringify(['heritage foundation', 'powell memo', 'conservative funding', 'ALEC']),
    },
  };

  // Create all actors
  const created: Record<string, { id: string; name: string }> = {};
  for (const [key, data] of Object.entries(actors)) {
    const actor = await prisma.politician.upsert({
      where: { name: data.name },
      update: data,
      create: data,
    });
    created[key] = { id: actor.id, name: actor.name };
    console.log(`  ✓ ${data.name}`);
  }

  console.log(`\nCreated ${Object.keys(created).length} actors\n`);

  // ──────────────────────────────────────────────
  // 2. EVIDENCE (key documents and sources)
  // ──────────────────────────────────────────────

  const evidenceData = [
    {
      title: 'The Powell Memo (1971)',
      sourceUrl: 'https://scholarlycommons.law.wlu.edu/powellmemo/',
      sourceClassification: 'primary_source',
      summary: 'Confidential memo from Lewis Powell to the U.S. Chamber of Commerce, August 23, 1971, urging corporate America to aggressively fight back against critics through media, academia, courts, and politics.',
      publishedAt: new Date('1971-08-23'),
    },
    {
      title: 'Citizens United v. Federal Election Commission, 558 U.S. 310 (2010)',
      sourceUrl: 'https://supreme.justia.com/cases/federal/us/558/310/',
      sourceClassification: 'primary_source',
      summary: 'Supreme Court ruling that the free speech clause of the First Amendment prohibits the government from restricting independent expenditures for political campaigns by corporations.',
      publishedAt: new Date('2010-01-21'),
    },
    {
      title: 'Buckley v. Valeo, 424 U.S. 1 (1976)',
      sourceUrl: 'https://supreme.justia.com/cases/federal/us/424/1/',
      sourceClassification: 'primary_source',
      summary: 'Supreme Court ruling equating political spending with protected speech under the First Amendment, while upholding contribution limits.',
      publishedAt: new Date('1976-01-30'),
    },
    {
      title: 'McCutcheon v. Federal Election Commission, 572 U.S. 185 (2014)',
      sourceUrl: 'https://supreme.justia.com/cases/federal/us/572/185/',
      sourceClassification: 'primary_source',
      summary: 'Supreme Court ruling striking down aggregate limits on individual campaign contributions.',
      publishedAt: new Date('2014-04-02'),
    },
    {
      title: 'ProPublica: Clarence Thomas and the Billionaire',
      sourceUrl: 'https://www.propublica.org/article/clarence-thomas-scotus-undisclosed-luxury-travel-harlan-crow',
      sourceClassification: 'secondary_source',
      summary: 'Investigation revealing decades of undisclosed luxury travel, property transactions, and private school tuition provided to Justice Clarence Thomas by billionaire Harlan Crow.',
      publishedAt: new Date('2023-04-06'),
    },
    {
      title: 'The New Yorker: The Kochs\' Covert Operations',
      sourceUrl: 'https://www.newyorker.com/magazine/2010/08/30/covert-operations',
      sourceClassification: 'secondary_source',
      summary: 'Jane Mayer\'s investigation into Charles and David Koch\'s political network and its influence on American politics.',
      publishedAt: new Date('2010-08-30'),
    },
    {
      title: 'Leonard Leo\'s $600M Dark Money Network',
      sourceUrl: 'https://www.propublica.org/article/leonard-leo-dark-money-list-of-political-nonprofits',
      sourceClassification: 'secondary_source',
      summary: 'Investigation revealing the scale of Leonard Leo\'s network of dark money nonprofits used to reshape the federal judiciary.',
      publishedAt: new Date('2023-11-19'),
    },
  ];

  const evidence: Record<string, { id: string }> = {};
  for (const ev of evidenceData) {
    // Check if evidence already exists by title
    let record = await prisma.evidence.findFirst({ where: { title: ev.title } });
    if (!record) {
      record = await prisma.evidence.create({ data: ev });
    }
    evidence[ev.title] = { id: record.id };
    console.log(`  📄 ${ev.title}`);
  }

  console.log(`\nCreated ${Object.keys(evidence).length} evidence records\n`);

  // ──────────────────────────────────────────────
  // 3. RELATIONSHIPS
  // ──────────────────────────────────────────────

  type RelData = {
    sourceKey: string;
    targetKey: string;
    tier: string;
    relationshipType: string;
    significance: number;
    description: string;
    startDate?: Date;
    endDate?: Date;
    amount?: number;
    evidenceKeys?: string[];
  };

  const relationships: RelData[] = [
    // ── Powell Memo → Infrastructure ──
    {
      sourceKey: 'powell',
      targetKey: 'uschamber',
      tier: 'documented',
      relationshipType: 'authored',
      significance: 5,
      description: 'Wrote the Powell Memo (Aug 23, 1971) to the U.S. Chamber of Commerce, laying out a strategy for corporate political mobilization through media, courts, and academia.',
      startDate: new Date('1971-08-23'),
      evidenceKeys: ['The Powell Memo (1971)'],
    },
    {
      sourceKey: 'nixon',
      targetKey: 'powell',
      tier: 'documented',
      relationshipType: 'appointed_by',
      significance: 5,
      description: 'Nixon nominated Powell to the Supreme Court on Oct 21, 1971 — exactly two months after the Powell Memo. Powell was confirmed and served 1972–1987.',
      startDate: new Date('1971-10-21'),
    },
    {
      sourceKey: 'powell',
      targetKey: 'buckley_v_valeo',
      tier: 'documented',
      relationshipType: 'ruled_on',
      significance: 5,
      description: 'Powell concurred in Buckley v. Valeo (1976), which equated political money with protected speech — the foundational precedent for Citizens United.',
      startDate: new Date('1976-01-30'),
      evidenceKeys: ['Buckley v. Valeo, 424 U.S. 1 (1976)'],
    },

    // ── Heritage Foundation founding ──
    {
      sourceKey: 'weyrich',
      targetKey: 'heritage',
      tier: 'documented',
      relationshipType: 'founded',
      significance: 5,
      description: 'Co-founded the Heritage Foundation in 1973, inspired by the Powell Memo\'s call for conservative intellectual infrastructure.',
      startDate: new Date('1973-02-16'),
    },
    {
      sourceKey: 'coors',
      targetKey: 'heritage',
      tier: 'documented',
      relationshipType: 'funded_by',
      significance: 4,
      description: 'Provided $250,000 in seed funding to establish the Heritage Foundation after reading the Powell Memo.',
      startDate: new Date('1973-01-01'),
      amount: 250000,
      evidenceKeys: ['The Powell Memo (1971)'],
    },
    {
      sourceKey: 'scaife',
      targetKey: 'heritage',
      tier: 'documented',
      relationshipType: 'funded_by',
      significance: 4,
      description: 'Major donor to the Heritage Foundation. The Scaife Foundation provided millions in funding through the 1970s–2000s.',
      startDate: new Date('1973-01-01'),
    },

    // ── ALEC ──
    {
      sourceKey: 'weyrich',
      targetKey: 'alec',
      tier: 'documented',
      relationshipType: 'founded',
      significance: 4,
      description: 'Co-founded ALEC in 1973, creating a pipeline for corporate-drafted model legislation into state legislatures.',
      startDate: new Date('1973-09-01'),
    },
    {
      sourceKey: 'coors',
      targetKey: 'alec',
      tier: 'documented',
      relationshipType: 'funded_by',
      significance: 3,
      description: 'Coors was an early funder of ALEC alongside the Heritage Foundation.',
      startDate: new Date('1973-09-01'),
    },
    {
      sourceKey: 'koch_charles',
      targetKey: 'alec',
      tier: 'documented',
      relationshipType: 'funded_by',
      significance: 4,
      description: 'Koch Industries became one of ALEC\'s largest corporate funders, paying for corporate membership and model legislation development.',
      startDate: new Date('1990-01-01'),
    },

    // ── Koch Network ──
    {
      sourceKey: 'koch_charles',
      targetKey: 'cato',
      tier: 'documented',
      relationshipType: 'founded',
      significance: 5,
      description: 'Co-founded the Cato Institute in 1977 as a libertarian think tank promoting deregulation and limited government.',
      startDate: new Date('1977-01-01'),
    },
    {
      sourceKey: 'koch_david',
      targetKey: 'afp',
      tier: 'documented',
      relationshipType: 'founded',
      significance: 5,
      description: 'Co-founded Americans for Prosperity in 2004. AFP became one of the largest dark money political organizations in the country.',
      startDate: new Date('2004-01-01'),
      evidenceKeys: ['The New Yorker: The Kochs\' Covert Operations'],
    },
    {
      sourceKey: 'koch_charles',
      targetKey: 'afp',
      tier: 'documented',
      relationshipType: 'funded_by',
      significance: 5,
      description: 'Koch Industries network provided primary funding for Americans for Prosperity, which spent hundreds of millions on political campaigns.',
      startDate: new Date('2004-01-01'),
      evidenceKeys: ['The New Yorker: The Kochs\' Covert Operations'],
    },
    {
      sourceKey: 'koch_charles',
      targetKey: 'heritage',
      tier: 'documented',
      relationshipType: 'funded_by',
      significance: 4,
      description: 'Koch network provided significant funding to Heritage Foundation.',
      startDate: new Date('1980-01-01'),
    },
    {
      sourceKey: 'koch_charles',
      targetKey: 'federalist_society',
      tier: 'documented',
      relationshipType: 'funded_by',
      significance: 4,
      description: 'Koch network funded the Federalist Society as part of broader judicial influence strategy.',
      startDate: new Date('1990-01-01'),
    },

    // ── Federalist Society ──
    {
      sourceKey: 'scaife',
      targetKey: 'federalist_society',
      tier: 'documented',
      relationshipType: 'funded_by',
      significance: 4,
      description: 'Scaife foundations provided early and sustained funding for the Federalist Society.',
      startDate: new Date('1982-01-01'),
    },
    {
      sourceKey: 'olin',
      targetKey: 'federalist_society',
      tier: 'documented',
      relationshipType: 'funded_by',
      significance: 5,
      description: 'The Olin Foundation was a founding funder of the Federalist Society and provided sustained support until the foundation closed in 2005.',
      startDate: new Date('1982-01-01'),
      endDate: new Date('2005-11-01'),
    },
    {
      sourceKey: 'leonard_leo',
      targetKey: 'federalist_society',
      tier: 'documented',
      relationshipType: 'member_of',
      significance: 5,
      description: 'Co-chairman of the Federalist Society. Used the organization as the base for a $600M+ dark money network that reshaped the federal judiciary.',
      startDate: new Date('1990-01-01'),
      evidenceKeys: ['Leonard Leo\'s $600M Dark Money Network'],
    },
    {
      sourceKey: 'scalia',
      targetKey: 'federalist_society',
      tier: 'documented',
      relationshipType: 'member_of',
      significance: 4,
      description: 'Founding faculty adviser of the Federalist Society at the University of Chicago Law School.',
      startDate: new Date('1982-01-01'),
    },

    // ── Supreme Court Appointments ──
    {
      sourceKey: 'reagan',
      targetKey: 'scalia',
      tier: 'documented',
      relationshipType: 'appointed_by',
      significance: 5,
      description: 'Reagan appointed Scalia to the Supreme Court in 1986. Scalia served until his death in 2016.',
      startDate: new Date('1986-09-26'),
    },
    {
      sourceKey: 'reagan',
      targetKey: 'kennedy',
      tier: 'documented',
      relationshipType: 'appointed_by',
      significance: 5,
      description: 'Reagan appointed Kennedy to the Supreme Court in 1988 after Bork\'s nomination failed.',
      startDate: new Date('1988-02-18'),
    },
    {
      sourceKey: 'ghw_bush',
      targetKey: 'thomas',
      tier: 'documented',
      relationshipType: 'appointed_by',
      significance: 5,
      description: 'George H.W. Bush appointed Thomas to the Supreme Court in 1991.',
      startDate: new Date('1991-10-23'),
    },
    {
      sourceKey: 'gw_bush',
      targetKey: 'roberts',
      tier: 'documented',
      relationshipType: 'appointed_by',
      significance: 5,
      description: 'George W. Bush appointed Roberts as Chief Justice in 2005. Federalist Society influenced the selection.',
      startDate: new Date('2005-09-29'),
    },
    {
      sourceKey: 'gw_bush',
      targetKey: 'alito',
      tier: 'documented',
      relationshipType: 'appointed_by',
      significance: 5,
      description: 'George W. Bush appointed Alito in 2006. Federalist Society vetted and recommended the nomination.',
      startDate: new Date('2006-01-31'),
    },

    // ── Leonard Leo's Influence ──
    {
      sourceKey: 'leonard_leo',
      targetKey: 'roberts',
      tier: 'interactional',
      relationshipType: 'lobbied',
      significance: 4,
      description: 'Leo\'s Federalist Society network was instrumental in vetting and promoting Roberts\' nomination to Chief Justice.',
      startDate: new Date('2005-01-01'),
      evidenceKeys: ['Leonard Leo\'s $600M Dark Money Network'],
    },
    {
      sourceKey: 'leonard_leo',
      targetKey: 'alito',
      tier: 'interactional',
      relationshipType: 'lobbied',
      significance: 4,
      description: 'Leo personally led the confirmation campaign for Alito through the Federalist Society network.',
      startDate: new Date('2005-10-01'),
      evidenceKeys: ['Leonard Leo\'s $600M Dark Money Network'],
    },

    // ── Citizens United case connections ──
    {
      sourceKey: 'kennedy',
      targetKey: 'citizens_united_case',
      tier: 'documented',
      relationshipType: 'ruled_on',
      significance: 5,
      description: 'Authored the majority opinion in Citizens United v. FEC, ruling that corporate political spending is protected speech under the First Amendment.',
      startDate: new Date('2010-01-21'),
      evidenceKeys: ['Citizens United v. Federal Election Commission, 558 U.S. 310 (2010)'],
    },
    {
      sourceKey: 'roberts',
      targetKey: 'citizens_united_case',
      tier: 'documented',
      relationshipType: 'ruled_on',
      significance: 4,
      description: 'Joined the majority in Citizens United. Later authored McCutcheon v. FEC further eroding campaign finance limits.',
      startDate: new Date('2010-01-21'),
      evidenceKeys: ['Citizens United v. Federal Election Commission, 558 U.S. 310 (2010)'],
    },
    {
      sourceKey: 'scalia',
      targetKey: 'citizens_united_case',
      tier: 'documented',
      relationshipType: 'ruled_on',
      significance: 4,
      description: 'Joined the Citizens United majority and wrote a concurrence emphasizing originalist free speech grounds.',
      startDate: new Date('2010-01-21'),
      evidenceKeys: ['Citizens United v. Federal Election Commission, 558 U.S. 310 (2010)'],
    },
    {
      sourceKey: 'thomas',
      targetKey: 'citizens_united_case',
      tier: 'documented',
      relationshipType: 'ruled_on',
      significance: 4,
      description: 'Joined Citizens United majority. Wrote separately arguing disclosure requirements should also be struck down.',
      startDate: new Date('2010-01-21'),
      evidenceKeys: ['Citizens United v. Federal Election Commission, 558 U.S. 310 (2010)'],
    },
    {
      sourceKey: 'alito',
      targetKey: 'citizens_united_case',
      tier: 'documented',
      relationshipType: 'ruled_on',
      significance: 4,
      description: 'Joined Citizens United majority.',
      startDate: new Date('2010-01-21'),
      evidenceKeys: ['Citizens United v. Federal Election Commission, 558 U.S. 310 (2010)'],
    },
    {
      sourceKey: 'citizens_united_org',
      targetKey: 'citizens_united_case',
      tier: 'documented',
      relationshipType: 'founded',
      significance: 5,
      description: 'Citizens United brought the case that resulted in the landmark Supreme Court decision.',
      startDate: new Date('2008-01-01'),
    },

    // ── McCutcheon ──
    {
      sourceKey: 'roberts',
      targetKey: 'mccutcheon',
      tier: 'documented',
      relationshipType: 'ruled_on',
      significance: 5,
      description: 'Roberts authored the McCutcheon majority opinion striking down aggregate contribution limits.',
      startDate: new Date('2014-04-02'),
      evidenceKeys: ['McCutcheon v. Federal Election Commission, 572 U.S. 185 (2014)'],
    },

    // ── Thomas/Crow ──
    {
      sourceKey: 'crow',
      targetKey: 'thomas',
      tier: 'documented',
      relationshipType: 'funded_by',
      significance: 5,
      description: 'Harlan Crow provided decades of undisclosed luxury travel, a $267K real estate deal, and private school tuition for Thomas\'s grandnephew. Thomas did not disclose these on financial forms.',
      startDate: new Date('1996-01-01'),
      amount: 2500000,
      evidenceKeys: ['ProPublica: Clarence Thomas and the Billionaire'],
    },

    // ── McConnell ──
    {
      sourceKey: 'mcconnell',
      targetKey: 'leonard_leo',
      tier: 'interactional',
      relationshipType: 'communicated_with',
      significance: 4,
      description: 'McConnell coordinated with Leo on judicial confirmation strategy, including the blockade of Merrick Garland and fast-tracking of Trump nominees.',
      startDate: new Date('2016-02-01'),
    },

    // ── Buckley → Citizens United pipeline ──
    {
      sourceKey: 'buckley_v_valeo',
      targetKey: 'citizens_united_case',
      tier: 'analytical',
      relationshipType: 'enabled',
      significance: 5,
      description: 'Buckley\'s "money is speech" doctrine provided the legal foundation that Citizens United extended to corporate spending. Without Buckley, CU has no precedent.',
      startDate: new Date('1976-01-30'),
      endDate: new Date('2010-01-21'),
      evidenceKeys: ['Buckley v. Valeo, 424 U.S. 1 (1976)', 'Citizens United v. Federal Election Commission, 558 U.S. 310 (2010)'],
    },
  ];

  let relCount = 0;
  for (const rel of relationships) {
    const source = created[rel.sourceKey];
    const target = created[rel.targetKey];
    if (!source || !target) {
      console.error(`  ✗ Missing actor: ${rel.sourceKey} or ${rel.targetKey}`);
      continue;
    }

    try {
      const relationship = await prisma.actorRelationship.create({
        data: {
          sourceId: source.id,
          targetId: target.id,
          tier: rel.tier,
          relationshipType: rel.relationshipType,
          significance: rel.significance,
          description: rel.description,
          startDate: rel.startDate,
          endDate: rel.endDate,
          amount: rel.amount,
        },
      });

      // Link evidence
      if (rel.evidenceKeys) {
        for (const evKey of rel.evidenceKeys) {
          const ev = evidence[evKey];
          if (ev) {
            await prisma.actorRelationshipEvidence.create({
              data: {
                relationshipId: relationship.id,
                evidenceId: ev.id,
              },
            });
          }
        }
      }

      relCount++;
      console.log(`  → ${source.name} ─[${rel.relationshipType}]→ ${target.name}`);
    } catch (err) {
      // Skip duplicates (unique constraint)
      console.log(`  ~ Skipped duplicate: ${source.name} → ${target.name}`);
    }
  }

  console.log(`\nCreated ${relCount} relationships`);
  console.log('\nGraph seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
