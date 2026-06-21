/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { MatchState, MatchSettings, GameScore, MatchHistoryFrame } from '../src/types.js';

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory match database
const matches = new Map<string, MatchState>();

// Helper to generate IDs
function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 8)}`;
}

// Seed helper for initial demonstration matches when empty
function seedDemoMatches() {
  const matchId1 = 'demo-match-1';
  const matchId2 = 'demo-match-2';

  const settings1: MatchSettings = {
    id: matchId1,
    token: 'ref-demo-1',
    isDoubles: true,
    teamAName: 'Kitchen Crusaders',
    teamBName: 'Dink Masters',
    teamAPlayer1: 'Sarah Jenkins',
    teamAPlayer2: 'Michael Chang',
    teamBPlayer1: 'Alex Mercer',
    teamBPlayer2: 'David Miller',
    teamAColor: '#10b981', // green
    teamBColor: '#3b82f6', // blue
    pointsPerGame: 11,
    winByTwo: true,
    bestOfGames: 3,
    tiebreakPoints: 11,
    initialService: 'A',
  };

  const state1: MatchState = {
    id: matchId1,
    settings: settings1,
    currentGameIndex: 1,
    games: [
      { teamAScore: 11, teamBScore: 8, winner: 'A' },
      { teamAScore: 5, teamBScore: 6 }, // Game 2 in progress
    ],
    teamAGamesWon: 1,
    teamBGamesWon: 0,
    scoreA: 5,
    scoreB: 6,
    servingTeam: 'B',
    serverNumber: 1,
    teamAPlayersOnLeft: 'Sarah Jenkins',
    teamAPlayersOnRight: 'Michael Chang',
    teamBPlayersOnLeft: 'Alex Mercer',
    teamBPlayersOnRight: 'David Miller',
    leftSideTeam: 'A',
    status: 'live',
    timeoutsUsedA: 1,
    timeoutsUsedB: 0,
    lastUpdated: Date.now(),
    history: [],
  };

  const settings2: MatchSettings = {
    id: matchId2,
    token: 'ref-demo-2',
    isDoubles: false,
    teamAName: 'Ben Johns',
    teamBName: 'Tyson McGuffin',
    teamAPlayer1: 'Ben Johns',
    teamAPlayer2: '',
    teamBPlayer1: 'Tyson McGuffin',
    teamBPlayer2: '',
    teamAColor: '#ea580c', // orange
    teamBColor: '#4b5563', // charcoal
    pointsPerGame: 11,
    winByTwo: true,
    bestOfGames: 3,
    tiebreakPoints: 11,
    initialService: 'A',
  };

  const state2: MatchState = {
    id: matchId2,
    settings: settings2,
    currentGameIndex: 1,
    games: [
      { teamAScore: 11, teamBScore: 9, winner: 'A' },
      { teamAScore: 11, teamBScore: 13, winner: 'B' },
      { teamAScore: 11, teamBScore: 7, winner: 'A' },
    ],
    teamAGamesWon: 2,
    teamBGamesWon: 1,
    scoreA: 11,
    scoreB: 7,
    servingTeam: 'A',
    serverNumber: 1,
    teamAPlayersOnLeft: 'Ben Johns',
    teamAPlayersOnRight: '',
    teamBPlayersOnLeft: 'Tyson McGuffin',
    teamBPlayersOnRight: '',
    leftSideTeam: 'A',
    status: 'completed',
    winner: 'A',
    timeoutsUsedA: 1,
    timeoutsUsedB: 2,
    lastUpdated: Date.now() - 10 * 60 * 1000,
    history: [],
  };

  matches.set(matchId1, state1);
  matches.set(matchId2, state2);
}

// Run seeding
seedDemoMatches();

// --- REST API OVERLAY ---

// 1. Fetch all matches (with sanitized auth)
app.get('/api/matches', (req, res) => {
  const matchSummaries = Array.from(matches.values()).map(match => {
    // Sanitize to omit secret token in public listing
    const sanitizedSettings = { ...match.settings, token: undefined };
    return {
      ...match,
      settings: sanitizedSettings,
    };
  });

  // Sort: live first, then sorting by most recently updated
  matchSummaries.sort((a, b) => {
    if (a.status === 'live' && b.status !== 'live') return -1;
    if (a.status !== 'live' && b.status === 'live') return 1;
    return b.lastUpdated - a.lastUpdated;
  });

  res.json({ matches: matchSummaries });
});

// 2. Fetch specific match (providing token if referee)
app.get('/api/matches/:id', (req, res) => {
  const { id } = req.params;
  const tokenHeader = req.headers['x-referee-token'] || req.query.token;

  const match = matches.get(id);
  if (!match) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }

  const isReferee = tokenHeader && match.settings.token === tokenHeader;

  // Sanitize the setting token if not the authorized referee
  const returnSettings = isReferee 
    ? match.settings 
    : { ...match.settings, token: undefined };

  res.json({
    ...match,
    settings: returnSettings,
    isReferee: !!isReferee,
  });
});

// 3. Create a match
app.post('/api/matches', (req, res) => {
  const settingsData: Partial<MatchSettings> = req.body;

  if (!settingsData.teamAName || !settingsData.teamBName) {
    res.status(400).json({ error: 'Missing required team/player names' });
    return;
  }

  const matchId = generateId('pb');
  const refereeToken = generateId('ref');

  const settings: MatchSettings = {
    id: matchId,
    token: refereeToken,
    isDoubles: settingsData.isDoubles ?? true,
    teamAName: settingsData.teamAName,
    teamBName: settingsData.teamBName,
    teamAPlayer1: settingsData.teamAPlayer1 || settingsData.teamAName,
    teamAPlayer2: settingsData.teamAPlayer2 || '',
    teamBPlayer1: settingsData.teamBPlayer1 || settingsData.teamBName,
    teamBPlayer2: settingsData.teamBPlayer2 || '',
    teamAColor: settingsData.teamAColor || '#ef4444', // Red default
    teamBColor: settingsData.teamBColor || '#3b82f6', // Blue default
    pointsPerGame: settingsData.pointsPerGame || 11,
    winByTwo: settingsData.winByTwo ?? true,
    bestOfGames: settingsData.bestOfGames || 3,
    tiebreakPoints: settingsData.tiebreakPoints || 11,
    initialService: settingsData.initialService || 'A',
    scoringFormat: settingsData.scoringFormat || 'side-out',
    gameTimerLimit: settingsData.gameTimerLimit || 0,
    enableGameClock: settingsData.enableGameClock ?? true,
  };

  // Build the initial games grid
  const totalGames = settings.bestOfGames;
  const games: GameScore[] = Array.from({ length: totalGames }, () => ({
    teamAScore: 0,
    teamBScore: 0,
  }));

  // Initial player positions
  // Team A: Player 1 on right, Player 2 on left (if doubles)
  // Team B: Player 1 on right, Player 2 on left (if doubles)
  const isTeamAServingFirst = settings.initialService === 'A';

  const state: MatchState = {
    id: matchId,
    settings,
    currentGameIndex: 0,
    games,
    teamAGamesWon: 0,
    teamBGamesWon: 0,
    scoreA: 0,
    scoreB: 0,
    servingTeam: settings.initialService,
    // Pickleball standard: the starting serving team gets ONLY 1 serve in the first game
    serverNumber: settings.isDoubles ? 2 : 1, 
    teamAPlayersOnLeft: settings.isDoubles ? settings.teamAPlayer2 : '',
    teamAPlayersOnRight: settings.teamAPlayer1,
    teamBPlayersOnLeft: settings.isDoubles ? settings.teamBPlayer2 : '',
    teamBPlayersOnRight: settings.teamBPlayer1,
    leftSideTeam: 'A', // Team A starts physically on left side of computer screen
    status: 'live',
    timeoutsUsedA: 0,
    timeoutsUsedB: 0,
    lastUpdated: Date.now(),
    history: [],
    gameTimerSeconds: (settings.gameTimerLimit || 11) * 60,
    isTimerActive: false,
  };

  matches.set(matchId, state);
  res.json(state);
});

// 4. Update match state (requires secret referee token)
app.put('/api/matches/:id', (req, res) => {
  const { id } = req.params;
  const tokenHeader = req.headers['x-referee-token'] || req.query.token;

  const match = matches.get(id);
  if (!match) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }

  if (!tokenHeader || match.settings.token !== tokenHeader) {
    res.status(403).json({ error: 'Unauthorized: Invalid referee token' });
    return;
  }

  // Retrieve incoming states
  const updatedState: Partial<MatchState> = req.body;

  // Apply updates incrementally
  if (updatedState.currentGameIndex !== undefined) match.currentGameIndex = updatedState.currentGameIndex;
  if (updatedState.games !== undefined) match.games = updatedState.games;
  if (updatedState.teamAGamesWon !== undefined) match.teamAGamesWon = updatedState.teamAGamesWon;
  if (updatedState.teamBGamesWon !== undefined) match.teamBGamesWon = updatedState.teamBGamesWon;
  if (updatedState.scoreA !== undefined) match.scoreA = updatedState.scoreA;
  if (updatedState.scoreB !== undefined) match.scoreB = updatedState.scoreB;
  if (updatedState.servingTeam !== undefined) match.servingTeam = updatedState.servingTeam;
  if (updatedState.serverNumber !== undefined) match.serverNumber = updatedState.serverNumber;
  if (updatedState.teamAPlayersOnLeft !== undefined) match.teamAPlayersOnLeft = updatedState.teamAPlayersOnLeft;
  if (updatedState.teamAPlayersOnRight !== undefined) match.teamAPlayersOnRight = updatedState.teamAPlayersOnRight;
  if (updatedState.teamBPlayersOnLeft !== undefined) match.teamBPlayersOnLeft = updatedState.teamBPlayersOnLeft;
  if (updatedState.teamBPlayersOnRight !== undefined) match.teamBPlayersOnRight = updatedState.teamBPlayersOnRight;
  if (updatedState.leftSideTeam !== undefined) match.leftSideTeam = updatedState.leftSideTeam;
  if (updatedState.status !== undefined) match.status = updatedState.status;
  if (updatedState.winner !== undefined) match.winner = updatedState.winner;
  if (updatedState.timeoutsUsedA !== undefined) match.timeoutsUsedA = updatedState.timeoutsUsedA;
  if (updatedState.timeoutsUsedB !== undefined) match.timeoutsUsedB = updatedState.timeoutsUsedB;
  if (updatedState.history !== undefined) match.history = updatedState.history;
  if (updatedState.gameTimerSeconds !== undefined) match.gameTimerSeconds = updatedState.gameTimerSeconds;
  if (updatedState.isTimerActive !== undefined) match.isTimerActive = updatedState.isTimerActive;

  match.lastUpdated = Date.now();
  matches.set(id, match);

  res.json(match);
});

// 5. Delete specific match (requires referee token)
app.delete('/api/matches/:id', (req, res) => {
  const { id } = req.params;
  const tokenHeader = req.headers['x-referee-token'] || req.query.token;

  const match = matches.get(id);
  if (!match) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }

  if (!tokenHeader || match.settings.token !== tokenHeader) {
    res.status(403).json({ error: 'Unauthorized: Invalid referee token' });
    return;
  }

  matches.delete(id);
  res.json({ success: true, message: 'Match deleted successfully' });
});

// --- VITE DEV / PRODUCTION INTEGRATION ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pickleball Referee Server running on port ${PORT}`);
  });
}

export default app;

if (!process.env.VERCEL) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
  });
}
