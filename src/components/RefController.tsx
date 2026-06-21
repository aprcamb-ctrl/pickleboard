/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { MatchState, MatchHistoryFrame, GameScore } from '../types.js';
import CourtVisualization from './CourtVisualization.js';
import { 
  Plus, Undo2, RotateCw, Pause, Play, AlertCircle, Copy, Check,
  Sliders, ShieldCheck, Zap, LogOut, ArrowLeftRight, Timer, HelpCircle 
} from 'lucide-react';

interface RefControllerProps {
  initialState: MatchState;
  token: string;
  onExit: () => void;
}

export default function RefController({ initialState, token, onExit }: RefControllerProps) {
  const [match, setMatch] = useState<MatchState>(initialState);
  const [copiedLink, setCopiedLink] = useState<'ref' | 'viewer' | 'embed' | null>(null);

  // Timeout state
  const [timeoutTimer, setTimeoutTimer] = useState<number | null>(null);
  const [timeoutTeam, setTimeoutTeam] = useState<'A' | 'B' | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Manual Adjustments panel toggle
  const [showOverrides, setShowOverrides] = useState(false);

  // Voice caller voice selection
  const [voiceCallOn, setVoiceCallOn] = useState(false);

  // Game timer countdown states
  const [gameTimerSeconds, setGameTimerSeconds] = useState<number>(
    initialState.gameTimerSeconds !== undefined ? initialState.gameTimerSeconds : (initialState.settings.gameTimerLimit || 11) * 60
  );
  const [isTimerActive, setIsTimerActive] = useState<boolean>(initialState.isTimerActive || false);
  const gameTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const formatTimerValue = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Sync state back to server
  const syncWithServer = async (updatedState: MatchState) => {
    try {
      const response = await fetch(`/api/matches/${match.id}?token=${token}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-referee-token': token,
        },
        body: JSON.stringify(updatedState),
      });
      if (response.ok) {
        const freshState = await response.json();
        // Update local state with server confirmed copy
        setMatch(freshState);
      }
    } catch (err) {
      console.error('Failed to sync referee updates:', err);
    }
  };

  // Speaks the current pickleball score aloud if SpeechSynthesis is available and toggled on
  const getTeamAServer = () => {
    if (!match.settings.isDoubles) return match.settings.teamAPlayer1;
    const isEven = match.scoreA % 2 === 0;
    return isEven ? match.teamAPlayersOnRight : match.teamAPlayersOnLeft;
  };

  const getTeamBServer = () => {
    if (!match.settings.isDoubles) return match.settings.teamBPlayer1;
    const isEven = match.scoreB % 2 === 0;
    return isEven ? match.teamBPlayersOnRight : match.teamBPlayersOnLeft;
  };

  const speakScore = (scoreA: number, scoreB: number, server: 'A' | 'B', serverNum: number) => {
    if (!voiceCallOn || !window.speechSynthesis) return;

    window.speechSynthesis.cancel(); // Stop talking current queue
    let first = scoreA;
    let sec = scoreB;
    if (server === 'B') {
      first = scoreB;
      sec = scoreA;
    }

    const isRallyFormat = match.settings.scoringFormat === 'rally';

    const message = (match.settings.isDoubles && !isRallyFormat)
      ? `${first}, ${sec}, server ${serverNum}`
      : `${first}, ${sec}`;

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  // Helper: Create a history snapshot
  const createHistoryFrame = (current: MatchState, actionDescription: string): MatchHistoryFrame => {
    return {
      scoreA: current.scoreA,
      scoreB: current.scoreB,
      servingTeam: current.servingTeam,
      serverNumber: current.serverNumber,
      teamAPlayersOnLeft: current.teamAPlayersOnLeft,
      teamAPlayersOnRight: current.teamAPlayersOnRight,
      teamBPlayersOnLeft: current.teamBPlayersOnLeft,
      teamBPlayersOnRight: current.teamBPlayersOnRight,
      leftSideTeam: current.leftSideTeam,
      status: current.status,
      currentGameIndex: current.currentGameIndex,
      games: JSON.parse(JSON.stringify(current.games)),
      teamAGamesWon: current.teamAGamesWon,
      teamBGamesWon: current.teamBGamesWon,
      winner: current.winner,
      timeoutsUsedA: current.timeoutsUsedA,
      timeoutsUsedB: current.timeoutsUsedB,
      timestamp: Date.now(),
      actionDescription,
    };
  };

  // Pickleball Rules Engine Action: Rally Won (by specific team, for Rally Scoring format)
  const handleRallyPoint = (winner: 'A' | 'B') => {
    if (match.status === 'completed') return;

    const oldFrame = createHistoryFrame(match, `Point to ${winner === 'A' ? match.settings.teamAName : match.settings.teamBName}`);
    const nextHistory = [oldFrame, ...match.history].slice(0, 20);

    let newScoreA = match.scoreA;
    let newScoreB = match.scoreB;
    
    // In rally scoring, players NEVER change sides of the court.
    const nextAPlayersOnLeft = match.teamAPlayersOnLeft;
    const nextAPlayersOnRight = match.teamAPlayersOnRight;
    const nextBPlayersOnLeft = match.teamBPlayersOnLeft;
    const nextBPlayersOnRight = match.teamBPlayersOnRight;

    if (winner === 'A') {
      newScoreA += 1;
    } else {
      newScoreB += 1;
    }

    // Check if game is completed
    const currentTargetPoints = match.currentGameIndex === (match.settings.bestOfGames - 1) && match.settings.bestOfGames > 1
      ? match.settings.tiebreakPoints
      : match.settings.pointsPerGame;

    const gameWinnerChecked = checkGameWinner(newScoreA, newScoreB, currentTargetPoints, match.settings.winByTwo);

    let nextGamesList = [...match.games];
    let nextCurrentGameIndex = match.currentGameIndex;
    let nextTeamAGamesWon = match.teamAGamesWon;
    let nextTeamBGamesWon = match.teamBGamesWon;
    let nextStatus = match.status;
    let nextMatchWinner = match.winner;
    let nextServingTeam = match.servingTeam;
    let nextServerNumber = 1;

    if (gameWinnerChecked) {
      const gameWinner = gameWinnerChecked;
      nextGamesList[match.currentGameIndex] = {
        teamAScore: newScoreA,
        teamBScore: newScoreB,
        winner: gameWinner,
      };

      if (gameWinner === 'A') {
        nextTeamAGamesWon += 1;
      } else {
        nextTeamBGamesWon += 1;
      }

      const gamesNeededToWin = Math.ceil(match.settings.bestOfGames / 2);
      if (nextTeamAGamesWon >= gamesNeededToWin) {
        nextStatus = 'completed';
        nextMatchWinner = 'A';
      } else if (nextTeamBGamesWon >= gamesNeededToWin) {
        nextStatus = 'completed';
        nextMatchWinner = 'B';
      } else {
        // Prepare next game
        nextCurrentGameIndex += 1;
        newScoreA = 0;
        newScoreB = 0;
        const nextStartingServeTeam = match.settings.initialService === 'A' 
          ? (nextCurrentGameIndex % 2 === 0 ? 'A' : 'B')
          : (nextCurrentGameIndex % 2 === 0 ? 'B' : 'A');
        
        nextServingTeam = nextStartingServeTeam;
        nextServerNumber = 1;
      }
    } else {
      // If rally winner won a point but is not the active server, side-out occurs
      if (winner !== match.servingTeam) {
        nextServingTeam = winner;
      }
    }

    const updatedState: MatchState = {
      ...match,
      scoreA: newScoreA,
      scoreB: newScoreB,
      teamAPlayersOnLeft: nextAPlayersOnLeft,
      teamAPlayersOnRight: nextAPlayersOnRight,
      teamBPlayersOnLeft: nextBPlayersOnLeft,
      teamBPlayersOnRight: nextBPlayersOnRight,
      games: nextGamesList,
      currentGameIndex: nextCurrentGameIndex,
      teamAGamesWon: nextTeamAGamesWon,
      teamBGamesWon: nextTeamBGamesWon,
      status: nextStatus,
      winner: nextMatchWinner,
      servingTeam: nextServingTeam,
      serverNumber: nextServerNumber,
      history: nextHistory,
    };

    setMatch(updatedState);
    syncWithServer(updatedState);
    speakScore(newScoreA, newScoreB, nextServingTeam, nextServerNumber);
  };

  // Pickleball Rules Engine Action: Rally Won
  const handleRallyWon = () => {
    if (match.status === 'completed') return;

    // Create backup for undo
    const oldFrame = createHistoryFrame(match, `Point to ${match.servingTeam === 'A' ? match.settings.teamAName : match.settings.teamBName}`);
    const nextHistory = [oldFrame, ...match.history].slice(0, 20); // Hold last 20 undos

    let newScoreA = match.scoreA;
    let newScoreB = match.scoreB;
    let nextAPlayersOnLeft = match.teamAPlayersOnLeft;
    let nextAPlayersOnRight = match.teamAPlayersOnRight;
    let nextBPlayersOnLeft = match.teamBPlayersOnLeft;
    let nextBPlayersOnRight = match.teamBPlayersOnRight;

    // Points only scored by serving team in pickleball!
    if (match.servingTeam === 'A') {
      newScoreA += 1;
      // Serving team switches positions on scored point!
      if (match.settings.isDoubles) {
        nextAPlayersOnLeft = match.teamAPlayersOnRight;
        nextAPlayersOnRight = match.teamAPlayersOnLeft;
      }
    } else {
      newScoreB += 1;
      if (match.settings.isDoubles) {
        nextBPlayersOnLeft = match.teamBPlayersOnRight;
        nextBPlayersOnRight = match.teamBPlayersOnLeft;
      }
    }

    // Check if game is completed
    const currentTargetPoints = match.currentGameIndex === (match.settings.bestOfGames - 1) && match.settings.bestOfGames > 1
      ? match.settings.tiebreakPoints // Deciding final game tiebreak rules
      : match.settings.pointsPerGame;

    const gameWinnerChecked = checkGameWinner(newScoreA, newScoreB, currentTargetPoints, match.settings.winByTwo);

    let nextGamesList = [...match.games];
    let nextCurrentGameIndex = match.currentGameIndex;
    let nextTeamAGamesWon = match.teamAGamesWon;
    let nextTeamBGamesWon = match.teamBGamesWon;
    let nextStatus = match.status;
    let nextMatchWinner = match.winner;
    let nextServingTeam = match.servingTeam;
    let nextServerNumber = match.serverNumber;

    if (gameWinnerChecked) {
      // Game over! Set results
      const gameWinner = gameWinnerChecked;
      nextGamesList[match.currentGameIndex] = {
        teamAScore: newScoreA,
        teamBScore: newScoreB,
        winner: gameWinner,
      };

      if (gameWinner === 'A') {
        nextTeamAGamesWon += 1;
      } else {
        nextTeamBGamesWon += 1;
      }

      // Check if Match over (Best of checklist)
      const gamesNeededToWin = Math.ceil(match.settings.bestOfGames / 2);
      if (nextTeamAGamesWon >= gamesNeededToWin) {
        nextStatus = 'completed';
        nextMatchWinner = 'A';
      } else if (nextTeamBGamesWon >= gamesNeededToWin) {
        nextStatus = 'completed';
        nextMatchWinner = 'B';
      } else {
        // Prepare next game
        nextCurrentGameIndex += 1;
        newScoreA = 0;
        newScoreB = 0;
        // In subsequent games, alternate starting serve team
        const nextStartingServeTeam = match.settings.initialService === 'A' 
          ? (nextCurrentGameIndex % 2 === 0 ? 'A' : 'B')
          : (nextCurrentGameIndex % 2 === 0 ? 'B' : 'A');
        
        nextServingTeam = nextStartingServeTeam;
        nextServerNumber = match.settings.isDoubles ? 2 : 1; // start on server 2 in doubles
        
        // Reset player standing sides to original
        nextAPlayersOnLeft = match.settings.teamAPlayer2;
        nextAPlayersOnRight = match.settings.teamAPlayer1;
        nextBPlayersOnLeft = match.settings.teamBPlayer2;
        nextBPlayersOnRight = match.settings.teamBPlayer1;
      }
    }

    const updatedState: MatchState = {
      ...match,
      scoreA: newScoreA,
      scoreB: newScoreB,
      teamAPlayersOnLeft: nextAPlayersOnLeft,
      teamAPlayersOnRight: nextAPlayersOnRight,
      teamBPlayersOnLeft: nextBPlayersOnLeft,
      teamBPlayersOnRight: nextBPlayersOnRight,
      games: nextGamesList,
      currentGameIndex: nextCurrentGameIndex,
      teamAGamesWon: nextTeamAGamesWon,
      teamBGamesWon: nextTeamBGamesWon,
      status: nextStatus,
      winner: nextMatchWinner,
      servingTeam: nextServingTeam,
      serverNumber: nextServerNumber,
      history: nextHistory,
    };

    setMatch(updatedState);
    syncWithServer(updatedState);
    speakScore(newScoreA, newScoreB, nextServingTeam, nextServerNumber);
  };

  // Helper check winner
  const checkGameWinner = (scoreA: number, scoreB: number, target: number, winBy2: boolean): 'A' | 'B' | null => {
    if (winBy2) {
      if (scoreA >= target && scoreA - scoreB >= 2) return 'A';
      if (scoreB >= target && scoreB - scoreA >= 2) return 'B';
    } else {
      if (scoreA >= target) return 'A';
      if (scoreB >= target) return 'B';
    }
    return null;
  };

  // Pickleball Rules Engine Action: Serving Fault / Rally Lost
  const handleFault = () => {
    if (match.status === 'completed') return;

    const oldFrame = createHistoryFrame(match, `Fault by serving team ${match.servingTeam}`);
    const nextHistory = [oldFrame, ...match.history].slice(0, 20);

    let nextServingTeam = match.servingTeam;
    let nextServerNumber = match.serverNumber;

    if (match.settings.isDoubles) {
      if (match.serverNumber === 1) {
        nextServerNumber = 2;
      } else {
        // Sideout! Swap serving side
        nextServingTeam = match.servingTeam === 'A' ? 'B' : 'A';
        nextServerNumber = 1;
      }
    } else {
      // Singles: automatic sideout
      nextServingTeam = match.servingTeam === 'A' ? 'B' : 'A';
      nextServerNumber = 1;
    }

    const updatedState: MatchState = {
      ...match,
      servingTeam: nextServingTeam,
      serverNumber: nextServerNumber,
      history: nextHistory,
    };

    setMatch(updatedState);
    syncWithServer(updatedState);
    speakScore(match.scoreA, match.scoreB, nextServingTeam, nextServerNumber);
  };

  // Referee Interface Action: Undo Last Play
  const handleUndo = () => {
    if (match.history.length === 0) return;

    const [prevFrame, ...remainingHistory] = match.history;

    const updatedState: MatchState = {
      ...match,
      scoreA: prevFrame.scoreA,
      scoreB: prevFrame.scoreB,
      servingTeam: prevFrame.servingTeam,
      serverNumber: prevFrame.serverNumber,
      teamAPlayersOnLeft: prevFrame.teamAPlayersOnLeft,
      teamAPlayersOnRight: prevFrame.teamAPlayersOnRight,
      teamBPlayersOnLeft: prevFrame.teamBPlayersOnLeft,
      teamBPlayersOnRight: prevFrame.teamBPlayersOnRight,
      leftSideTeam: prevFrame.leftSideTeam,
      status: prevFrame.status,
      currentGameIndex: prevFrame.currentGameIndex,
      games: prevFrame.games,
      teamAGamesWon: prevFrame.teamAGamesWon,
      teamBGamesWon: prevFrame.teamBGamesWon,
      winner: prevFrame.winner,
      timeoutsUsedA: prevFrame.timeoutsUsedA,
      timeoutsUsedB: prevFrame.timeoutsUsedB,
      history: remainingHistory,
    };

    setMatch(updatedState);
    syncWithServer(updatedState);
  };

  // Referee Interface Action: Manual Sides Switch
  const toggleSidesOnScreen = () => {
    const updatedState: MatchState = {
      ...match,
      leftSideTeam: match.leftSideTeam === 'A' ? 'B' : 'A',
    };
    setMatch(updatedState);
    syncWithServer(updatedState);
  };

  // Referee Interface Action: Launch Team Timeout
  const startTimeout = (team: 'A' | 'B') => {
    if (timeoutTimer !== null) return; // already in timeout

    const updatedState: MatchState = {
      ...match,
      timeoutsUsedA: team === 'A' ? match.timeoutsUsedA + 1 : match.timeoutsUsedA,
      timeoutsUsedB: team === 'B' ? match.timeoutsUsedB + 1 : match.timeoutsUsedB,
    };

    setMatch(updatedState);
    syncWithServer(updatedState);

    setTimeoutTeam(team);
    setTimeoutTimer(60); // 60 seconds standard timeout

    // Synthesize double beep sound if configured
    if (window.speechSynthesis && voiceCallOn) {
      const u = new SpeechSynthesisUtterance("Timeout charged.");
      window.speechSynthesis.speak(u);
    }
  };

  // Timeout Clock handler
  useEffect(() => {
    if (timeoutTimer !== null && timeoutTimer > 0) {
      timerIntervalRef.current = setTimeout(() => {
        setTimeoutTimer(timeoutTimer - 1);
      }, 1000);
    } else if (timeoutTimer === 0) {
      // beep and clear
      if (window.speechSynthesis && voiceCallOn) {
        const u = new SpeechSynthesisUtterance("Timeout expired. Players back to court.");
        window.speechSynthesis.speak(u);
      }
      setTimeoutTimer(null);
      setTimeoutTeam(null);
    }

    return () => {
      if (timerIntervalRef.current) clearTimeout(timerIntervalRef.current);
    };
  }, [timeoutTimer, voiceCallOn]);

  const stopTimeoutNow = () => {
    setTimeoutTimer(null);
    setTimeoutTeam(null);
    if (timerIntervalRef.current) clearTimeout(timerIntervalRef.current);
  };

  const syncTimerState = async (timerSecs: number, active: boolean) => {
    try {
      await fetch(`/api/matches/${match.id}?token=${token}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-referee-token': token,
        },
        body: JSON.stringify({
          gameTimerSeconds: timerSecs,
          isTimerActive: active,
        }),
      });
    } catch (err) {
      console.error('Failed to sync timer update:', err);
    }
  };

  // Game Clock countdown effect
  useEffect(() => {
    if (isTimerActive && gameTimerSeconds > 0) {
      gameTimerIntervalRef.current = setTimeout(() => {
        const nextSecs = gameTimerSeconds - 1;
        setGameTimerSeconds(nextSecs);
        if (nextSecs % 5 === 0 || nextSecs === 0) {
          syncTimerState(nextSecs, isTimerActive);
        }
      }, 1000);
    } else if (gameTimerSeconds === 0) {
      setIsTimerActive(false);
      if (window.speechSynthesis && voiceCallOn) {
        const u = new SpeechSynthesisUtterance("Times up!");
        window.speechSynthesis.speak(u);
      }
    }

    return () => {
      if (gameTimerIntervalRef.current) clearTimeout(gameTimerIntervalRef.current);
    };
  }, [isTimerActive, gameTimerSeconds, voiceCallOn]);

  const toggleGameTimer = () => {
    const nextActive = !isTimerActive;
    setIsTimerActive(nextActive);
    syncTimerState(gameTimerSeconds, nextActive);
  };

  const resetGameTimer = () => {
    const defaultSecs = (match.settings.gameTimerLimit || 11) * 60;
    setIsTimerActive(false);
    setGameTimerSeconds(defaultSecs);
    syncTimerState(defaultSecs, false);
  };

  // Direct Overrides Helper Updates
  const updateOverrideValue = (key: keyof MatchState | 'swapA' | 'swapB', value: any) => {
    const oldFrame = createHistoryFrame(match, `Manual Adjustment of ${String(key)}`);
    const nextHistory = [oldFrame, ...match.history].slice(0, 20);

    let updatedState = { ...match, history: nextHistory };

    if (key === 'swapA') {
      updatedState.teamAPlayersOnLeft = match.teamAPlayersOnRight;
      updatedState.teamAPlayersOnRight = match.teamAPlayersOnLeft;
    } else if (key === 'swapB') {
      updatedState.teamBPlayersOnLeft = match.teamBPlayersOnRight;
      updatedState.teamBPlayersOnRight = match.teamBPlayersOnLeft;
    } else {
      (updatedState as any)[key] = value;
    }

    setMatch(updatedState);
    syncWithServer(updatedState);
  };

  // Reset/Reset Match entièrement
  const resetEntireMatch = () => {
    if (!window.confirm('Reset this entire match and start from 0-0 in Game 1? The history will be cleared.')) return;

    const initialGames: GameScore[] = Array.from({ length: match.settings.bestOfGames }, () => ({
      teamAScore: 0,
      teamBScore: 0,
    }));

    const updatedState: MatchState = {
      ...match,
      currentGameIndex: 0,
      games: initialGames,
      teamAGamesWon: 0,
      teamBGamesWon: 0,
      scoreA: 0,
      scoreB: 0,
      servingTeam: match.settings.initialService,
      serverNumber: match.settings.isDoubles ? 2 : 1,
      teamAPlayersOnLeft: match.settings.isDoubles ? match.settings.teamAPlayer2 : '',
      teamAPlayersOnRight: match.settings.teamAPlayer1,
      teamBPlayersOnLeft: match.settings.isDoubles ? match.settings.teamBPlayer2 : '',
      teamBPlayersOnRight: match.settings.teamBPlayer1,
      leftSideTeam: 'A',
      status: 'live',
      winner: undefined,
      timeoutsUsedA: 0,
      timeoutsUsedB: 0,
      history: [],
    };

    setMatch(updatedState);
    syncWithServer(updatedState);
  };

  // Dynamic public share urls
  const appBaseUrl = window.location.origin;
  const viewerUrl = `${appBaseUrl}/viewer/${match.id}`;
  const embedUrl = `${appBaseUrl}/embed/${match.id}`;
  const refereeUrl = `${appBaseUrl}/referee/${match.id}/${token}`;

  const copyToClipboard = (text: string, type: 'ref' | 'viewer' | 'embed') => {
    navigator.clipboard.writeText(text);
    setCopiedLink(type);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const activePointsTarget = match.currentGameIndex === (match.settings.bestOfGames - 1) && match.settings.bestOfGames > 1
    ? match.settings.tiebreakPoints
    : match.settings.pointsPerGame;

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-4 py-6" id="referee-console-container">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0F0F0F] border border-white/10 p-5 rounded-sm shadow-md">
        <div>
          <span className="bg-[#CCFF00] text-black text-[10px] px-2.5 py-1 rounded-sm font-black tracking-widest uppercase inline-block mb-1.5" id="console-badge">
            REFEREE SCOREKEEPING OPERATIONS
          </span>
          <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2 uppercase tracking-tight">
            <span>Match:</span>
            <span className="text-[#CCFF00] italic font-black">
              {match.settings.teamAName} vs {match.settings.teamBName}
            </span>
          </h1>
          <div className="text-[10px] text-white/40 uppercase font-bold font-mono tracking-widest mt-1.5 flex items-center gap-x-4 gap-y-1.5 flex-wrap">
            <span>ID: <strong className="font-mono text-white/60">{match.id}</strong></span>
            <span>Mode: <strong>{match.settings.isDoubles ? 'Doubles' : 'Singles'}</strong></span>
            <span>Format: <strong>Best of {match.settings.bestOfGames} (to {activePointsTarget})</strong></span>
            <span>Scoring: <strong className="text-amber-400 font-bold">{match.settings.scoringFormat === 'rally' ? 'Rally' : 'Side-Out'}</strong></span>
            {match.settings.enableGameClock !== false && (
              <span>Game Time: <strong className="text-[#CCFF00] font-bold">{match.settings.gameTimerLimit ? `${match.settings.gameTimerLimit} Mins` : 'No Limit'}</strong></span>
            )}
          </div>
        </div>

        <button 
          id="exit-console-btn"
          onClick={onExit}
          className="px-4 py-2 border border-white/10 bg-black text-white/60 hover:text-white rounded-sm text-xs font-mono font-black uppercase tracking-widest transition-all hover:border-[#CCFF00] hover:text-[#CCFF00] flex items-center gap-2 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Exit Dashboard
        </button>
      </div>

      {/* TIMEOUT OVERLAY DISPLAY */}
      {timeoutTimer !== null && (
        <div className="bg-[#CCFF00] text-black px-6 py-4 rounded-sm flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg border-2 border-black" id="timeout-ticker-card">
          <div className="flex items-center gap-3">
            <Timer className="w-8 h-8 text-black" />
            <div>
              <h3 className="font-black text-lg uppercase tracking-tight italic">
                TIMEOUT CHARGED: {timeoutTeam === 'A' ? match.settings.teamAName : match.settings.teamBName}
              </h3>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                1-minute countdown active • Ensure court compliance
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-3xl font-black tracking-widest" id="timeout-clock">
              0:{timeoutTimer < 10 ? `0${timeoutTimer}` : timeoutTimer}
            </span>
            <button
              id="stop-timeout-btn"
              onClick={stopTimeoutNow}
              className="px-4 py-2 rounded-sm bg-black text-white hover:text-[#CCFF00] font-mono font-black text-xs uppercase transition-colors cursor-pointer"
            >
              Resume Play
            </button>
          </div>
        </div>
      )}

      {/* SCORE CONTROLS (THE CORE BOARD) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SCORE ACTION PANEL */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-black border-2 border-white/10 rounded-sm p-6 shadow-md relative overflow-hidden flex flex-col justify-between" id="scorekeeper-clicks-panel">
            
            {/* Serving / Status Bar banner */}
            <div className="border-b border-white/10 pb-4 mb-4 flex justify-between items-center text-[10px] uppercase font-mono tracking-widest font-black">
              <span className="text-white/40">
                Game {match.currentGameIndex + 1} of {match.settings.bestOfGames} Score
              </span>
              <div className="flex items-center gap-3">
                {/* Voice Scorekeeper Toggle */}
                <button
                  id="voice-call-toggle"
                  onClick={() => setVoiceCallOn(!voiceCallOn)}
                  className={`px-2.5 py-1 rounded-sm text-[9px] font-black tracking-widest border uppercase transition-colors cursor-pointer flex items-center gap-1 ${
                    voiceCallOn 
                      ? 'bg-[#CCFF00]/10 border-[#CCFF00]/30 text-[#CCFF00]' 
                      : 'bg-[#0F0F0F] border-white/10 text-white/50 hover:text-white'
                  }`}
                  title="Speak Score Aloud"
                >
                  <Zap className={`w-3 h-3 ${voiceCallOn ? 'fill-[#CCFF00]' : ''}`} />
                  Voice: {voiceCallOn ? 'ON' : 'OFF'}
                </button>

                <span className={`px-2 py-0.5 rounded-sm text-[9px] font-black tracking-widest border uppercase ${
                  match.status === 'completed'
                    ? 'bg-red-500/10 border-red-500/20 text-red-400'
                    : 'bg-[#CCFF00]/10 border-[#CCFF00]/20 text-[#CCFF00]'
                }`}>
                  {match.status}
                </span>
              </div>
            </div>

            {/* Scorecard large columns */}
            <div className="grid grid-cols-2 divide-x divide-white/10 gap-4" id="ref-scorecards">
              
              {/* TEAM A BOARD */}
              <div className="px-2 text-center space-y-3">
                <div className="flex justify-center items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: match.settings.teamAColor }} />
                  <span className="font-extrabold text-white text-xs uppercase tracking-wider truncate max-w-[140px]" title={match.settings.teamAName}>
                    {match.settings.teamAName}
                  </span>
                </div>

                <div className="flex flex-col items-center">
                  <span className="text-7xl font-mono font-black text-white block py-2 select-none" id="score-a-value">
                    {match.scoreA}
                  </span>

                  {match.servingTeam === 'A' && (
                    <div className="flex flex-col items-center gap-1">
                      <span className="bg-[#CCFF00] text-black font-black px-3 py-1 rounded-sm text-[9px] tracking-widest flex items-center gap-1 animate-pulse" id="serve-indicator-a">
                        SERVE {match.settings.isDoubles && match.settings.scoringFormat !== 'rally' ? `(S${match.serverNumber})` : ''}
                      </span>
                      <span className="text-[10px] text-[#CCFF00] font-mono uppercase tracking-widest font-bold">
                        Server: {getTeamAServer()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex justify-center gap-2 pt-2">
                  <button
                    id="timeout-a-btn"
                    onClick={() => startTimeout('A')}
                    disabled={match.timeoutsUsedA >= 2 || timeoutTimer !== null}
                    className="px-2 py-1 rounded-sm bg-[#0F0F0F] border border-white/10 text-white/50 hover:text-white hover:border-white/30 font-mono text-[9px] uppercase font-black tracking-widest disabled:opacity-30 cursor-pointer"
                  >
                    Timeout ({match.timeoutsUsedA}/2)
                  </button>
                </div>
              </div>

              {/* TEAM B BOARD */}
              <div className="px-2 text-center space-y-3">
                <div className="flex justify-center items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: match.settings.teamBColor }} />
                  <span className="font-extrabold text-white text-xs uppercase tracking-wider truncate max-w-[140px]" title={match.settings.teamBName}>
                    {match.settings.teamBName}
                  </span>
                </div>

                <div className="flex flex-col items-center">
                  <span className="text-7xl font-mono font-black text-white block py-2 select-none" id="score-b-value">
                    {match.scoreB}
                  </span>

                  {match.servingTeam === 'B' && (
                    <div className="flex flex-col items-center gap-1">
                      <span className="bg-[#CCFF00] text-black font-black px-3 py-1 rounded-sm text-[9px] tracking-widest flex items-center gap-1 animate-pulse" id="serve-indicator-b">
                        SERVE {match.settings.isDoubles && match.settings.scoringFormat !== 'rally' ? `(S${match.serverNumber})` : ''}
                      </span>
                      <span className="text-[10px] text-[#CCFF00] font-mono uppercase tracking-widest font-bold">
                        Server: {getTeamBServer()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex justify-center gap-2 pt-2">
                  <button
                    id="timeout-b-btn"
                    onClick={() => startTimeout('B')}
                    disabled={match.timeoutsUsedB >= 2 || timeoutTimer !== null}
                    className="px-2 py-1 rounded-sm bg-[#0F0F0F] border border-white/10 text-white/50 hover:text-white hover:border-white/30 font-mono text-[9px] uppercase font-black tracking-widest disabled:opacity-30 cursor-pointer"
                  >
                    Timeout ({match.timeoutsUsedB}/2)
                  </button>
                </div>
              </div>

            </div>

             {/* ACTION TRIGGERS */}
            {match.status !== 'completed' ? (
              match.settings.scoringFormat === 'rally' ? (
                <div className="space-y-4 mt-6 border-t border-white/10 pt-6">
                  <div className="text-[10px] font-mono tracking-widest uppercase text-white/40 block text-center font-bold">
                    Rally Scoring: Log points directly to the winning team of the rally
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Rally winner Team A */}
                    <button
                      id="rally-point-a-btn"
                      onClick={() => handleRallyPoint('A')}
                      className="flex flex-col items-center justify-center py-4 px-6 rounded-sm bg-black hover:bg-[#CCFF00]/10 hover:text-[#CCFF00] hover:border-[#CCFF00] text-white font-extrabold transition-all border border-white/10 select-none cursor-pointer"
                    >
                      <span className="text-[10px] font-mono tracking-widest uppercase text-[#CCFF00] font-black block mb-0.5">Point to team</span>
                      <span className="text-sm font-black uppercase tracking-tight truncate max-w-[200px]">{match.settings.teamAName}</span>
                    </button>

                    {/* Rally winner Team B */}
                    <button
                      id="rally-point-b-btn"
                      onClick={() => handleRallyPoint('B')}
                      className="flex flex-col items-center justify-center py-4 px-6 rounded-sm bg-black hover:bg-[#CCFF00]/10 hover:text-[#CCFF00] hover:border-[#CCFF00] text-white font-extrabold transition-all border border-white/10 select-none cursor-pointer"
                    >
                      <span className="text-[10px] font-mono tracking-widest uppercase text-[#CCFF00] font-black block mb-0.5">Point to team</span>
                      <span className="text-sm font-black uppercase tracking-tight truncate max-w-[200px]">{match.settings.teamBName}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 border-t border-white/10 pt-6">
                  
                  {/* 1. Point won button */}
                  <button
                    id="rally-point-btn"
                    onClick={handleRallyWon}
                    className="flex items-center justify-center gap-2 py-4 px-6 rounded-sm bg-[#CCFF00] hover:bg-[#b8e600] text-black font-black text-sm uppercase tracking-widest transition-all select-none shadow hover:shadow-[#CCFF00]/10 active:scale-98 cursor-pointer border border-black"
                  >
                    <Plus className="w-5 h-5 stroke-[3]" />
                    Point to {match.servingTeam === 'A' ? match.settings.teamAName : match.settings.teamBName}
                  </button>

                  {/* 2. Fault/Sideout button */}
                  <button
                    id="rally-fault-btn"
                    onClick={handleFault}
                    className="flex items-center justify-center gap-2 py-4 px-6 rounded-sm bg-black hover:bg-neutral-900 text-amber-500 font-extrabold text-sm uppercase tracking-widest transition-all select-none border border-amber-500/30 active:scale-98 cursor-pointer"
                  >
                    <ArrowLeftRight className="w-5 h-5" />
                    {match.settings.isDoubles && match.serverNumber === 1 
                      ? 'Fault / 2nd Serve' 
                      : 'Fault / Side-out'}
                  </button>

                </div>
              )
            ) : (
              <div className="mt-6 border-t border-white/10 pt-6 text-center" id="congratulations-panel">
                <div className="inline-flex p-3 rounded-sm bg-[#CCFF00]/10 border border-[#CCFF00]/20 text-[#CCFF00] mb-2">
                  <ShieldCheck className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="text-base font-black text-white uppercase tracking-wider">MATCH FINISHED!</h3>
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mt-1">
                  Winner: <strong className="text-[#CCFF00]">{match.winner === 'A' ? match.settings.teamAName : match.settings.teamBName}</strong> ({match.winner === 'A' ? match.teamAGamesWon : match.teamBGamesWon} - {match.winner === 'A' ? match.teamBGamesWon : match.teamAGamesWon} Games)
                </p>
              </div>
            )}

            {/* QUICK UTILITIES */}
            <div className="flex flex-wrap justify-between gap-3 mt-4 border-t border-white/5 pt-4">
              <div className="flex gap-2">
                <button
                  id="undo-btn"
                  onClick={handleUndo}
                  disabled={match.history.length === 0}
                  className="px-3.5 py-2 rounded-sm border border-white/10 bg-black text-white/60 hover:text-white disabled:opacity-35 transition-colors flex items-center gap-1.5 text-[10px] uppercase font-mono tracking-widest font-black cursor-pointer"
                >
                  <Undo2 className="w-4 h-4" />
                  Undo
                </button>

                <button
                  id="side-swap-btn"
                  onClick={toggleSidesOnScreen}
                  className="px-3.5 py-2 rounded-sm border border-white/10 bg-black text-white/60 hover:text-white transition-colors flex items-center gap-1.5 text-[10px] uppercase font-mono tracking-widest font-black cursor-pointer"
                  title="Swaps left/right team on the court view"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Flip Sides View
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  id="override-panel-toggle"
                  onClick={() => setShowOverrides(!showOverrides)}
                  className={`px-3.5 py-2 rounded-sm border transition-colors flex items-center gap-1.5 text-[10px] uppercase font-mono tracking-widest font-black cursor-pointer ${
                    showOverrides
                      ? 'bg-white/5 border-white/30 text-white'
                      : 'border-white/10 bg-black text-white/60 hover:text-white'
                  }`}
                >
                  <Sliders className="w-4 h-4" />
                  Overrides
                </button>

                <button
                  id="reset-match-btn"
                  onClick={resetEntireMatch}
                  className="px-3.5 py-2 rounded-sm border border-red-500/20 hover:border-red-500/40 bg-black text-red-400 hover:text-red-300 transition-all flex items-center gap-1.5 text-[10px] uppercase font-mono tracking-widest font-black cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Reset
                </button>
              </div>
            </div>

            {/* MANUAL ADJUSTMENTS EXPANDABLE CARD */}
            {showOverrides && (
              <div className="mt-4 p-5 rounded-sm border-2 border-dashed border-white/20 bg-[#0F0F0F] space-y-4" id="manual-override-panel">
                <h4 className="font-black text-[10px] text-white uppercase tracking-widest flex items-center gap-1">
                  <Sliders className="w-4 h-4 text-[#CCFF00]" />
                  Manual Score Correction & Overrides
                </h4>
                <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider">
                  Direct state modifications. Adjust scoring levels, swap serving team priority, or shuffle standing player placements.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Scope A */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-white/30 uppercase font-black tracking-widest block">{match.settings.teamAName} Score</label>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => updateOverrideValue('scoreA', Math.max(0, match.scoreA - 1))}
                        className="w-8 h-8 rounded-sm bg-black text-white hover:text-[#CCFF00] border border-white/10 font-black cursor-pointer"
                      >-</button>
                      <span className="flex-1 text-center font-mono font-black text-sm text-[#CCFF00]">{match.scoreA}</span>
                      <button 
                        onClick={() => updateOverrideValue('scoreA', match.scoreA + 1)}
                        className="w-8 h-8 rounded-sm bg-black text-white hover:text-[#CCFF00] border border-white/10 font-black cursor-pointer"
                      >+</button>
                    </div>
                  </div>

                  {/* Scope B */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-white/30 uppercase font-black tracking-widest block">{match.settings.teamBName} Score</label>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => updateOverrideValue('scoreB', Math.max(0, match.scoreB - 1))}
                        className="w-8 h-8 rounded-sm bg-black text-white hover:text-[#CCFF00] border border-white/10 font-black cursor-pointer"
                      >-</button>
                      <span className="flex-1 text-center font-mono font-black text-sm text-[#CCFF00]">{match.scoreB}</span>
                      <button 
                        onClick={() => updateOverrideValue('scoreB', match.scoreB + 1)}
                        className="w-8 h-8 rounded-sm bg-black text-white hover:text-[#CCFF00] border border-white/10 font-black cursor-pointer"
                      >+</button>
                    </div>
                  </div>

                  {/* Serving Team */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-white/30 uppercase font-black tracking-widest block">Serve Owner</label>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={() => updateOverrideValue('servingTeam', 'A')}
                        className={`py-1.5 rounded-sm text-[9px] font-black uppercase tracking-widest border transition-all cursor-pointer ${
                          match.servingTeam === 'A'
                            ? 'bg-[#CCFF00] border-[#CCFF00] text-black'
                            : 'bg-black border-white/10 text-white/40'
                        }`}
                      >Team A</button>
                      <button
                        onClick={() => updateOverrideValue('servingTeam', 'B')}
                        className={`py-1.5 rounded-sm text-[9px] font-black uppercase tracking-widest border transition-all cursor-pointer ${
                          match.servingTeam === 'B'
                            ? 'bg-[#CCFF00] border-[#CCFF00] text-black'
                            : 'bg-black border-white/10 text-white/40'
                        }`}
                      >Team B</button>
                    </div>
                  </div>

                  {/* Server Position Number */}
                  <div className="space-y-1">
                    <label className="text-[9px] text-white/30 uppercase font-black tracking-widest block">Server Number</label>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={() => updateOverrideValue('serverNumber', 1)}
                        className={`py-1.5 rounded-sm text-[9px] font-black uppercase tracking-widest border transition-all cursor-pointer ${
                          match.serverNumber === 1
                            ? 'bg-[#CCFF00] border-[#CCFF00] text-black'
                            : 'bg-black border-white/10 text-white/40'
                        }`}
                      >Server 1</button>
                      <button
                        onClick={() => updateOverrideValue('serverNumber', 2)}
                        disabled={!match.settings.isDoubles}
                        className={`py-1.5 rounded-sm text-[9px] font-black uppercase tracking-widest border disabled:opacity-20 transition-all cursor-pointer ${
                          match.serverNumber === 2
                            ? 'bg-[#CCFF00] border-[#CCFF00] text-black'
                            : 'bg-black border-white/10 text-white/40'
                        }`}
                      >Server 2</button>
                    </div>
                  </div>
                </div>

                {/* Player court shuffling */}
                {match.settings.isDoubles && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/10">
                    <button
                      onClick={() => updateOverrideValue('swapA', true)}
                      className="py-2 px-3 border border-white/10 bg-black hover:border-white/35 text-white text-[10px] uppercase font-mono font-black tracking-widest rounded-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 text-[#CCFF00]" />
                      Swap Court Positions: {match.settings.teamAName} Players
                    </button>
                    <button
                      onClick={() => updateOverrideValue('swapB', true)}
                      className="py-2 px-3 border border-white/10 bg-black hover:border-white/35 text-white text-[10px] uppercase font-mono font-black tracking-widest rounded-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 text-[#CCFF00]" />
                      Swap Court Positions: {match.settings.teamBName} Players
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* HISTORIC GAME RESULTS LIST (Set scorecards) */}
          <div className="bg-black border-2 border-white/10 rounded-sm p-5 shadow-sm space-y-3" id="game-results-panel">
            <h3 className="font-black text-[10px] text-white uppercase tracking-widest">Set Record (Games History)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {match.games.map((game, idx) => {
                const isGameCompleted = idx < match.currentGameIndex || (idx === match.currentGameIndex && match.status === 'completed');
                return (
                  <div 
                    key={`set-card-${idx}`}
                    className={`p-3 rounded-sm border flex justify-between items-center text-xs ${
                      idx === match.currentGameIndex && match.status !== 'completed'
                        ? 'border-[#CCFF00] bg-[#CCFF00]/10 text-white font-extrabold'
                        : isGameCompleted
                          ? 'border-white/10 bg-[#0F0F0F] text-white/50'
                          : 'border-white/5 text-white/20 bg-black'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-wider">Game {idx + 1} {idx === match.currentGameIndex && match.status !== 'completed' ? '(LIVE)' : ''}</span>
                    <span className="font-mono text-xs font-black">
                      {isGameCompleted || (idx === match.currentGameIndex && (match.scoreA > 0 || match.scoreB > 0)) ? (
                        <span>
                          <strong className={game.winner === 'A' || (idx === match.currentGameIndex && match.scoreA > match.scoreB) ? 'text-[#CCFF00]' : 'text-white'}>
                            {idx === match.currentGameIndex ? match.scoreA : game.teamAScore}
                          </strong>
                          <span className="text-white/40"> - </span>
                          <strong className={game.winner === 'B' || (idx === match.currentGameIndex && match.scoreB > match.scoreA) ? 'text-[#CCFF00]' : 'text-white'}>
                            {idx === match.currentGameIndex ? match.scoreB : game.teamBScore}
                          </strong>
                        </span>
                      ) : (
                        <span>--</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* COURT AND SCOREBOARD EMBED PANEL */}
        <div className="space-y-6">
          
          {/* GAME CLOCK / STOPWATCH PANEL */}
          {match.settings.enableGameClock !== false && (
            <div className="bg-black border-2 border-white/10 rounded-sm p-5 shadow-sm space-y-3 animate-fade-in" id="game-countdown-clock">
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <span className="text-[10px] font-black uppercase text-white tracking-widest flex items-center gap-1.5">
                  <Timer className="w-4 h-4 text-[#CCFF00]" />
                  Game Clock
                </span>
                <span className="text-[9px] font-mono text-white/40 uppercase font-black">
                  Limit: {match.settings.gameTimerLimit || 11} mins
                </span>
              </div>

              <div className="flex flex-col items-center justify-center py-4 bg-[#0A0A0A] rounded-sm border border-white/5 relative overflow-hidden">
                {/* Giant Flashing Times Up or Digital Clock */}
                {gameTimerSeconds === 0 ? (
                  <div className="text-center py-1 space-y-1 animate-pulse" id="times-up-alert">
                    <span className="text-red-500 font-mono text-4xl font-extrabold tracking-wider block">
                      TIME'S UP!
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono tracking-widest uppercase font-black block">
                      Match Time Block Expired
                    </span>
                  </div>
                ) : (
                  <div className="text-center">
                    <span className="text-[#CCFF00] font-mono text-5xl font-black tracking-widest block" id="countdown-digits">
                      {formatTimerValue(gameTimerSeconds)}
                    </span>
                  </div>
                )}
              </div>

              {/* Stopwatch controls toolbar */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  id="toggle-game-clock-btn"
                  onClick={toggleGameTimer}
                  disabled={gameTimerSeconds === 0}
                  className={`py-2 px-4 rounded-sm border font-mono font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 select-none cursor-pointer transition-all ${
                    isTimerActive
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                      : 'bg-[#CCFF00]/10 border-[#CCFF00]/30 text-[#CCFF00] hover:bg-[#CCFF00]/20'
                  }`}
                >
                  {isTimerActive ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      Start Clock
                    </>
                  )}
                </button>

                <button
                  id="reset-game-clock-btn"
                  onClick={resetGameTimer}
                  className="py-2 px-4 rounded-sm border border-white/10 bg-black hover:border-white/20 text-white/60 hover:text-white font-mono font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 select-none cursor-pointer transition-colors"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  Reset Clock
                </button>
              </div>
            </div>
          )}
          
          {/* COURT MATRIX */}
          <div className="bg-black border-2 border-white/10 rounded-sm p-5 shadow-sm">
            <CourtVisualization
              isDoubles={match.settings.isDoubles}
              teamAName={match.settings.teamAName}
              teamBName={match.settings.teamBName}
              teamAPlayer1={match.settings.teamAPlayer1}
              teamAPlayer2={match.settings.teamAPlayer2}
              teamBPlayer1={match.settings.teamBPlayer1}
              teamBPlayer2={match.settings.teamBPlayer2}
              teamAPlayersOnLeft={match.teamAPlayersOnLeft}
              teamAPlayersOnRight={match.teamAPlayersOnRight}
              teamBPlayersOnLeft={match.teamBPlayersOnLeft}
              teamBPlayersOnRight={match.teamBPlayersOnRight}
              servingTeam={match.servingTeam}
              serverNumber={match.serverNumber}
              leftSideTeam={match.leftSideTeam}
              teamAColor={match.settings.teamAColor}
              teamBColor={match.settings.teamBColor}
              scoreA={match.scoreA}
              scoreB={match.scoreB}
            />
          </div>

          {/* SHARE SPECS BOX */}
          <div className="bg-black border-2 border-white/10 rounded-sm p-5 shadow-sm space-y-4" id="distribution-panel">
            <h3 className="font-black text-[10px] text-white uppercase tracking-widest">Live Broadcast Links & Embeds</h3>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
              Share or embed score boards to let spectators follow rallies in near-instant real-time.
            </p>

            {/* Links and embeds list */}
            <div className="space-y-3" id="copylinks-grid">
              
              {/* SPECTATOR SCORE PANEL */}
              <div className="p-3 bg-[#0F0F0F] border border-white/10 rounded-sm space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-white">Spectator Webpage</span>
                  <span className="text-[8px] text-[#CCFF00] font-mono font-black bg-[#CCFF00]/10 border border-[#CCFF00]/30 px-1.5 py-0.5 rounded-sm select-none uppercase tracking-widest">Spectate</span>
                </div>
                <div className="flex gap-1.5 items-center">
                  <input
                    id="link-spec-input"
                    type="text"
                    readOnly
                    value={viewerUrl}
                    className="flex-1 bg-black border border-white/10 text-[10px] p-2 rounded-sm text-white/70 font-mono focus:outline-none focus:border-[#CCFF00]"
                  />
                  <button
                    id="copy-spec-btn"
                    onClick={() => copyToClipboard(viewerUrl, 'viewer')}
                    className="p-2 border border-white/10 bg-black hover:bg-[#0F0F0F] text-white/70 hover:text-white rounded-sm transition-colors cursor-pointer"
                    title="Copy viewer link"
                  >
                    {copiedLink === 'viewer' ? <Check className="w-3.5 h-3.5 text-[#CCFF00]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* EMBED CODE GENERATOR */}
              <div className="p-3 bg-[#0F0F0F] border border-white/10 rounded-sm space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-white">Website Iframe Widget</span>
                  <span className="text-[8px] text-white/50 font-mono font-black bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-sm select-none uppercase tracking-widest">Embed</span>
                </div>
                <div className="flex gap-1.5 items-end">
                  <textarea
                    id="link-embed-textarea"
                    readOnly
                    rows={2}
                    value={`<iframe src="${embedUrl}" width="100%" height="320" style="border:none;background:#000000;border-radius:0px;"></iframe>`}
                    className="flex-1 bg-black border border-white/10 text-[9px] p-2 rounded-sm text-white/70 font-mono focus:outline-none focus:border-[#CCFF00] resize-none h-14"
                  />
                  <button
                    id="copy-embed-btn"
                    onClick={() => copyToClipboard(`<iframe src="${embedUrl}" width="100%" height="320" style="border:none;background:#000000;border-radius:0px;"></iframe>`, 'embed')}
                    className="p-3 border border-white/10 bg-black hover:bg-[#0F0F0F] text-white/70 hover:text-white rounded-sm transition-colors cursor-pointer font-mono"
                    title="Copy iframe HTML snippet"
                  >
                    {copiedLink === 'embed' ? <Check className="w-3.5 h-3.5 text-[#CCFF00]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* RE-ENTRY CHANNELS */}
              <div className="p-3 bg-[#0F0F0F] border border-red-500/10 rounded-sm space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-wider text-red-400">Save Secret Referee Link</span>
                  <span className="text-[8px] text-red-400 font-mono font-black bg-red-950/20 border border-red-900/40 px-1.5 py-0.5 rounded-sm select-none uppercase tracking-widest">Private</span>
                </div>
                <p className="text-[10px] text-white/30 uppercase tracking-wider font-bold">
                  Save or bookmark this private link so you can return to keep score on this match if your page reloads.
                </p>
                <div className="flex gap-1.5 items-center">
                  <input
                    id="link-referee-input"
                    type="password"
                    readOnly
                    value={refereeUrl}
                    className="flex-1 bg-black border border-white/10 text-[10px] p-2 rounded-sm text-white/50 font-mono focus:outline-none focus:border-red-500"
                  />
                  <button
                    id="copy-ref-btn"
                    onClick={() => copyToClipboard(refereeUrl, 'ref')}
                    className="p-2 border border-white/10 bg-black hover:bg-[#0F0F0F] text-white/70 hover:text-white rounded-sm transition-colors cursor-pointer"
                    title="Copy Private referee link"
                  >
                    {copiedLink === 'ref' ? <Check className="w-3.5 h-3.5 text-[#CCFF00]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
