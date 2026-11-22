

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
  res.json({
    ok: true,
    service: 'elite-match-ai-api'
  });
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

// Save generated picks to Supabase.
async function savePicksToSupabase(picks: any[]) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { submitted: 0, configured: false };
  }

  if (picks.length === 0) {
    return { submitted: 0, configured: true };
  }

  const predictionDay = lagosDate(new Date());

  const rows = picks.map((pick: any) => ({
    match_id: String(pick.matchId),
    prediction_day: predictionDay,
    competition: pick.competition || 'Football',
    kickoff: pick.kickoff || null,
    home_team: pick.home,
    away_team: pick.away,
    market: pick.market,
    estimated_probability: pick.estimatedProbability,
    expected_home_goals: pick.expectedGoals?.home ?? null,
    expected_away_goals: pick.expectedGoals?.away ?? null,
    model: pick.model || 'Unknown',
    model_status: pick.modelStatus || 'EXPERIMENTAL_NOT_VALIDATED',
    status: 'PENDING'
  }));

  const endpoint = new URL('/rest/v1/predictions', supabaseUrl);

  endpoint.searchParams.set(
    'on_conflict',
    'match_id,market,prediction_day'
  );

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal'
    },
    body: JSON.stringify(rows),
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(
      `Supabase save failed (HTTP ${response.status}): ${detail}`
    );
  }

  return { submitted: rows.length, configured: true };
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
  const detail = await response.text();
  throw new Error(
    `Sportmonks returned HTTP ${response.status}: ${detail}`
  );
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
  venue: 'HOME' | 'AWAY';
  result: 'W' | 'D' | 'L';
  goalsFor: number;
  goalsAgainst: number;
};

async function getTeamRecentMatches(teamId: string, limit = 5) {
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

    if (
      !Number.isFinite(homeGoals) ||
      !Number.isFinite(awayGoals)
    ) {
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
  venue: isHome ? 'HOME' : 'AWAY',
  result,
  goalsFor,
  goalsAgainst
});
  }

  return completed.slice(0, limit);
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

// ELITE MATCH AI BEST PICKS ENGINE

type BestPickCache = {
  expiresAt: number;
  payload: any;
};

let bestPicksCache: BestPickCache | null = null;

function getMarketCandidates(probabilities: any) {
  return [
    {
      market: 'Home or Draw',
      probability: probabilities.homeOrDraw
    },
    {
      market: 'Away or Draw',
      probability: probabilities.awayOrDraw
    },
    {
      market: 'Over 1.5 Goals',
      probability: probabilities.over15
    },
    {
      market: 'Under 3.5 Goals',
      probability: probabilities.under35
    },
    {
      market: 'BTTS - Yes',
      probability: probabilities.bttsYes
    },
    {
      market: 'BTTS - No',
      probability: probabilities.bttsNo
    },
    {
      market: 'Over 2.5 Goals',
      probability: probabilities.over25
    }
  ].filter(
    item =>
      typeof item.probability === 'number' &&
      Number.isFinite(item.probability)
  );
}

