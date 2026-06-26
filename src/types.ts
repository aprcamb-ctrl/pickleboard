/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MatchSettings {
  id: string;
  token: string; // Private referee token
  isDoubles: boolean;
  teamAName: string;
  teamBName: string;
  teamAPlayer1: string;
  teamAPlayer2: string;
  teamBPlayer1: string;
  teamBPlayer2: string;
  teamAColor: string; // hex or Tailwind color
  teamBColor: string; // hex or Tailwind color
  pointsPerGame: number;
  winByTwo: boolean;
  bestOfGames: number; // 1, 3, 5
  tiebreakPoints: number; // point target for final tierbreak game if tied, typically 11 or 15
  initialService: 'A' | 'B';
  scoringFormat?: 'side-out' | 'rally';
  gameTimerLimit?: number; // game timer limit in minutes, 0 means none/disabled
  enableGameClock?: boolean;
  venue?: string;
}

export interface GameScore {
  teamAScore: number;
  teamBScore: number;
  winner?: 'A' | 'B';
}

export interface MatchHistoryFrame {
  scoreA: number;
  scoreB: number;
  servingTeam: 'A' | 'B';
  serverNumber: 1 | 2;
  teamAPlayersOnLeft: string;
  teamAPlayersOnRight: string;
  teamBPlayersOnLeft: string;
  teamBPlayersOnRight: string;
  leftSideTeam: 'A' | 'B';
  status: 'live' | 'completed' | 'not_started';
  currentGameIndex: number;
  games: GameScore[];
  teamAGamesWon: number;
  teamBGamesWon: number;
  winner?: 'A' | 'B';
  timeoutsUsedA: number;
  timeoutsUsedB: number;
  timestamp: number;
  actionDescription: string;
}

export interface MatchState {
  id: string;
  settings: MatchSettings;
  
  currentGameIndex: number;
  games: GameScore[];
  teamAGamesWon: number;
  teamBGamesWon: number;
  
  // Current game scoring state
  scoreA: number;
  scoreB: number;
  servingTeam: 'A' | 'B';
  serverNumber: 1 | 2;
  
  // Court positioning: left player name vs right player name for each team
  teamAPlayersOnLeft: string;
  teamAPlayersOnRight: string;
  teamBPlayersOnLeft: string;
  teamBPlayersOnRight: string;
  
  // Match view logistics: which team is currently on the physical LEFT of the screen court
  leftSideTeam: 'A' | 'B';
  
  status: 'live' | 'completed' | 'not_started';
  winner?: 'A' | 'B';
  timeoutsUsedA: number;
  timeoutsUsedB: number;
  
  lastUpdated: number;
  history: MatchHistoryFrame[];
  gameTimerSeconds?: number;
  isTimerActive?: boolean;
}
