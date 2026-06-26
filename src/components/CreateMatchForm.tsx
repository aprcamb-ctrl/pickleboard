/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { MatchSettings } from '../types.js';
import { Layers, User, Users, Palette, Settings, Trophy, Zap } from 'lucide-react';

interface CreateMatchFormProps {
  onSuccess: (settings: MatchSettings) => void;
}

const PRESET_COLORS = [
  { name: 'Crimson', value: '#ef4444' },
  { name: 'Sky', value: '#3b82f6' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Slate', value: '#475569' },
];

export default function CreateMatchForm({ onSuccess }: CreateMatchFormProps) {
  const [isDoubles, setIsDoubles] = useState(true);
  const [teamAName, setTeamAName] = useState('Team Alpha');
  const [teamBName, setTeamBName] = useState('Team Bravo');
  
  // Players
  const [teamAPlayer1, setTeamAPlayer1] = useState('Sarah Jenkins');
  const [teamAPlayer2, setTeamAPlayer2] = useState('Michael Chang');
  const [teamBPlayer1, setTeamBPlayer1] = useState('Alex Mercer');
  const [teamBPlayer2, setTeamBPlayer2] = useState('David Miller');

  // Colors
  const [teamAColor, setTeamAColor] = useState('#ef4444');
  const [teamBColor, setTeamBColor] = useState('#3b82f6');

  // Rules
  const [pointsPerGame, setPointsPerGame] = useState(11);
  const [customPoints, setCustomPoints] = useState('');
  const [winByTwo, setWinByTwo] = useState(true);
  const [bestOfGames, setBestOfGames] = useState(3);
  const [tiebreakPoints, setTiebreakPoints] = useState(11);
  const [initialService, setInitialService] = useState<'A' | 'B'>('A');
  const [scoringFormat, setScoringFormat] = useState<'side-out' | 'rally'>('side-out');
  const [gameTimerFormat, setGameTimerFormat] = useState<number>(11);
  const [customTimer, setCustomTimer] = useState<string>('');
  const [enableGameClock, setEnableGameClock] = useState(true);
  const [venue, setVenue] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const targetPoints = pointsPerGame === 0 ? parseInt(customPoints) || 11 : pointsPerGame;
    const targetTimer = gameTimerFormat === 0 ? parseInt(customTimer) || 11 : gameTimerFormat;

    const payload = {
      isDoubles,
      teamAName: isDoubles ? teamAName : teamAPlayer1,
      teamBName: isDoubles ? teamBName : teamBPlayer1,
      teamAPlayer1,
      teamAPlayer2: isDoubles ? teamAPlayer2 : '',
      teamBPlayer1,
      teamBPlayer2: isDoubles ? teamBPlayer2 : '',
      teamAColor,
      teamBColor,
      pointsPerGame: targetPoints,
      winByTwo,
      bestOfGames,
      tiebreakPoints,
      initialService,
      scoringFormat,
      gameTimerLimit: enableGameClock ? targetTimer : 0,
      enableGameClock,
      venue: venue.trim() || 'default-venue',
    };

    try {
      const response = await fetch('/api/matches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to create match on referee server.');
      }

      const matchState = await response.json();
      onSuccess(matchState.settings);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form id="create-match-form" onSubmit={handleSubmit} className="space-y-6 text-[#F5F5F5]">
      {error && (
        <div className="bg-red-950/20 border border-red-650/40 text-red-250 p-4 rounded-sm text-sm" id="form-error">
          {error}
        </div>
      )}

      {/* Singles vs Doubles Options */}
      <div>
        <label className="block text-[9px] uppercase font-bold text-white/40 mb-2">Match Format</label>
        <div className="grid grid-cols-2 gap-3 mt-1" id="format-toggle">
          <button
            id="format-doubles-btn"
            type="button"
            onClick={() => setIsDoubles(true)}
            className={`p-4 rounded-sm border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              isDoubles
                ? 'border-[#CCFF00] bg-[#CCFF00]/10 text-[#CCFF00] shadow-[0_0_15px_rgba(204,255,0,0.15)]'
                : 'border-white/10 bg-white/5 text-white/40 hover:border-white/20 hover:text-white'
            }`}
          >
            <Users className="w-5 h-5 text-current" />
            <span className="font-extrabold text-xs uppercase tracking-wider">Doubles</span>
            <span className="text-[10px] opacity-70">2v2 Partner Play</span>
          </button>
          
          <button
            id="format-singles-btn"
            type="button"
            onClick={() => setIsDoubles(false)}
            className={`p-4 rounded-sm border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              !isDoubles
                ? 'border-[#CCFF00] bg-[#CCFF00]/10 text-[#CCFF00] shadow-[0_0_15px_rgba(204,255,0,0.15)]'
                : 'border-white/10 bg-white/5 text-white/40 hover:border-white/20 hover:text-white'
            }`}
          >
            <User className="w-5 h-5 text-current" />
            <span className="font-extrabold text-xs uppercase tracking-wider">Singles</span>
            <span className="text-[10px] opacity-70">1v1 Individual Play</span>
          </button>
        </div>
      </div>

      {/* Venue Name Field */}
      <div>
        <label className="block text-[9px] uppercase font-bold text-white/40 mb-1">
          Venue / Club Name (Optional)
        </label>
        <input
          id="venue-name-input"
          type="text"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          className="w-full bg-black border border-white/10 rounded-sm p-2.5 text-white focus:outline-none focus:border-[#CCFF00] text-sm"
          placeholder="e.g. Torquay Tennis Club"
        />
        <span className="text-[9px] text-white/30 lowercase tracking-tight block mt-1.5 font-mono">
          Spectator URL: <span className="text-[#CCFF00]">/venue/{venue.trim() ? venue.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : 'default-venue'}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Team A Configurations */}
        <div className="space-y-4 p-5 rounded-sm border border-white/10 bg-[#0F0F0F]" id="team-a-panel">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: teamAColor }} />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#CCFF00]">Team Alpha</h3>
          </div>

          {isDoubles && (
            <div>
              <label className="block text-[9px] uppercase font-bold text-white/40 mb-1">Team Name</label>
              <input
                id="team-a-name-input"
                type="text"
                required
                value={teamAName}
                onChange={(e) => setTeamAName(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-sm p-2.5 text-white focus:outline-none focus:border-[#CCFF00] text-sm"
                placeholder="e.g. Dinking Devils"
              />
            </div>
          )}

          <div>
            <label className="block text-[9px] uppercase font-bold text-white/40 mb-1">
              {isDoubles ? 'Player 1 (Right Court Start)' : 'Player Name'}
            </label>
            <input
              id="team-a-p1-input"
              type="text"
              required
              value={teamAPlayer1}
              onChange={(e) => setTeamAPlayer1(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-sm p-2.5 text-white focus:outline-none focus:border-[#CCFF00] text-sm"
              placeholder="Full Name"
            />
          </div>

          {isDoubles && (
            <div>
              <label className="block text-[9px] uppercase font-bold text-white/40 mb-1">
                Player 2 (Left Court Start)
              </label>
              <input
                id="team-a-p2-input"
                type="text"
                required
                value={teamAPlayer2}
                onChange={(e) => setTeamAPlayer2(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-sm p-2.5 text-white focus:outline-none focus:border-[#CCFF00] text-sm"
                placeholder="Full Name"
              />
            </div>
          )}

          <div>
            <label className="block text-[9px] uppercase font-bold text-white/40 mb-2">Team Scoreboard Color</label>
            <div className="flex flex-wrap gap-2" id="team-a-color-picker">
              {PRESET_COLORS.map((c) => (
                <button
                  key={`team-a-color-${c.value}`}
                  type="button"
                  onClick={() => setTeamAColor(c.value)}
                  className={`w-7 h-7 rounded-sm transition-transform cursor-pointer flex items-center justify-center border ${
                    teamAColor === c.value ? 'scale-110 border-white' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                >
                  {teamColorCheck(teamAColor, c.value)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Team B Configurations */}
        <div className="space-y-4 p-5 rounded-sm border border-white/10 bg-[#0F0F0F]" id="team-b-panel">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: teamBColor }} />
            <h3 className="text-xs font-black uppercase tracking-wider text-[#CCFF00]">Team Beta</h3>
          </div>

          {isDoubles && (
            <div>
              <label className="block text-[9px] uppercase font-bold text-white/40 mb-1">Team Name</label>
              <input
                id="team-b-name-input"
                type="text"
                required
                value={teamBName}
                onChange={(e) => setTeamBName(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-sm p-2.5 text-white focus:outline-none focus:border-[#CCFF00] text-sm"
                placeholder="e.g. Lob Stars"
              />
            </div>
          )}

          <div>
            <label className="block text-[9px] uppercase font-bold text-white/40 mb-1">
              {isDoubles ? 'Player 1 (Right Court Start)' : 'Player Name'}
            </label>
            <input
              id="team-b-p1-input"
              type="text"
              required
              value={teamBPlayer1}
              onChange={(e) => setTeamBPlayer1(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-sm p-2.5 text-white focus:outline-none focus:border-[#CCFF00] text-sm"
              placeholder="Full Name"
            />
          </div>

          {isDoubles && (
            <div>
              <label className="block text-[9px] uppercase font-bold text-white/40 mb-1">
                Player 2 (Left Court Start)
              </label>
              <input
                id="team-b-p2-input"
                type="text"
                required
                value={teamBPlayer2}
                onChange={(e) => setTeamBPlayer2(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-sm p-2.5 text-white focus:outline-none focus:border-[#CCFF00] text-sm"
                placeholder="Full Name"
              />
            </div>
          )}

          <div>
            <label className="block text-[9px] uppercase font-bold text-white/40 mb-2">Team Scoreboard Color</label>
            <div className="flex flex-wrap gap-2" id="team-b-color-picker">
              {PRESET_COLORS.map((c) => (
                <button
                  key={`team-b-color-${c.value}`}
                  type="button"
                  onClick={() => setTeamBColor(c.value)}
                  className={`w-7 h-7 rounded-sm transition-transform cursor-pointer flex items-center justify-center border ${
                    teamBColor === c.value ? 'scale-110 border-white' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                >
                  {teamColorCheck(teamBColor, c.value)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Rules Configurations */}
      <div className="p-5 rounded-sm border border-white/10 bg-[#0F0F0F] space-y-5" id="rules-panel">
        <h3 className="text-[10px] font-black text-[#CCFF00] uppercase tracking-widest flex items-center gap-2 border-b border-white/10 pb-2">
          <Settings className="w-4 h-4 text-[#CCFF00]" />
          <span>Game Parameters & Match Rules</span>
        </h3>

        <div className="space-y-4">
          {/* Target Score */}
          <div className="space-y-1.5">
            <label className="block text-[9px] uppercase font-bold text-white/40">Points per Game</label>
            <div className="grid grid-cols-3 gap-2" id="points-presets">
              {[11, 15, 0].map((pts) => (
                <button
                  key={`pts-${pts}`}
                  type="button"
                  onClick={() => setPointsPerGame(pts)}
                  className={`p-2.5 rounded-sm text-xs font-bold border transition-all cursor-pointer text-center ${
                    pointsPerGame === pts
                      ? 'border-[#CCFF00] bg-[#CCFF00]/10 text-[#CCFF00]'
                      : 'border-white/10 bg-[#0A0A0A] text-white/40 hover:border-white/20'
                  }`}
                >
                  {pts === 0 ? 'Custom' : `${pts} pts`}
                </button>
              ))}
            </div>
            {pointsPerGame === 0 && (
              <input
                id="custom-points-input"
                type="number"
                min="5"
                max="99"
                required
                value={customPoints}
                onChange={(e) => setCustomPoints(e.target.value)}
                placeholder="Enter points"
                className="w-full mt-2 bg-black border border-white/10 rounded-sm p-2 text-white text-sm focus:outline-none focus:border-[#CCFF00]"
              />
            )}
          </div>

          {/* Game format */}
          <div className="space-y-1.5">
            <label className="block text-[9px] uppercase font-bold text-white/40">Match Format (Games)</label>
            <div className="grid grid-cols-3 gap-2" id="games-format-presets">
              {[1, 3, 5].map((g) => (
                <button
                  key={`bestof-${g}`}
                  type="button"
                  onClick={() => setBestOfGames(g)}
                  className={`p-2.5 rounded-sm text-xs font-bold border transition-all cursor-pointer text-center ${
                    bestOfGames === g
                      ? 'border-[#CCFF00] bg-[#CCFF00]/10 text-[#CCFF00]'
                      : 'border-white/10 bg-[#0A0A0A] text-white/40 hover:border-white/20'
                  }`}
                >
                  {g === 1 ? 'Single' : `Best of ${g}`}
                </button>
              ))}
            </div>
          </div>

          {/* Timer Format */}
          <div className="space-y-1.5" id="game-timer-container">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[9px] uppercase font-bold text-white/40">Game Timer</label>
              <button
                id="enable-timer-toggle"
                type="button"
                onClick={() => setEnableGameClock(!enableGameClock)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  enableGameClock ? 'bg-[#CCFF00]' : 'bg-white/10'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${
                    enableGameClock ? 'translate-x-[20px]' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            {enableGameClock && (
              <>
                <div className="grid grid-cols-3 gap-2" id="timer-presets">
                  {[11, 15, 0].map((mins) => (
                    <button
                      key={`mins-${mins}`}
                      type="button"
                      onClick={() => setGameTimerFormat(mins)}
                      className={`p-2.5 rounded-sm text-xs font-bold border transition-all cursor-pointer text-center ${
                        gameTimerFormat === mins
                          ? 'border-[#CCFF00] bg-[#CCFF00]/10 text-[#CCFF00]'
                          : 'border-white/10 bg-[#0A0A0A] text-white/40 hover:border-white/20'
                      }`}
                    >
                      {mins === 0 ? 'Custom' : `${mins} mins`}
                    </button>
                  ))}
                </div>
                {gameTimerFormat === 0 && (
                  <input
                    id="custom-timer-input"
                    type="number"
                    min="1"
                    max="180"
                    required
                    value={customTimer}
                    onChange={(e) => setCustomTimer(e.target.value)}
                    placeholder="Enter minutes"
                    className="w-full mt-2 bg-black border border-white/10 rounded-sm p-2 text-white text-sm focus:outline-none focus:border-[#CCFF00]"
                  />
                )}
              </>
            )}
          </div>

          {/* Scoring Format */}
          <div className="space-y-1.5">
            <label className="block text-[9px] uppercase font-bold text-white/40">Scoring Format</label>
            <div className="grid grid-cols-2 gap-2" id="scoring-format-presets">
              <button
                type="button"
                onClick={() => setScoringFormat('side-out')}
                className={`p-2.5 rounded-sm text-xs font-bold border transition-all cursor-pointer text-center ${
                  scoringFormat === 'side-out'
                    ? 'border-[#CCFF00] bg-[#CCFF00]/10 text-[#CCFF00]'
                    : 'border-white/10 bg-[#0A0A0A] text-white/40 hover:border-white/20'
                }`}
              >
                Side-Out Scoring
              </button>
              <button
                type="button"
                onClick={() => setScoringFormat('rally')}
                className={`p-2.5 rounded-sm text-xs font-bold border transition-all cursor-pointer text-center ${
                  scoringFormat === 'rally'
                    ? 'border-[#CCFF00] bg-[#CCFF00]/10 text-[#CCFF00]'
                    : 'border-white/10 bg-[#0A0A0A] text-white/40 hover:border-white/20'
                }`}
              >
                Rally Scoring
              </button>
            </div>
            <p className="text-[9px] text-white/30 lowercase tracking-tight leading-snug">
              {scoringFormat === 'side-out' 
                ? 'traditional rules: score points only when your team serves.' 
                : 'modern mlp format: points scored on every rally. service switches dynamically. partners stay fixed.'
              }
            </p>
          </div>

          {/* Service Side & Tie-break options */}
          <div className="space-y-1.5">
            <label className="block text-[9px] uppercase font-bold text-white/40">Initial Service</label>
            <div className="grid grid-cols-2 gap-2" id="starter-service-presets">
              <button
                type="button"
                onClick={() => setInitialService('A')}
                className={`p-2.5 rounded-sm text-xs font-bold border transition-all cursor-pointer text-center ${
                  initialService === 'A'
                    ? 'border-[#CCFF00] bg-[#CCFF00]/10 text-[#CCFF00]'
                    : 'border-white/10 bg-[#0A0A0A] text-white/40 hover:border-white/20'
                }`}
              >
                Team A Starts
              </button>
              <button
                type="button"
                onClick={() => setInitialService('B')}
                className={`p-2.5 rounded-sm text-xs font-bold border transition-all cursor-pointer text-center ${
                  initialService === 'B'
                    ? 'border-[#CCFF00] bg-[#CCFF00]/10 text-[#CCFF00]'
                    : 'border-white/10 bg-[#0A0A0A] text-white/40 hover:border-white/20'
                }`}
              >
                Team B Starts
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between p-3 rounded-sm bg-[#0A0A0A] border border-white/10 gap-4">
            <div className="flex flex-col flex-1">
              <span className="text-xs font-black uppercase tracking-wider text-white">Win by 2 points</span>
              <span className="text-[10px] text-white/30 leading-snug">Games must be won by a margin of 2 score points.</span>
            </div>
            <button
              id="winbytwo-toggle"
              type="button"
              onClick={() => setWinByTwo(!winByTwo)}
              className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                winByTwo ? 'bg-[#CCFF00]' : 'bg-white/10'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${
                  winByTwo ? 'translate-x-[20px]' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {bestOfGames > 1 && (
            <div className="flex items-center justify-between p-3 rounded-sm bg-[#0A0A0A] border border-white/10 gap-4">
              <div className="flex flex-col flex-1">
                <span className="text-xs font-black uppercase tracking-wider text-white">Tie-breaker Target</span>
                <span className="text-[10px] text-white/30 leading-snug">Points needed to win final deciding game.</span>
              </div>
              <div className="flex gap-1.5 shrink-0" id="tiebreak-pts-picker">
                {[11, 15].map((tbPts) => (
                  <button
                    key={`tb-${tbPts}`}
                    type="button"
                    onClick={() => setTiebreakPoints(tbPts)}
                    className={`px-3 py-1.5 rounded-sm text-xs font-black border transition-all cursor-pointer ${
                      tiebreakPoints === tbPts
                        ? 'border-[#CCFF00] bg-[#CCFF00]/10 text-[#CCFF00]'
                        : 'border-white/10 bg-[#0A0A0A] text-white/40 hover:border-[#CCFF00]'
                    }`}
                  >
                    {tbPts}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        id="launch-match-btn"
        type="submit"
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-sm bg-[#CCFF00] text-black font-black uppercase text-xs tracking-wider hover:bg-white hover:text-black transition-all cursor-pointer shadow-lg disabled:opacity-50"
      >
        <Trophy className="w-4 h-4 text-current" />
        {isLoading ? 'Creating scoring arena...' : 'Launch Scoring Console'}
      </button>
    </form>
  );
}

function teamColorCheck(teamColor: string, presetColor: string) {
  if (teamColor !== presetColor) return null;
  return <div className="w-1.5 h-1.5 bg-white rounded-full" />;
}