async function analyseFixtureForBestPick(fixture: any) {
  if (!fixture.homeTeamId || !fixture.awayTeamId) {
    return null;
  }

  try {
    const [homeMatches, awayMatches] = await Promise.all([
      getTeamRecentMatches(fixture.homeTeamId),
      getTeamRecentMatches(fixture.awayTeamId)
    ]);

    const homeStats = summarizeTeam(homeMatches);
    const awayStats = summarizeTeam(awayMatches);

    if (
      homeStats.matchesPlayed < 4 ||
      awayStats.matchesPlayed < 4
    ) {
      return null;
    }

    const match: Match = {
      id: fixture.id,
      competition: fixture.competition,
      kickoff: fixture.kickoff,
      home: fixture.home,
      away: fixture.away,
      status: fixture.status,
      score: null,
      homeForm: homeStats.form,
      awayForm: awayStats.form,
      homeGF: homeStats.averageGoalsScored!,
      homeGA: homeStats.averageGoalsConceded!,
      awayGF: awayStats.averageGoalsScored!,
      awayGA: awayStats.averageGoalsConceded!,
      dataLabel: 'DEMO'
    };

    const prediction = predictMatch(match);

    const candidates = getMarketCandidates(
      prediction.probabilities
    );

    candidates.sort(
      (a, b) => b.probability - a.probability
    );

    const bestMarket = candidates[0];

    if (!bestMarket || bestMarket.probability < 65) {
      return null;
    }

    const riskFlags: string[] = [];

    if (
      homeStats.matchesPlayed < 5 ||
      awayStats.matchesPlayed < 5
    ) {
      riskFlags.push(
        'One or both teams have fewer than five recent matches.'
      );
    }

    riskFlags.push(
      'Model probabilities are not calibrated or backtested.'
    );

    riskFlags.push(
      'Confirmed lineups and injury information are not included.'
    );

    const reasons = [
      `${fixture.home} recent average goals scored: ${homeStats.averageGoalsScored}.`,
      `${fixture.away} recent average goals scored: ${awayStats.averageGoalsScored}.`,
      `${fixture.home} recent average goals conceded: ${homeStats.averageGoalsConceded}.`,
      `${fixture.away} recent average goals conceded: ${awayStats.averageGoalsConceded}.`
    ];

    return {
      matchId: fixture.id,
      competition: fixture.competition,
      kickoff: fixture.kickoff,
      home: fixture.home,
      away: fixture.away,
      market: bestMarket.market,
      estimatedProbability: bestMarket.probability,
      expectedGoals: prediction.expectedGoals,
      sampleSize: {
        home: homeStats.matchesPlayed,
        away: awayStats.matchesPlayed
      },
      recentForm: {
        home: homeStats.form,
        away: awayStats.form
      },
      reasons,
      riskFlags,
      model: prediction.model,
      modelStatus: 'ILLUSTRATIVE_NOT_VALIDATED'
    };
  } catch (error) {
    console.error(
      `Best Picks analysis failed for fixture ${fixture.id}:`,
      error
    );

    return null;
  }
}

// Automatically analyse and rank upcoming fixtures.
app.get('/api/best-picks', async (_req, res) => {
  if (
    bestPicksCache &&
    bestPicksCache.expiresAt > Date.now()
  ) {
    return res.json({
      ...bestPicksCache.payload,
      cached: true
    });
  }

  try {
    const allFixtures = await getSportmonksFixtures();

    const upcomingFixtures = allFixtures
      .filter((fixture: any) => {
        const kickoffTime = Date.parse(fixture.kickoff);

        return (
          fixture.homeTeamId &&
          fixture.awayTeamId &&
          Number.isFinite(kickoffTime) &&
          kickoffTime > Date.now()
        );
      })
      .slice(0, 12);

    const picks: any[] = [];

    for (let i = 0; i < upcomingFixtures.length; i += 2) {
      const batch = upcomingFixtures.slice(i, i + 2);

      const results = await Promise.all(
        batch.map(analyseFixtureForBestPick)
      );

      for (const result of results) {
        if (result) picks.push(result);
      }
    }

    picks.sort(
      (a, b) =>
        b.estimatedProbability - a.estimatedProbability
    );

    const payload = {
      source: 'SPORTMONKS',
      engine: 'ELITE_MATCH_AI_100.0_BEST_PICKS',
      modelStatus: 'EXPERIMENTAL_NOT_VALIDATED',
      generatedAt: new Date().toISOString(),
      fixturesFound: allFixtures.length,
      fixturesAnalysed: upcomingFixtures.length,
      picksReturned: Math.min(picks.length, 10),
      minimumEstimatedProbability: 65,
      picks: picks.slice(0, 10),
      notice:
        'These are experimental statistical estimates, not verified betting probabilities or guaranteed outcomes. A 65% screening threshold is not proof of a 65% real-world chance. No pick is better than a weak pick.'
    };

    let archive: {
      submitted: number;
      configured: boolean;
    } = {
      submitted: 0,
      configured: Boolean(
        process.env.SUPABASE_URL &&
        process.env.SUPABASE_SECRET_KEY
      )
    };

    try {
      archive = await savePicksToSupabase(payload.picks);
    } catch (archiveError) {
      console.error(
        'Supabase prediction archive error:',
        archiveError
      );
    }

    const responsePayload = {
      ...payload,
      archive: {
        configured: archive.configured,
        submitted: archive.submitted
      }
    };

    bestPicksCache = {
      expiresAt: Date.now() + 15 * 60 * 1000,
      payload: responsePayload
    };

    return res.json({
      ...responsePayload,
      cached: false
    });
  } catch (error) {
    console.error('Automatic Best Picks error:', error);

    return res.status(502).json({
      source: 'SPORTMONKS',
      engine: 'ELITE_MATCH_AI_100.0_BEST_PICKS',
      error: 'Unable to generate Best Picks right now.',
      picks: [],
      notice:
        'The engine could not retrieve or analyse the required live data. No predictions have been invented.'
    });
  }
});

