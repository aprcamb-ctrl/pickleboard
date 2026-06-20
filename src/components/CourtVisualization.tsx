/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Zap } from 'lucide-react';

interface CourtVisualizationProps {
  isDoubles: boolean;
  teamAName: string;
  teamBName: string;
  teamAPlayer1: string;
  teamAPlayer2: string;
  teamBPlayer1: string;
  teamBPlayer2: string;
  teamAPlayersOnLeft: string;
  teamAPlayersOnRight: string;
  teamBPlayersOnLeft: string;
  teamBPlayersOnRight: string;
  servingTeam: 'A' | 'B';
  serverNumber: 1 | 2;
  leftSideTeam: 'A' | 'B';
  teamAColor: string;
  teamBColor: string;
  scoreA?: number;
  scoreB?: number;
}

export default function CourtVisualization({
  isDoubles,
  teamAName,
  teamBName,
  teamAPlayer1,
  teamAPlayer2,
  teamBPlayer1,
  teamBPlayer2,
  teamAPlayersOnLeft,
  teamAPlayersOnRight,
  teamBPlayersOnLeft,
  teamBPlayersOnRight,
  servingTeam,
  serverNumber,
  leftSideTeam,
  teamAColor,
  teamBColor,
  scoreA = 0,
  scoreB = 0,
}: CourtVisualizationProps) {
  // Determine who represents the left and right teams physically on screen
  const isAOnLeft = leftSideTeam === 'A';
  
  const leftTeamName = isAOnLeft ? teamAName : teamBName;
  const rightTeamName = isAOnLeft ? teamBName : teamAName;
  
  const leftTeamColor = isAOnLeft ? teamAColor : teamBColor;
  const rightTeamColor = isAOnLeft ? teamBColor : teamAColor;

  // Retrieve player names assigned on Left vs Right court side for physical left vs right screen positions
  const leftTeamLeftPlayer = isAOnLeft ? teamAPlayersOnLeft : teamBPlayersOnLeft;
  const leftTeamRightPlayer = isAOnLeft ? teamAPlayersOnRight : teamBPlayersOnRight;

  const rightTeamLeftPlayer = isAOnLeft ? teamBPlayersOnLeft : teamAPlayersOnLeft;
  const rightTeamRightPlayer = isAOnLeft ? teamBPlayersOnRight : teamAPlayersOnRight;

  // Compute the active server name
  const getActiveServer = () => {
    if (servingTeam === 'A') {
      if (!isDoubles) return teamAPlayer1;
      const isEven = scoreA % 2 === 0;
      return isEven ? teamAPlayersOnRight : teamAPlayersOnLeft;
    } else {
      if (!isDoubles) return teamBPlayer1;
      const isEven = scoreB % 2 === 0;
      return isEven ? teamBPlayersOnRight : teamBPlayersOnLeft;
    }
  };

  const activeServerName = getActiveServer();

  // Helper check if a player is serving
  const isPlayerServing = (playerName: string | undefined): boolean => {
    if (!playerName) return false;
    return playerName === activeServerName;
  };

  return (
    <div className="space-y-3" id="court-visualization-container">
      <div className="flex justify-between items-center px-1">
        <span className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-[#CCFF00] animate-pulse" />
          Court Positions Map (Spec-TV)
        </span>
        <span className="text-[9px] text-white/40 uppercase tracking-widest font-bold font-mono">
          Interactive Court Visual
        </span>
      </div>

      {/* Outer Court Frame */}
      <div className="bg-[#0A0A0A] border-2 border-white/10 p-2.5 rounded-sm relative overflow-hidden aspect-[2/1] min-h-[220px] shadow-lg select-none flex flex-col justify-stretch">
        
        {/* Court layout splits */}
        <div className="flex-1 grid grid-cols-2 relative">
          
          {/* NET lines */}
          <div className="absolute top-0 bottom-0 left-1/2 w-1.5 bg-white/25 z-10 -translate-x-1/2 flex flex-col justify-between py-1 shadow-md">
            <div className="w-2.5 h-2.5 bg-white/60 rounded-sm -translate-x-0.5" />
            <div className="w-1.5 h-1/2 border-l border-r border-white/20 border-dashed" />
            <div className="w-2.5 h-2.5 bg-white/60 rounded-sm -translate-x-0.5" />
          </div>

          {/* PHYSICAL LEFT TEAM HALF */}
          <div className="relative border-r border-white/20 flex">
            {/* Left Side Service Courts */}
            <div className="w-2/3 grid grid-rows-2 divide-y divide-white/20">
              
              {/* TOP / LEFT Service Court (relative to left player) */}
              <div className="p-2 flex flex-col items-center justify-center relative hover:bg-white/5 transition-colors">
                <span className="absolute top-1.5 left-2 border border-white/10 bg-[#0F0F0F] text-[8px] text-white/40 font-mono px-1 rounded-sm uppercase tracking-wider">
                  Left Court
                </span>
                
                {leftTeamLeftPlayer ? (
                  <div className={`text-center z-10 p-1.5 rounded-sm transition-all ${isPlayerServing(leftTeamLeftPlayer) ? 'ring-2 ring-[#CCFF00] bg-[#CCFF00]/5' : ''}`}>
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className="text-xs font-extrabold text-[#CCFF00] tracking-tight uppercase truncate max-w-[120px] inline-block">
                        {leftTeamLeftPlayer}
                      </span>
                      {isPlayerServing(leftTeamLeftPlayer) && (
                        <span className="text-[8px] bg-[#CCFF00] text-black font-black px-1 py-0.5 rounded-sm uppercase tracking-wide flex items-center gap-0.5 animate-pulse select-none">
                          <Zap className="w-2 h-2 fill-black" /> Server
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="text-[10px] text-white/20 uppercase font-bold tracking-wider">Empty</span>
                )}
              </div>

              {/* BOTTOM / RIGHT Service Court */}
              <div className="p-2 flex flex-col items-center justify-center relative hover:bg-[#CCFF00]/5 transition-colors">
                <span className="absolute bottom-1.5 left-2 border border-white/10 bg-[#0F0F0F] text-[8px] text-white/40 font-mono px-1 rounded-sm uppercase tracking-wider">
                  Right Court
                </span>
                
                {leftTeamRightPlayer ? (
                  <div className={`text-center z-10 p-1.5 rounded-sm transition-all ${isPlayerServing(leftTeamRightPlayer) ? 'ring-2 ring-[#CCFF00] bg-[#CCFF00]/5' : ''}`}>
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className="text-xs font-extrabold text-[#CCFF00] tracking-tight uppercase truncate max-w-[120px] inline-block">
                        {leftTeamRightPlayer}
                      </span>
                      {isPlayerServing(leftTeamRightPlayer) && (
                        <span className="text-[8px] bg-[#CCFF00] text-black font-black px-1 py-0.5 rounded-sm uppercase tracking-wide flex items-center gap-0.5 animate-pulse select-none">
                          <Zap className="w-2 h-2 fill-black" /> Server
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="text-[10px] text-white/20 uppercase font-bold tracking-wider">Empty</span>
                )}
              </div>
            </div>

            {/* Left Non-Volley Zone (The Kitchen) */}
            <div className="w-1/3 bg-[#111] border-l border-white/20 flex items-center justify-center relative">
              <span className="text-[9px] text-white/50 font-black uppercase tracking-widest rotate-270 select-none">
                Kitchen
              </span>
            </div>

            {/* Serving State Ribbon for LEFT team */}
            {servingTeam === (isAOnLeft ? 'A' : 'B') && (
              <div className="absolute -top-1 left-3 bg-[#CCFF00] text-black px-2 py-0.5 rounded-sm text-[8px] font-black tracking-widest flex items-center gap-1 animate-pulse z-20 uppercase">
                <Zap className="w-2.5 h-2.5 fill-black" />
                <span>SERVE (S{serverNumber})</span>
              </div>
            )}
          </div>

          {/* PHYSICAL RIGHT TEAM HALF */}
          <div className="relative flex">
            {/* Right Non-Volley Zone (The Kitchen) */}
            <div className="w-1/3 bg-[#111] border-r border-white/20 flex items-center justify-center relative">
              <span className="text-[9px] text-white/50 font-black uppercase tracking-widest rotate-90 select-none">
                Kitchen
              </span>
            </div>
            
            {/* Right Side Service Courts */}
            <div className="w-2/3 grid grid-rows-2 divide-y divide-white/20">
              
              {/* TOP / LEFT Service Court */}
              <div className="p-2 flex flex-col items-center justify-center relative hover:bg-white/5 transition-colors">
                <span className="absolute top-1.5 right-2 border border-white/10 bg-[#0F0F0F] text-[8px] text-white/40 font-mono px-1 rounded-sm uppercase tracking-wider">
                  Left Court
                </span>
                {rightTeamLeftPlayer ? (
                  <div className={`text-center z-10 p-1.5 rounded-sm transition-all ${isPlayerServing(rightTeamLeftPlayer) ? 'ring-2 ring-[#CCFF00] bg-[#CCFF00]/5' : ''}`}>
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className="text-xs font-extrabold text-[#CCFF00] tracking-tight uppercase truncate max-w-[120px] inline-block">
                        {rightTeamLeftPlayer}
                      </span>
                      {isPlayerServing(rightTeamLeftPlayer) && (
                        <span className="text-[8px] bg-[#CCFF00] text-black font-black px-1 py-0.5 rounded-sm uppercase tracking-wide flex items-center gap-0.5 animate-pulse select-none">
                          <Zap className="w-2 h-2 fill-black" /> Server
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="text-[10px] text-white/20 uppercase font-bold tracking-wider">Empty</span>
                )}
              </div>

              {/* BOTTOM / RIGHT Service Court */}
              <div className="p-2 flex flex-col items-center justify-center relative hover:bg-white/5 transition-colors">
                <span className="absolute bottom-1.5 right-2 border border-white/10 bg-[#0F0F0F] text-[8px] text-white/40 font-mono px-1 rounded-sm uppercase tracking-wider">
                  Right Court
                </span>
                {rightTeamRightPlayer ? (
                  <div className={`text-center z-10 p-1.5 rounded-sm transition-all ${isPlayerServing(rightTeamRightPlayer) ? 'ring-2 ring-[#CCFF00] bg-[#CCFF00]/5' : ''}`}>
                    <div className="flex flex-col items-center justify-center gap-1">
                      <span className="text-xs font-extrabold text-[#CCFF00] tracking-tight uppercase truncate max-w-[120px] inline-block">
                        {rightTeamRightPlayer}
                      </span>
                      {isPlayerServing(rightTeamRightPlayer) && (
                        <span className="text-[8px] bg-[#CCFF00] text-black font-black px-1 py-0.5 rounded-sm uppercase tracking-wide flex items-center gap-0.5 animate-pulse select-none">
                          <Zap className="w-2 h-2 fill-black" /> Server
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="text-[10px] text-white/20 uppercase font-bold tracking-wider">Empty</span>
                )}
              </div>
            </div>

            {/* Serving State Ribbon for RIGHT team */}
            {servingTeam === (isAOnLeft ? 'B' : 'A') && (
              <div className="absolute -top-1 right-3 bg-[#CCFF00] text-black px-2 py-0.5 rounded-sm text-[8px] font-black tracking-widest flex items-center gap-1 animate-pulse z-20 uppercase">
                <Zap className="w-2.5 h-2.5 fill-black" />
                <span>SERVE (S{serverNumber})</span>
              </div>
            )}
          </div>

        </div>

        {/* Display Banner below court */}
        <div className="border-t border-white/10 pt-1.5 mt-1.5 flex justify-between items-center text-[10px] font-mono uppercase tracking-wider text-white/50">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: leftTeamColor }} />
            <span className="truncate max-w-[140px] font-black text-white">{leftTeamName}</span>
          </div>
          <span className="text-[#CCFF00] font-mono uppercase text-[9px] tracking-widest font-black">
            Net Divider
          </span>
          <div className="flex items-center gap-1 justify-end">
            <span className="truncate max-w-[140px] font-black text-white">{rightTeamName}</span>
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: rightTeamColor }} />
          </div>
        </div>

      </div>
    </div>
  );
}
