
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { demoMatches, type Match } from './sampleData';
import { predictMatch } from './prediction';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, '../dist');

app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3001);
const SPORTMONKS_TOKEN = process.env.SPORTMONKS_API_TOKEN;

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'elite-match-ai-api' });
});

function dateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateStringValue: string, days: number) {
  const date = new Date(`${dateStringValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateString(date);
}

function lagosDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find(part => part.type === type)?.value || '';

  return `${get('year')}-${get('month')}-${get('day')}`;
}

function mapFixture(fixture: any) {
  const participants = fixture.participants || [];

  const home = participants.find(
    (team: any) => team.meta?.location === 'home'
  );

  const away = participants.find(
    (team: any) => team.meta?.location === 'away'
  );

  const scores = fixture.scores || [];

  const homeScore = scores.find(
    (item: any) =>
      item.score?.participant === 'home' &&
      item.description === 'CURRENT'
  );

  const awayScore = scores.find(
    (item: any) =>
      item.score?.participant === 'away' &&
      item.description === 'CURRENT'
  );

  return {
    id: String(fixture.id),
    homeTeamId: home?.id ? String(home.id) : null,
    awayTeamId: away?.id ? String(away.id) : null,
    competition: fixture.league?.name || 'Football',
    kickoff: fixture.starting_at
      ? `${fixture.starting_at.replace(' ', 'T')}Z`
      : '',
    home: home?.name || 'Home team',
    away: away?.name || 'Away team',
    status:
      fixture.state?.developer_name ||
      fixture.state?.name ||
      'UNKNOWN',
    score:
      homeScore && awayScore
        ? `${homeScore.score.goals}-${awayScore.score.goals}`
        : null,
    dataLabel: 'SPORTMONKS'
  };
}

async function sportmonksGet(url: URL) {
  if (!SPORTMONKS_TOKEN) {
    throw new Error('SPORTMONKS_API_TOKEN is not configured.');
  }

  const response = await fetch(url, {
    headers: {
      Authorization: SPORTMONKS_TOKEN,
      Accept: 'application/json'
    },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error(`Sportmonks returned HTTP ${response.status}`);
  }

  const result: any = await response.json();

  if (!Array.isArray(result.data) && !result.data) {
    throw new Error('Unexpected Sportmonks response.');
  }

  return result.data;
}

async function getSportmonksFixtures() {
  const startDate = lagosDate(new Date());
  const endDate = addDays(startDate, 7);

  const url = new URL(
    `https://api.sportmonks.com/v3/football/fixtures/between/${startDate}/${endDate}`
  );

  url.searchParams.set(
    'include',
    'participants;league;state;scores'
  );
  url.searchParams.set('per_page', '50');

  const data = await sportmonksGet(url);

  if (!Array.isArray(data)) {
    throw new Error('Unexpected fixtures response.');
  }

  return data.map(mapFixture);
}

type TeamMatch = {
  fixtureId: string;
  opponent: string;
  date: string;
  result: 'W' | 'D' | 'L';
  goalsFor: number;
  goalsAgainst: number;
};

async function getTeamRecentMatches(teamId: string) {
  const endDate = lagosDate(new Date());
  const startDate = addDays(endDate, -365);

  const url = new URL(
    `https://api.sportmonks.com/v3/football/fixtures/between/${startDate}/${endDate}/${teamId}`
  );

  url.searchParams.set(
    'include',
    'participants;league;state;scores'
  );
  url.searchParams.set('order', 'desc');
  url.searchParams.set('per_page', '50');

  const data = await sportmonksGet(url);

  if (!Array.isArray(data)) {
    throw new Error('Unexpected team fixtures response.');
  }

  const finishedStates = [
    'FT',
    'AET',
    'FT_PEN',
    'FINISHED',
    'AFTER_EXTRA_TIME',
    'AFTER_PENALTIES'
  ];

  const completed: TeamMatch[] = [];

  for (const fixture of data) {
    const state =
      fixture.state?.developer_name ||
      fixture.state?.name ||
      '';

    if (!finishedStates.includes(String(state).toUpperCase())) {
      continue;
    }

    const participants = fixture.participants || [];

    const home = participants.find(
      (team: any) => team.meta?.location === 'home'
    );

    const away = participants.find(
      (team: any) => team.meta?.location === 'away'
    );

    if (!home || !away) continue;

    const scores = fixture.scores || [];

    const homeScore = scores.find(
      (item: any) =>
        item.score?.participant === 'home' &&
        item.description === 'CURRENT'
    );

    const awayScore = scores.find(
      (item: any) =>
        item.score?.participant === 'away' &&
        item.description === 'CURRENT'
    );

    if (
      homeScore?.score?.goals == null ||
      awayScore?.score?.goals == null
    ) {
      continue;
    }

    const homeGoals = Number(homeScore.score.goals);
    const awayGoals = Number(awayScore.score.goals);

    if (!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) {
      continue;
    }

    const isHome = String(home.id) === teamId;

    if (!isHome && String(away.id) !== teamId) {
      continue;
    }

    const goalsFor = isHome ? homeGoals : awayGoals;
    const goalsAgainst = isHome ? awayGoals : homeGoals;

    const result: 'W' | 'D' | 'L' =
      goalsFor > goalsAgainst
        ? 'W'
        : goalsFor === goalsAgainst
        ? 'D'
        : 'L';

    completed.push({
      fixtureId: String(fixture.id),
      opponent: isHome ? away.name : home.name,
      date: fixture.starting_at || '',
      result,
      goalsFor,
      goalsAgainst
    });
  }

  return completed.slice(0, 5);
}