// Get real fixtures from Sportmonks.
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

// Get recent statistics for both teams.
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

// Get detailed fixture, player and match statistics.
app.get('/api/fixture-details/:fixtureId', async (req, res) => {
  const { fixtureId } = req.params;

  console.log('Received fixture ID:', JSON.stringify(fixtureId));

if (!fixtureId || !/^[0-9]+$/.test(String(fixtureId))) {
    return res.status(400).json({
      error: 'A valid Sportmonks fixture ID is required.'
    });
  }

  try {
    const url = new URL(
      `https://api.sportmonks.com/v3/football/fixtures/${fixtureId}`
    );

    url.searchParams.set(
      'include',
      'participants;league;state;scores;events.type;lineups.player;lineups.position;lineups.details.type;statistics.type'
    );

    const fixture = await sportmonksGet(url);

    if (!fixture || Array.isArray(fixture)) {
      return res.status(404).json({
        error: 'Fixture details were not found.',
        source: 'SPORTMONKS'
      });
    }

    return res.json({
      source: 'SPORTMONKS',
      fixture,
      notice:
        'Player lineups and statistics may be unavailable until Sportmonks receives the relevant match data.'
    });
  } catch (error) {
    console.error('Fixture details error:', error);

    return res.status(502).json({
      error: 'Unable to retrieve fixture details right now.',
      source: 'SPORTMONKS'
    });
  }
});

// Get a player's registered team records and transfer history.
app.get('/api/player-team-records/:playerId', async (req, res) => {
  const { playerId } = req.params;

  if (!/^\d+$/.test(playerId)) {
    return res.status(400).json({
      error: 'A valid Sportmonks player ID is required.'
    });
  }

  try {
    const url = new URL(
      `https://api.sportmonks.com/v3/football/players/${playerId}`
    );

    url.searchParams.set(
      'include',
      'teams.team;transfers'
    );

    const player = await sportmonksGet(url);

    if (!player || Array.isArray(player)) {
      return res.status(404).json({
        error: 'Player team records were not found.',
        source: 'SPORTMONKS'
      });
    }

    return res.json({
      source: 'SPORTMONKS',
      player,
      notice:
        'Team records and transfers are provider data. They must be checked against the fixture season before confirming a player.'
    });
  } catch (error) {
    console.error('Player team records error:', error);

    return res.status(502).json({
      error: 'Unable to retrieve player team records.',
      source: 'SPORTMONKS'
    });
  }
});
// Verify fixture-listed players against their registered club on match date.
app.get('/api/verify-fixture-players/:fixtureId', async (req, res) => {
  const { fixtureId } = req.params;

  if (!/^\d+$/.test(fixtureId)) {
    return res.status(400).json({
      error: 'A valid Sportmonks fixture ID is required.'
    });
  }

  try {
    const fixtureUrl = new URL(
      `https://api.sportmonks.com/v3/football/fixtures/${fixtureId}`
    );

    fixtureUrl.searchParams.set(
      'include',
      'participants;lineups.player'
    );

    const fixture = await sportmonksGet(fixtureUrl);

    if (!fixture || Array.isArray(fixture)) {
      return res.status(404).json({
        error: 'Fixture not found.',
        source: 'SPORTMONKS'
      });
    }

    const matchDate = String(fixture.starting_at || '').slice(0, 10);

    if (!matchDate) {
      return res.status(422).json({
        error: 'Fixture date is unavailable.'
      });
    }

    const lineups = fixture.lineups || [];
    const uniquePlayers = new Map();

    for (const item of lineups) {
      if (!item.player_id || !item.team_id) continue;

      const playerId = String(item.player_id);

      if (!uniquePlayers.has(playerId)) {
        uniquePlayers.set(playerId, {
          playerId,
          teamId: Number(item.team_id),
          playerName:
            item.player?.display_name ||
            item.player?.name ||
            item.player_name ||
            'Unknown player'
        });
      }
    }

    const players = Array.from(uniquePlayers.values());
    const results: Array<{
  playerId: string;
  playerName: string;
  fixtureTeamId: number;
  status: string;
  registeredTeam: string | null;
  reason: string;
}> = [];
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < players.length) {
        const index = nextIndex++;
        const item = players[index];

        try {
          const playerUrl = new URL(
            `https://api.sportmonks.com/v3/football/players/${item.playerId}`
          );

          playerUrl.searchParams.set(
            'include',
            'teams.team;transfers'
          );

          const player = await sportmonksGet(playerUrl);
          const registrations: any[] = (player?.teams || []).filter(
  (record: any) =>
    record.team?.type === 'domestic' &&
    record.start &&
    record.team_id
);

          const activeRecords: any[] = registrations.filter((record: any) => {
  const started = String(record.start).slice(0, 10);
  const ended = record.end
    ? String(record.end).slice(0, 10)
    : null;

  return started <= matchDate &&
    (!ended || ended >= matchDate);
});
          const matchingRecord = activeRecords.find(
            record => Number(record.team_id) === item.teamId
          );

          let status = 'UNVERIFIED';
          let reason = 'No dated domestic club registration was available.';

          if (matchingRecord) {
            status = 'VERIFIED';
            reason = 'Club registration matches the fixture team on the match date.';
          } else if (activeRecords.length > 0) {
            status = 'MISMATCH';
            reason = 'Dated club registration points to a different team.';
          }

          results.push({
            playerId: item.playerId,
            playerName: item.playerName,
            fixtureTeamId: item.teamId,
            status,
            registeredTeam: matchingRecord?.team?.name ||
              activeRecords[0]?.team?.name ||
              null,
            reason
          });
        } catch (error) {
          results.push({
            playerId: item.playerId,
            playerName: item.playerName,
            fixtureTeamId: item.teamId,
            status: 'UNVERIFIED',
            registeredTeam: null,
            reason: 'Unable to retrieve player registration records.'
          });
        }
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(4, players.length) },
        () => worker()
      )
    );

    const verified = results.filter(p => p.status === 'VERIFIED').length;
    const mismatches = results.filter(p => p.status === 'MISMATCH').length;
    const unverified = results.filter(p => p.status === 'UNVERIFIED').length;

    return res.json({
      source: 'SPORTMONKS',
      fixtureId,
      matchDate,
      totalChecked: results.length,
      verified,
      mismatches,
      unverified,
      players: results,
      notice: 'Registration verification does not confirm starting lineups or guarantee provider data accuracy.'
    });
  } catch (error) {
    console.error('Fixture player verification error:', error);

    return res.status(502).json({
      error: 'Unable to verify fixture players.',
      source: 'SPORTMONKS'
    });
  }
});
// Cache player season statistics for 24 hours.
const playerSeasonStatsCache = new Map<
  string,
  { data: any; expiresAt: number }
