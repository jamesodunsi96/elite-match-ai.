
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

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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

async function getSportmonksFixtures() {
  if (!SPORTMONKS_TOKEN) {
    throw new Error('SPORTMONKS_API_TOKEN is not configured.');
  }

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

  if (!Array.isArray(result.data)) {
    throw new Error('Unexpected Sportmonks response.');
  }

  return result.data.map(mapFixture);
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

// Keep API requests separate from the frontend fallback.
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
    