function summarizeTeam(matches: TeamMatch[]) {
  const count = matches.length;

  const goalsFor = matches.reduce(
    (total, match) => total + match.goalsFor,
    0
  );

  const goalsAgainst = matches.reduce(
    (total, match) => total + match.goalsAgainst,
    0
  );

  return {
    matchesPlayed: count,
    form: matches.map(match => match.result),
    wins: matches.filter(match => match.result === 'W').length,
    draws: matches.filter(match => match.result === 'D').length,
    losses: matches.filter(match => match.result === 'L').length,
    goalsScored: goalsFor,
    goalsConceded: goalsAgainst,
    averageGoalsScored: count
      ? Number((goalsFor / count).toFixed(2))
      : null,
    averageGoalsConceded: count
      ? Number((goalsAgainst / count).toFixed(2))
      : null,
    recentMatches: matches
  };
}

app.get('/api/matches', async (_req, res) => {
  try {
    const matches = await getSportmonksFixtures();

    return res.json({
      source: 'SPORTMONKS',
      live: true,
      matches
    });
  } catch (error) {
    console.error('Sportmonks fixtures error:', error);

    return res.json({
      source: 'DEMO_DATA',
      live: false,
      warning: 'Real fixtures are temporarily unavailable.',
      matches: demoMatches
    });
  }
});

// Real recent form and goals for both teams.
app.get('/api/team-stats/:homeTeamId/:awayTeamId', async (req, res) => {
  const { homeTeamId, awayTeamId } = req.params;

  if (
    !/^\d+$/.test(homeTeamId) ||
    !/^\d+$/.test(awayTeamId) ||
    homeTeamId === awayTeamId
  ) {
    return res.status(400).json({
      error: 'Valid, different Sportmonks team IDs are required.'
    });
  }

  try {
    const [homeMatches, awayMatches] = await Promise.all([
      getTeamRecentMatches(homeTeamId),
      getTeamRecentMatches(awayTeamId)
    ]);

    return res.json({
      source: 'SPORTMONKS',
      sampleSize: 5,
      home: summarizeTeam(homeMatches),
      away: summarizeTeam(awayMatches),
      notice:
        'Statistics use available completed fixtures. A team may have fewer than five matches if the data is unavailable.'
    });
  } catch (error) {
    console.error('Team statistics error:', error);

    return res.status(502).json({
      error: 'Unable to retrieve real team statistics right now.',
      source: 'SPORTMONKS'
    });
  }
});

app.get('/api/predictions', (_req, res) => {
  res.json({
    source: 'DEMO_DATA',
    disclaimer:
      'Illustrative output using sample fixtures; not a live betting tip.',
    predictions: demoMatches.map(match => ({
      matchId: match.id,
      ...predictMatch(match)
    }))
  });
});

const schema = z.object({
  home: z.string().min(1).max(80),
  away: z.string().min(1).max(80),
  homeGoalsFor: z.number().min(0).max(8),
  homeGoalsAgainst: z.number().min(0).max(8),
  awayGoalsFor: z.number().min(0).max(8),
  awayGoalsAgainst: z.number().min(0).max(8)
});

app.post('/api/analyze', (req, res) => {
  const parsed = schema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid match inputs',
      details: parsed.error.flatten()
    });
  }

  const values = parsed.data;

  const match: Match = {
    id: 'custom',
    competition: 'Custom analysis',
    kickoff: new Date().toISOString(),
    home: values.home,
    away: values.away,
    status: 'SCHEDULED',
    score: null,
    homeForm: [],
    awayForm: [],
    homeGF: values.homeGoalsFor,
    homeGA: values.homeGoalsAgainst,
    awayGF: values.awayGoalsFor,
    awayGA: values.awayGoalsAgainst,
    dataLabel: 'DEMO'
  };

  return res.json({
    source: 'MODEL_FROM_USER_INPUT',
    ...predictMatch(match)
  });
});

// Serve the built React frontend.
app.use(express.static(distPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }

  res.sendFile(path.join(distPath, 'index.html'), error => {
    if (error) next(error);
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Elite Match AI API listening on ${PORT}`);
});
  