>();
// Get an individual player's season statistics.
app.get('/api/player-season-stats/:playerId/:seasonId', async (req, res) => {
  const { playerId, seasonId } = req.params;

  if (!/^\d+$/.test(playerId) || !/^\d+$/.test(seasonId)) {
    return res.status(400).json({
      error: 'Valid player and season IDs are required.'
    });
  }
const cacheKey = `${playerId}:${seasonId}`;
const cachedEntry = playerSeasonStatsCache.get(cacheKey);

if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
  return res.json({
    ...cachedEntry.data,
    cached: true
  });
}

if (cachedEntry) {
  playerSeasonStatsCache.delete(cacheKey);
}
  try {
    const url = new URL(
      `https://api.sportmonks.com/v3/football/players/${playerId}`
    );

    url.searchParams.set(
      'include',
      'statistics.details.type'
    );

    url.searchParams.set(
      'filters',
      `playerStatisticSeasons:${seasonId}`
    );

    const player = await sportmonksGet(url);

    if (!player || Array.isArray(player)) {
      return res.status(404).json({
        error: 'Player statistics were not found.',
        source: 'SPORTMONKS'
      });
    }

    const responseData = {
  source: 'SPORTMONKS',
  player,
  seasonId
};

playerSeasonStatsCache.set(cacheKey, {
  data: responseData,
  expiresAt: Date.now() + 24 * 60 * 60 * 1000
});

return res.json(responseData);
  } catch (error) {
    console.error('Player season statistics error:', error);

    const message =
  error instanceof Error ? error.message : 'Unknown error';

const rateLimited = message.includes('HTTP 429');

return res.status(rateLimited ? 429 : 502).json({
  error: rateLimited
    ? 'Sportmonks rate limit reached. Please try again later.'
    : 'Unable to retrieve player season statistics.',
  source: 'SPORTMONKS'
});
  }
});

