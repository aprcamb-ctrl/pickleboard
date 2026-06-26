/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { MatchState } from '../types.js';
import { Zap, RefreshCw } from 'lucide-react';

interface EmbedScoreboardProps {
  matchId: string;
}

export default function EmbedScoreboard({ matchId }: EmbedScoreboardProps) {
  const [match, setMatch] = useState<MatchState | null>(null);
  const [error, setError] = useState(false);

  // Set body background to transparent for clean stream integration
  useEffect(() => {
    const originalBg = document.body.style.backgroundColor;
    document.body.style.backgroundColor = 'transparent';
    return () => {
      document.body.style.backgroundColor = originalBg;
    };
  }, []);

  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch(`/api/matches/${matchId}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setMatch(data);
        setError(false);
      } catch {
        setError(true);
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 1500); // slightly faster refresh for live widgets
    return () => clearInterval(interval);
  }, [matchId]);

  if (error) {
    return (
      <div className="bg-[#0F0F0F] text-white/40 p-4 border border-white/10 text-[10px] font-mono text-center rounded-sm uppercase tracking-widest font-black" id="embed-error">
        Scoreboard connection lost. Checking feed...
      </div>
    );
  }

  if (!match) {
    return (
      <div className="bg-[#0F0F0F] p-4 flex items-center justify-center h-20 text-[10px] text-[#CCFF00] font-mono gap-1.5 border border-white/10 rounded-sm font-black uppercase tracking-widest" id="embed-loading">
        <RefreshCw className="w-3.5 h-3.5 text-[#CCFF00] animate-spin" />
        Syncing live feed...
      </div>
    );
  }

  const isCompleted = match.status === 'completed';

  return (
    <div className="bg-transparent border-0 text-white rounded-none overflow-hidden p-3.5 flex flex-col select-none w-full max-w-[450px] mx-auto" id="embed-widget-container">
      <style>{`
        body { 
          background-color: transparent !important; 
          margin: 0px auto; 
          overflow: hidden; 
        }
        #embed-widget-container {
          background: transparent !important;
          border: none !important;
          border-radius: 0px !important;
        }
      `}</style>
      {/* Widget Header bar */}
      <div className="flex justify-between items-center text-[10px] text-white font-black uppercase tracking-widest border-b border-white/10 pb-1.5 mb-2">
        <span className="flex items-center gap-1.5 text-[#CCFF00]">
          <span className="w-2 h-2 rounded-full bg-[#CCFF00] animate-ping inline-block" />
          Live Scoring
        </span>
        <span className="font-mono text-white">
          {isCompleted 
            ? 'Completed' 
            : `Game ${match.currentGameIndex + 1} of ${match.settings.bestOfGames}`}
        </span>
      </div>

      {/* Row scoreboard container */}
      <div className="space-y-2.5 my-1">
        
        {/* TEAM A LINE */}
        <div className="flex items-center justify-between" id="embed-row-teama">
          <div className="flex items-center gap-2 max-w-[70%]">
            <div 
              className="w-2.5 h-2.5 rounded-sm shrink-0" 
              style={{ backgroundColor: match.settings.teamAColor }} 
            />
            {match.servingTeam === 'A' && !isCompleted && (
              <Zap className="w-3.5 h-3.5 text-[#CCFF00] shrink-0 fill-[#CCFF00] animate-pulse" />
            )}
            <span className="text-sm font-black uppercase tracking-tight truncate text-white">
              {match.settings.teamAName}
            </span>
            {match.servingTeam === 'A' && !isCompleted && match.settings.isDoubles && (
              <span className="font-mono text-[9px] text-black font-black bg-[#CCFF00] px-1 rounded-sm">
                S{match.serverNumber}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3.5">
            {/* Prev games tallies */}
            <div className="flex gap-1">
              {match.games.map((g, idx) => {
                if (idx > match.currentGameIndex) return null;
                const isThisCurrent = idx === match.currentGameIndex && !isCompleted;
                return (
                  <span 
                    key={`em-ga-${idx}`} 
                    className={`font-mono text-[11px] font-black px-1 rounded-sm ${
                      isThisCurrent ? 'hidden' : 'text-white bg-[#1A1A1A]'
                    }`}
                  >
                    {idx === match.currentGameIndex ? match.scoreA : g.teamAScore}
                  </span>
                );
              })}
            </div>

            {/* Match games tally */}
            {match.settings.bestOfGames > 1 && (
              <div className="text-right border-l border-white/10 pl-3">
                <span className="text-[9px] text-white uppercase tracking-widest font-mono block">Games</span>
                <span className="font-mono text-xs font-black text-white">{match.teamAGamesWon}</span>
              </div>
            )}

            {/* Current point live display */}
            <div className={`w-10 text-center py-1 px-2 rounded-sm border ${match.servingTeam === 'A' && !isCompleted ? 'bg-black border-[#CCFF00]' : 'bg-[#0F0F0F] border-white/15'}`}>
              <span className={`font-mono text-base font-black ${match.servingTeam === 'A' && !isCompleted ? 'text-[#CCFF00]' : 'text-white'}`}>
                {match.scoreA}
              </span>
            </div>
          </div>
        </div>

        {/* TEAM B LINE */}
        <div className="flex items-center justify-between" id="embed-row-teamb">
          <div className="flex items-center gap-2 max-w-[70%]">
            <div 
              className="w-2.5 h-2.5 rounded-sm shrink-0" 
              style={{ backgroundColor: match.settings.teamBColor }} 
            />
            {match.servingTeam === 'B' && !isCompleted && (
              <Zap className="w-3.5 h-3.5 text-[#CCFF00] shrink-0 fill-[#CCFF00] animate-pulse" />
            )}
            <span className="text-sm font-black uppercase tracking-tight truncate text-white">
              {match.settings.teamBName}
            </span>
            {match.servingTeam === 'B' && !isCompleted && match.settings.isDoubles && (
              <span className="font-mono text-[9px] text-black font-black bg-[#CCFF00] px-1 rounded-sm">
                S{match.serverNumber}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3.5">
            {/* Prev games tallies */}
            <div className="flex gap-1">
              {match.games.map((g, idx) => {
                if (idx > match.currentGameIndex) return null;
                const isThisCurrent = idx === match.currentGameIndex && !isCompleted;
                return (
                  <span 
                    key={`em-gb-${idx}`} 
                    className={`font-mono text-[11px] font-black px-1 rounded-sm ${
                      isThisCurrent ? 'hidden' : 'text-white bg-[#1A1A1A]'
                    }`}
                  >
                    {idx === match.currentGameIndex ? match.scoreB : g.teamBScore}
                  </span>
                );
              })}
            </div>

            {/* Match games tally */}
            {match.settings.bestOfGames > 1 && (
              <div className="text-right border-l border-white/10 pl-3">
                <span className="text-[9px] text-white uppercase tracking-widest font-mono block">Games</span>
                <span className="font-mono text-xs font-black text-white">{match.teamBGamesWon}</span>
              </div>
            )}

            {/* Current point live display */}
            <div className={`w-10 text-center py-1 px-2 rounded-sm border ${match.servingTeam === 'B' && !isCompleted ? 'bg-black border-[#CCFF00]' : 'bg-[#0F0F0F] border-white/15'}`}>
              <span className={`font-mono text-base font-black ${match.servingTeam === 'B' && !isCompleted ? 'text-[#CCFF00]' : 'text-white'}`}>
                {match.scoreB}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Widget Footer description */}
      {isCompleted && (
        <div className="mt-2 text-center text-[10px] text-[#CCFF00] font-black uppercase tracking-widest border-t border-white/10 pt-2 flex items-center justify-center gap-1" id="embed-completed-badge">
          Winner: {match.winner === 'A' ? match.settings.teamAName : match.settings.teamBName}
        </div>
      )}
    </div>
  );
}
