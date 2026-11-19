
import type { Match } from './sampleData';

function poisson(lambda: number, goals: number): number {
  let factorial = 1;

  for (let i = 2; i <= goals; i++) {
    factorial *= i;
  }

  return (
    Math.exp(-lambda) *
    Math.pow(lambda, goals) /
    factorial
  );
}

const clamp = (n: number) =>
  Math.max(0.15, Math.min(4.2, n));

export function predictMatch(m: Match) {
  const homeExpected = clamp(
    ((m.homeGF + m.awayGA) / 2) * 1.08
  );

  const awayExpected = clamp(
    (m.awayGF + m.homeGA) / 2
  );

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  let over15 = 0;
  let over25 = 0;
  let over35 = 0;
  let bttsYes = 0;

  const scores: {
    score: string;
    probability: number;
  }[] = [];

  // Calculate possible scorelines from 0-0 to 10-10.
  for (let x = 0; x <= 10; x++) {
    for (let y = 0; y <= 10; y++) {
      const probability =
        poisson(homeExpected, x) *
        poisson(awayExpected, y);

      if (x > y) homeWin += probability;
      else if (x === y) draw += probability;
      else awayWin += probability;

      if (x + y >= 2) over15 += probability;
      if (x + y >= 3) over25 += probability;
      if (x + y >= 4) over35 += probability;

      if (x > 0 && y > 0) {
        bttsYes += probability;
      }

      scores.push({
        score: `${x}-${y}`,
        probability
      });
    }
  }

  // Normalize probabilities to account for the limited score grid.
  const total =
    homeWin + draw + awayWin;

  const normalize = (value: number) =>
    total > 0 ? value / total : 0;

  const percentage = (value: number) =>
    Math.round(normalize(value) * 1000) / 10;

  scores.sort(
    (a, b) => b.probability - a.probability
  );

  const outcomes = [
    { name: 'Home win', value: homeWin },
    { name: 'Draw', value: draw },
    { name: 'Away win', value: awayWin }
  ];

  outcomes.sort((a, b) => b.value - a.value);

  return {
    model: 'Poisson Statistical Engine v2',

    status: 'ILLUSTRATIVE_NOT_VALIDATED',

    expectedGoals: {
      home: Number(homeExpected.toFixed(2)),
      away: Number(awayExpected.toFixed(2))
    },

    probabilities: {
      homeWin: percentage(homeWin),
      draw: percentage(draw),
      awayWin: percentage(awayWin),

      homeOrDraw: percentage(homeWin + draw),
      awayOrDraw: percentage(awayWin + draw),
      homeOrAway: percentage(homeWin + awayWin),

      over15: percentage(over15),
      under15: percentage(total - over15),

      over25: percentage(over25),
      under25: percentage(total - over25),

      over35: percentage(over35),
      under35: percentage(total - over35),

      bttsYes: percentage(bttsYes),
      bttsNo: percentage(total - bttsYes)
    },

    topScores: scores
      .slice(0, 5)
      .map(score => ({
        score: score.score,
        probability: percentage(score.probability)
      })),

    strongestOutcome: outcomes[0].name,

    confidence:
      'Not calibrated — not betting confidence',

    dataLimitations: [
      'Recent team averages may use only five matches',
      'No verified injuries or confirmed lineups',
      'No verified live xG feed',
      'Not backtested or calibrated'
    ],

    disclaimer:
      'Statistical estimates only. No result or bet is guaranteed.'
  };
}