// Generate a prediction using real recent team statistics.
app.get('/api/analyze/:homeTeamId/:awayTeamId', async (req, res) => {
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

    const homeStats = summarizeTeam(homeMatches);
    const awayStats = summarizeTeam(awayMatches);

    if (
      homeStats.matchesPlayed < 3 ||
      awayStats.matchesPlayed < 3
    ) {
      return res.status(422).json({
        error: 'Not enough recent matches for a statistical estimate.',
        source: 'SPORTMONKS',
        home: homeStats,
        away: awayStats
      });
    }

    const match: Match = {
      id: 'sportmonks-analysis',
      competition: 'Real match analysis',
      kickoff: new Date().toISOString(),
      home: 'Home team',
      away: 'Away team',
      status: 'SCHEDULED',
      score: null,
      homeForm: homeStats.form,
      awayForm: awayStats.form,
      homeGF: homeStats.averageGoalsScored!,
      homeGA: homeStats.averageGoalsConceded!,
      awayGF: awayStats.averageGoalsScored!,
      awayGA: awayStats.averageGoalsConceded!,
      dataLabel: 'DEMO'
    };

    const prediction = predictMatch(match);

    return res.json({
      source: 'SPORTMONKS',
      live: true,
      sampleSize: {
        home: homeStats.matchesPlayed,
        away: awayStats.matchesPlayed
      },
      home: homeStats,
      away: awayStats,
      prediction,
      disclaimer:
        'Estimates based on recent completed matches. Not guaranteed betting outcomes.'
    });
  } catch (error) {
    console.error('Real match analysis error:', error);

    return res.status(502).json({
      error: 'Unable to generate real match analysis right now.',
      source: 'SPORTMONKS'
    });
  }
});


// 
// Read saved predictions and calculate performance without repeated daily copies.
app.get('/api/performance', async (_req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({
      error: 'Prediction archive is not configured.',
      source: 'SUPABASE'
    });
  }

  try {
    const endpoint = new URL('/rest/v1/predictions', supabaseUrl);

    endpoint.searchParams.set(
      'select',
      'id,match_id,prediction_day,competition,kickoff,home_team,away_team,market,estimated_probability,status,actual_home_score,actual_away_score,created_at'
    );
    endpoint.searchParams.set('order', 'created_at.desc');
    endpoint.searchParams.set('limit', '100');

    const response = await fetch(endpoint, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`Supabase read failed: HTTP ${response.status}`);
    }

    const records = await response.json();

    // Use the earliest saved copy for each match and market.
    const orderedRecords = [...records].sort(
      (a: any, b: any) =>
        new Date(a.created_at).getTime() -
        new Date(b.created_at).getTime()
    );

    const uniquePicks = new Map<string, any>();

    for (const row of orderedRecords) {
      const key = `${row.match_id}:${row.market}`;

      if (!uniquePicks.has(key)) {
        uniquePicks.set(key, row);
      }
    }

    const performanceRecords = Array.from(uniquePicks.values());

    const won = performanceRecords.filter(
      (row: any) => row.status === 'WON'
    ).length;

    const lost = performanceRecords.filter(
      (row: any) => row.status === 'LOST'
    ).length;

    const pending = performanceRecords.filter(
      (row: any) => row.status === 'PENDING'
    ).length;

    const settled = won + lost;

    return res.json({
      source: 'SUPABASE',
      total: performanceRecords.length,
      entries: records.length,
      pending,
      won,
      lost,
      settled,
      accuracy: settled > 0
        ? Number(((won / settled) * 100).toFixed(1))
        : null,
      records: performanceRecords
    });
  } catch (error) {
    console.error('Supabase performance read error:', error);

    return res.status(502).json({
      error: 'Unable to load saved prediction records.',
      source: 'SUPABASE'
    });
  }
});

