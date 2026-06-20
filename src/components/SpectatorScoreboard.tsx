/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { MatchState } from '../types.js';
import { Trophy, HelpCircle, Activity, Zap, ExternalLink, RefreshCw, Timer } from 'lucide-react';

interface SpectatorScoreboardProps {
  matchId: string;
}

export default function SpectatorScoreboard({ matchId }: SpectatorScoreboardProps) {
  const [match, setMatch] = useState<MatchState | null>(null);
  const [error, setError] = useState('');
  const [lastSynced, setLastSynced] = useState<number>(Date.now());

  // Local game clock states for spectators
  const [gameTimerSeconds, setGameTimerSeconds] = useState<number>(0);
  const [isTimerActive, setIsTimerActive] = useState<boolean>(false);

  // Background polling to fetch scoreboards dynamically
  useEffect(() => {
    const fetchMatchState = async () => {
      try {
        const response = await fetch(`/api/matches/${matchId}`);
        if (!response.ok) {
          throw new Error('This match does not exist or has been archived.');
        }
        const stateData = await response.json();
        setMatch(stateData);
        setLastSynced(Date.now());
        setError('');
      } catch (err: any) {
        setError(err?.message || 'Failed to establish connection with referee server.');
      }
    };

    fetchMatchState(); // fetch immediately

    const interval = setInterval(fetchMatchState, 2000); // refresh every 2s
    return () => clearInterval(interval);
  }, [matchId]);

  // Sync polling result with local clock states
  useEffect(() => {
    if (match) {
      if (match.gameTimerSeconds !== undefined) {
        // Only override if the difference is substantial (> 4 seconds) to prevent jumping back and forth
        // or if the timer state is paused/switched.
        const diff = Math.abs(gameTimerSeconds - match.gameTimerSeconds);
        if (diff > 4 || !match.isTimerActive || gameTimerSeconds === 0) {
          setGameTimerSeconds(match.gameTimerSeconds);
        }
      }
      if (match.isTimerActive !== undefined) {
        setIsTimerActive(match.isTimerActive);
      }
    }
  }, [match]);

  // Local spectator ticking effect
  useEffect(() => {
    let timerId: NodeJS.Timeout | null = null;
    if (isTimerActive && gameTimerSeconds > 0) {
      timerId = setTimeout(() => {
        setGameTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [isTimerActive, gameTimerSeconds]);

  const formatTimerValue = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (error) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-4" id="spectator-error">
        <div className="inline-flex p-3 rounded-full bg-red-500/10 text-red-400">
          <HelpCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-100">Scoreboard Unreachable</h2>
        <p className="text-sm text-slate-400">
          {error}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition"
        >
          Try Connecting Again
        </button>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]" id="spectator-loading">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
        <p className="text-sm text-slate-400 mt-3 font-semibold">Tuning broadcasting frequency...</p>
      </div>
    );
  }

  const isCompleted = match.status === 'completed';
  const activePointsTarget = match.currentGameIndex === (match.settings.bestOfGames - 1) && match.settings.bestOfGames > 1
    ? match.settings.tiebreakPoints
    : match.settings.pointsPerGame;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6" id="spectator-scoreboard-container">
      
      {/* BROADCAST HEADER BANNER */}
      <div className="flex justify-between items-center bg-[#0F0F0F] p-4 border border-white/10 rounded-sm shadow-md">
        <div className="flex items-center gap-2.5">
          <Activity className="w-5 h-5 text-[#CCFF00] animate-pulse" />
          <div>
            <span className="text-[10px] text-[#CCFF00] font-black tracking-widest uppercase block">
              LIVE BROADCAST FEED
            </span>
            <span className="text-[11px] text-white/40 font-bold uppercase tracking-wider flex items-center gap-x-3 gap-y-1 flex-wrap mt-0.5">
              <span>{match.settings.isDoubles ? 'Doubles' : 'Singles'}</span>
              <span>•</span>
              <span>Best of {match.settings.bestOfGames}</span>
              <span>•</span>
              <span>Scoring: <strong className="text-amber-400 font-bold">{match.settings.scoringFormat === 'rally' ? 'Rally' : 'Side-Out'}</strong></span>
              <span>•</span>
              <span>Game Time: <strong className="text-[#CCFF00] font-bold">{match.settings.gameTimerLimit ? `${match.settings.gameTimerLimit} Mins` : 'No Limit'}</strong></span>
            </span>
          </div>
        </div>

        <div className="text-right text-[10px] font-mono text-white/40 uppercase font-bold tracking-widest">
          <span>Synced: <strong>{new Date(lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong></span>
        </div>
      </div>

      {/* GAME CLOCK / COUNTDOWN (FOR SPECTATOR DISPLAY) */}
      <div className="bg-[#0F0F0F] border border-white/10 rounded-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md" id="spectator-clock-widget">
        <div className="flex items-center gap-2.5">
          <Timer className={`w-5 h-5 ${isTimerActive ? 'text-[#CCFF00] animate-pulse' : 'text-white/40'}`} />
          <div>
            <span className="text-[10px] text-white/50 uppercase tracking-widest font-black block">Game Clock Status</span>
            <span className="text-[11px] text-[#CCFF00] font-mono font-bold uppercase tracking-widest">
              {isTimerActive ? 'Countdown Active' : 'Countdown Paused'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-black/50 border border-white/5 rounded-sm px-6 py-2.5 min-w-[180px] justify-center relative overflow-hidden">
          {gameTimerSeconds === 0 ? (
            <div className="text-center animate-pulse py-0.5" id="spectator-times-up">
              <span className="text-red-500 font-mono text-xl font-extrabold tracking-wider block">
                TIME'S UP!
              </span>
            </div>
          ) : (
            <div className="text-center">
              <span className="text-[#CCFF00] font-mono text-3xl font-black tracking-widest" id="spectator-clock-digits">
                {formatTimerValue(gameTimerSeconds)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* CORE DISPLAY (TV BRONZE BANNER) */}
      <div className="bg-black border-2 border-white/10 rounded-sm overflow-hidden relative" id="tv-score-canvas">
        
        {/* Championship Ring Overlay if finished */}
        {isCompleted && (
          <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center text-center p-6 z-30" id="championship-screen">
            <div className="p-4 rounded-sm bg-[#CCFF00]/10 border-2 border-[#CCFF00]/20 text-[#CCFF00] mb-4 animate-bounce">
              <Trophy className="w-12 h-12" />
            </div>
            
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
              MATCH CHAMPIONS
            </h2>
            <p className="text-xl font-extrabold mt-2 font-mono uppercase tracking-widest" style={{ color: match.winner === 'A' ? match.settings.teamAColor : match.settings.teamBColor }}>
              {match.winner === 'A' ? match.settings.teamAName : match.settings.teamBName}
            </p>

            {/* Set scoring summary in winner overlay */}
            <div className="mt-6 flex gap-3 text-xs bg-[#0F0F0F] p-4 rounded-sm border border-white/10">
              {match.games.map((g, idx) => {
                if (idx > match.currentGameIndex) return null;
                return (
                  <div key={`summary-tab-${idx}`} className="px-3 border-r last:border-0 border-white/10 text-center">
                    <span className="text-[10px] text-white/30 uppercase tracking-widest font-black block">Game {idx + 1}</span>
                    <span className="font-mono font-black text-sm text-white mt-1 inline-block">
                      {g.teamAScore} - {g.teamBScore}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => window.location.reload()}
              className="mt-8 px-6 py-2.5 rounded-sm border border-white/10 bg-[#0F0F0F] text-white font-mono font-black uppercase text-xs hover:text-[#CCFF00] hover:border-[#CCFF00] transition cursor-pointer"
            >
              Refresh View
            </button>
          </div>
        )}

        {/* Current Active Game Marker */}
        <div className="bg-[#0F0F0F] text-center border-b border-white/10 py-3 text-[10px] uppercase font-mono tracking-widest font-black text-[#CCFF00]">
          Game {match.currentGameIndex + 1} of {match.settings.bestOfGames} (Target: {activePointsTarget} pts)
        </div>

        {/* Live point scoring rows */}
        <div className="divide-y divide-white/10">
          
          {/* Row TEAM A */}
          <div className="grid grid-cols-12 md:grid-cols-12 min-h-[140px] items-center p-6 transition-all" id="tv-row-teama">
            
            {/* Team Badging */}
            <div className="col-span-8 md:col-span-9 flex items-center gap-4">
              <div 
                className="w-4 h-16 rounded-sm shrink-0" 
                style={{ backgroundColor: match.settings.teamAColor, boxShadow: match.servingTeam === 'A' ? `0 0 16px ${match.settings.teamAColor}` : 'none' }}
              />

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-2xl md:text-3xl font-black text-white hover:opacity-90 select-none uppercase tracking-tight">
                    {match.settings.teamAName}
                  </h3>
                  {match.servingTeam === 'A' && (
                    <span className="text-[9px] text-black bg-[#CCFF00] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm flex items-center gap-0.5 animate-pulse">
                      <Zap className="w-2.5 h-2.5 fill-black animate-spin" />
                      SERVE {match.settings.isDoubles ? `(S${match.serverNumber})` : ''}
                    </span>
                  )}
                </div>

                {/* Subplayers info */}
                <p className="text-xs text-white/40 font-bold uppercase tracking-wider">
                  {match.settings.isDoubles 
                    ? `Players: ${match.settings.teamAPlayer1} & ${match.settings.teamAPlayer2}`
                    : `Individual: ${match.settings.teamAPlayer1}`}
                </p>

                {/* Timeouts charge info */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[9px] text-white/30 uppercase font-mono font-bold tracking-widest">Timeouts:</span>
                  <div className="flex gap-1">
                    {[1, 2].map((num) => (
                      <div 
                        key={`timeout-dot-a-${num}`} 
                        className={`w-3 h-1.5 rounded-sm border ${
                          num <= match.timeoutsUsedA 
                            ? 'bg-[#CCFF00] border-[#CCFF00]' 
                            : 'bg-[#0F0F0F] border-white/10'
                        }`} 
                        title={`Timeout ${num}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Set points list */}
            <div className="col-span-2 md:col-span-1 hidden md:flex flex-col items-center">
              <span className="text-[9px] text-white/30 uppercase tracking-widest block font-mono font-black">Games Won</span>
              <span className="text-2xl font-mono font-black text-white mt-1">{match.teamAGamesWon}</span>
            </div>

            {/* Live Point Counter */}
            <div className="col-span-4 md:col-span-2 text-right">
              <span className="font-mono text-7xl md:text-8xl font-black text-white block pr-2 select-none" id="tv-points-a">
                {match.scoreA}
              </span>
            </div>

          </div>

          {/* Row TEAM B */}
          <div className="grid grid-cols-12 md:grid-cols-12 min-h-[140px] items-center p-6 transition-all" id="tv-row-teamb">
            
            {/* Team Badging */}
            <div className="col-span-8 md:col-span-9 flex items-center gap-4">
              <div 
                className="w-4 h-16 rounded-sm shrink-0" 
                style={{ backgroundColor: match.settings.teamBColor, boxShadow: match.servingTeam === 'B' ? `0 0 16px ${match.settings.teamBColor}` : 'none' }}
              />

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-2xl md:text-3xl font-black text-white hover:opacity-90 select-none uppercase tracking-tight">
                    {match.settings.teamBName}
                  </h3>
                  {match.servingTeam === 'B' && (
                    <span className="text-[9px] text-black bg-[#CCFF00] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm flex items-center gap-0.5 animate-pulse">
                      <Zap className="w-2.5 h-2.5 fill-black animate-spin" />
                      SERVE {match.settings.isDoubles ? `(S${match.serverNumber})` : ''}
                    </span>
                  )}
                </div>

                {/* Subplayers info */}
                <p className="text-xs text-white/40 font-bold uppercase tracking-wider">
                  {match.settings.isDoubles 
                    ? `Players: ${match.settings.teamBPlayer1} & ${match.settings.teamBPlayer2}`
                    : `Individual: ${match.settings.teamBPlayer1}`}
                </p>

                {/* Timeouts charge info */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[9px] text-white/30 uppercase font-mono font-bold tracking-widest">Timeouts:</span>
                  <div className="flex gap-1">
                    {[1, 2].map((num) => (
                      <div 
                        key={`timeout-dot-b-${num}`} 
                        className={`w-3 h-1.5 rounded-sm border ${
                          num <= match.timeoutsUsedB
                            ? 'bg-[#CCFF00] border-[#CCFF00]' 
                            : 'bg-[#0F0F0F] border-white/10'
                        }`} 
                        title={`Timeout ${num}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Set points list */}
            <div className="col-span-2 md:col-span-1 hidden md:flex flex-col items-center">
              <span className="text-[9px] text-white/30 uppercase tracking-widest block font-mono font-black">Games Won</span>
              <span className="text-2xl font-mono font-black text-white mt-1">{match.teamBGamesWon}</span>
            </div>

            {/* Live Point Counter */}
            <div className="col-span-4 md:col-span-2 text-right">
              <span className="font-mono text-7xl md:text-8xl font-black text-white block pr-2 select-none" id="tv-points-b">
                {match.scoreB}
              </span>
            </div>

          </div>

        </div>

      </div>

      {/* FULL SET HISTORY STATISTICS CARD */}
      <div className="bg-[#0F0F0F] border border-white/10 rounded-sm p-6 shadow-md space-y-4" id="spectator-set-history-details">
        <h3 className="text-[10px] font-black text-[#CCFF00] uppercase tracking-widest flex items-center gap-1.5">
          <Trophy className="w-4 h-4 text-[#CCFF00]" />
          Scorecard Summary Box
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left font-sans text-xs" id="history-details-table">
            <thead>
              <tr className="border-b border-white/10 text-white/40 font-bold uppercase tracking-widest text-[9px]">
                <th className="py-3 px-4">Teams</th>
                {match.games.map((g, idx) => (
                  <th key={`hdr-game-${idx}`} className="py-3 px-4 text-center">
                    Game {idx + 1}
                  </th>
                ))}
                <th className="py-3 px-4 text-right">Total Games</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-extrabold uppercase tracking-wider text-[11px] text-white/80">
              <tr>
                <td className="py-4 px-4 flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: match.settings.teamAColor }} />
                  <span className="text-white font-extrabold">{match.settings.teamAName}</span>
                </td>
                {match.games.map((g, idx) => {
                  const isCurrent = idx === match.currentGameIndex && !isCompleted;
                  return (
                    <td key={`score-a-${idx}`} className={`py-4 px-4 text-center font-mono text-xs ${isCurrent ? 'bg-white/5 font-black text-[#CCFF00]' : 'text-white/40'}`}>
                      {idx <= match.currentGameIndex ? (idx === match.currentGameIndex && !isCompleted ? match.scoreA : g.teamAScore) : '--'}
                    </td>
                  );
                })}
                <td className="py-4 px-4 text-right text-white font-mono text-xs">
                  {match.teamAGamesWon}
                </td>
              </tr>
              <tr>
                <td className="py-4 px-4 flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: match.settings.teamBColor }} />
                  <span className="text-white font-extrabold">{match.settings.teamBName}</span>
                </td>
                {match.games.map((g, idx) => {
                  const isCurrent = idx === match.currentGameIndex && !isCompleted;
                  return (
                    <td key={`score-b-${idx}`} className={`py-4 px-4 text-center font-mono text-xs ${isCurrent ? 'bg-white/5 font-black text-[#CCFF00]' : 'text-white/40'}`}>
                      {idx <= match.currentGameIndex ? (idx === match.currentGameIndex && !isCompleted ? match.scoreB : g.teamBScore) : '--'}
                    </td>
                  );
                })}
                <td className="py-4 px-4 text-right text-white font-mono text-xs">
                  {match.teamBGamesWon}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