// Automatically settle predictions with verified full-time scores.
app.post('/api/settle-predictions', async (req, res) => {
  const settlementSecret = process.env.SETTLEMENT_CRON_SECRET;
  const suppliedSecret = req.headers['x-settlement-secret'];

  if (
    !settlementSecret ||
    typeof suppliedSecret !== 'string' ||
    suppliedSecret !== settlementSecret
  ) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey || !SPORTMONKS_TOKEN) {
    return res.status(500).json({
      error: 'Server configuration is incomplete.'
    });
  }

  try {
    const endpoint = new URL(`${supabaseUrl}/rest/v1/predictions`);

    endpoint.searchParams.set('select', 'id,match_id,market');
    endpoint.searchParams.set('status', 'eq.PENDING');
    endpoint.searchParams.append('kickoff', 'not.is.null');
    endpoint.searchParams.append(
      'kickoff',
      `lte.${new Date().toISOString()}`
    );
    endpoint.searchParams.set('order', 'kickoff.asc');
    endpoint.searchParams.set('limit', '50');

    const pendingResponse = await fetch(endpoint, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!pendingResponse.ok) {
      throw new Error('Could not read pending predictions.');
    }

    const pending = await pendingResponse.json();

    if (!pending.length) {
      return res.json({
        checked: 0,
        settled: 0,
        message: 'No pending predictions are ready for settlement.'
      });
    }
const ids = [
  ...new Set(
    pending
      .map((row: any) => String(row.match_id))
      .filter((id: string) => /^\d+$/.test(id))
  )
];

    if (!ids.length) {
      return res.json({
        checked: pending.length,
        settled: 0,
        message: 'No valid fixture IDs were found.'
      });
    }

    const fixtures = await sportmonksGet(
  new URL(
    `https://api.sportmonks.com/v3/football/fixtures/multi/${ids.join(',')}?include=state;scores`
  )
);

    let settled = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const row of pending) {
      const fixture = fixtures.find(
        (item: any) => String(item.id) === String(row.match_id)
      );

      if (!fixture) {
        skipped++;
        continue;
      }

      const state = String(
        fixture.state?.developer_name || fixture.state?.name || ''
      ).toUpperCase();

      if (!['FT', 'FINISHED', 'FULL_TIME'].includes(state)) {
        skipped++;
        continue;
      }

      const currentScores = (fixture.scores || []).filter(
        (item: any) => item.description === 'CURRENT'
      );

      const homeScore = currentScores.find(
        (item: any) => item.score?.participant === 'home'
      )?.score?.goals;

      const awayScore = currentScores.find(
        (item: any) => item.score?.participant === 'away'
      )?.score?.goals;

      if (
        !Number.isInteger(homeScore) ||
        !Number.isInteger(awayScore)
      ) {
        skipped++;
        continue;
      }

      const totalGoals = homeScore + awayScore;
      const market = String(row.market).trim().toLowerCase();

      let won: boolean | null = null;

      if (market === 'over 1.5 goals') won = totalGoals >= 2;
      else if (market === 'under 1.5 goals') won = totalGoals <= 1;
      else if (market === 'over 2.5 goals') won = totalGoals >= 3;
      else if (market === 'under 2.5 goals') won = totalGoals <= 2;
      else if (market === 'under 3.5 goals') won = totalGoals <= 3;
      else if (
        ['btts yes', 'btts - yes', 'both teams to score - yes'].includes(market)
      ) won = homeScore > 0 && awayScore > 0;
      else if (
        ['btts no', 'btts - no', 'both teams to score - no'].includes(market)
      ) won = homeScore === 0 || awayScore === 0;
      else if (['home or draw', '1x'].includes(market))
        won = homeScore >= awayScore;
      else if (['away or draw', 'x2'].includes(market))
        won = awayScore >= homeScore;
      else if (['home win', '1'].includes(market))
        won = homeScore > awayScore;
      else if (['draw', 'x'].includes(market))
        won = homeScore === awayScore;
      else if (['away win', '2'].includes(market))
        won = awayScore > homeScore;

      if (won === null) {
        skipped++;
        continue;
      }

      const updateUrl = new URL(
        `${supabaseUrl}/rest/v1/predictions`
      );

      updateUrl.searchParams.set('id', `eq.${row.id}`);
      updateUrl.searchParams.set('status', 'eq.PENDING');

      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          status: won ? 'WON' : 'LOST',
          actual_home_score: homeScore,
          actual_away_score: awayScore
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (!updateResponse.ok) {
        skipped++;
        continue;
      }

      settled++;
      results.push({
        match_id: row.match_id,
        market: row.market,
        status: won ? 'WON' : 'LOST',
        score: `${homeScore}-${awayScore}`
      });
    }

    return res.json({
      checked: pending.length,
      settled,
      skipped,
      results
    });
  } catch (error) {
    console.error('Prediction settlement error:', error);

    return res.status(502).json({
      error: 'Settlement could not be completed.'
    });
  }
});
// Demo predictions.
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

// Analyze a match using manually supplied statistics.
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
  console.log(`Elite Match AI API listening on port ${PORT}`);
});
