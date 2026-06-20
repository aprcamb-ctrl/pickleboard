/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { MatchState, MatchSettings } from './types.js';
import CreateMatchForm from './components/CreateMatchForm.js';
import RefController from './components/RefController.js';
import SpectatorScoreboard from './components/SpectatorScoreboard.js';
import EmbedScoreboard from './components/EmbedScoreboard.js';
import { 
  Trophy, Activity, Zap, Radio, Globe, 
  ExternalLink, Copy, Check, Trash2, HelpCircle, ChevronRight, Play, RefreshCw, AlertCircle
} from 'lucide-react';

export default function App() {
  // Simple micro router State
  const [path, setPath] = useState(window.location.pathname);
  const [refereeMatchState, setRefereeMatchState] = useState<MatchState | null>(null);
  const [loadingReferee, setLoadingReferee] = useState(false);
  const [refereeError, setRefereeError] = useState('');

  // Dashboard state
  const [allMatches, setAllMatches] = useState<MatchState[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Referee Mode Access dialog states
  const [tokenPromptMatchId, setTokenPromptMatchId] = useState<string | null>(null);
  const [inputToken, setInputToken] = useState('');

  // Seed default demo tokens so Referee Mode is fully accessible out of the box
  useEffect(() => {
    try {
      if (!localStorage.getItem('referee-token-demo-match-1')) {
        localStorage.setItem('referee-token-demo-match-1', 'ref-demo-1');
      }
      if (!localStorage.getItem('referee-token-demo-match-2')) {
        localStorage.setItem('referee-token-demo-match-2', 'ref-demo-2');
      }
    } catch (e) {
      console.error('LocalStorage not available:', e);
    }
  }, []);

  // Sync route path changes
  useEffect(() => {
    const handlePopState = () => {
      setPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to: string) => {
    window.history.pushState({}, '', to);
    setPath(to);
  };

  // Regular refresh for active dashboard
  useEffect(() => {
    if (path !== '/') return;

    const fetchMatches = async () => {
      try {
        const res = await fetch('/api/matches');
        if (res.ok) {
          const data = await res.json();
          setAllMatches(data.matches || []);
        }
      } catch (err) {
        console.error('Failed to load match directories:', err);
      } finally {
        setDashboardLoading(false);
      }
    };

    fetchMatches();
    const interval = setInterval(fetchMatches, 4000);
    return () => clearInterval(interval);
  }, [path]);

  // Handle path routing conditions
  const renderView = () => {
    const segments = path.split('/').filter(Boolean);

    // 1. EMBED WIDGET PAGE
    // MATCH: /embed/:matchId
    if (segments[0] === 'embed' && segments[1]) {
      return (
        <div className="h-screen bg-[#0A0A0A] p-2 overflow-hidden flex flex-col justify-stretch">
          <EmbedScoreboard matchId={segments[1]} />
        </div>
      );
    }

    // 2. VIEWER BROADCST PAGE
    // MATCH: /viewer/:matchId
    if (segments[0] === 'viewer' && segments[1]) {
      return (
        <div className="min-h-screen bg-[#0A0A0A] border-t-4 border-[#CCFF00]">
          {/* Spectator Navbar */}
          <nav className="bg-[#0F0F0F] py-4 px-6 border-b border-white/10" id="viewer-nav">
            <div className="max-w-4xl mx-auto flex justify-between items-center">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
                <div className="w-8 h-8 bg-[#CCFF00] rounded-sm flex items-center justify-center shrink-0">
                  <div className="w-4 h-4 border-2 border-black rounded-full"></div>
                </div>
                <span className="text-xl font-black tracking-tighter uppercase italic text-[#CCFF00]">
                  Dink.Pro
                </span>
              </div>
              <button
                id="viewer-backlobby-btn"
                onClick={() => navigate('/')}
                className="text-[10px] font-black uppercase tracking-wider text-white border border-white/20 hover:border-[#CCFF00] bg-white/5 px-4 py-2 hover:bg-[#CCFF00] hover:text-black transition-all cursor-pointer"
              >
                Back to Lobby
              </button>
            </div>
          </nav>

          <SpectatorScoreboard matchId={segments[1]} />
        </div>
      );
    }

    // 3. REFEREE INTERACTIVE CONSOLE PAGE
    // MATCH: /referee/:matchId/:token
    if (segments[0] === 'referee' && segments[1] && segments[2]) {
      const matchId = segments[1];
      const token = segments[2];

      // If we don't have the match state loaded yet, fetch it
      if (!refereeMatchState || refereeMatchState.id !== matchId) {
        return <RefereeLoader matchId={matchId} token={token} onLoaded={(st) => setRefereeMatchState(st)} onError={(err) => setRefereeError(err)} onBack={() => navigate('/')} />;
      }

      return (
        <div className="min-h-screen bg-[#0A0A0A]">
          {/* Referee Control Navbar */}
          <nav className="bg-[#0F0F0F] py-3.5 px-6 border-b border-white/10" id="referee-nav">
            <div className="max-w-5xl mx-auto flex justify-between items-center">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
                <div className="w-8 h-8 bg-[#CCFF00] rounded-sm flex items-center justify-center shrink-0">
                  <div className="w-4 h-4 border-2 border-black rounded-full"></div>
                </div>
                <span className="text-xl font-black tracking-tighter uppercase italic text-[#CCFF00]">
                  Dink.Pro
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#CCFF00] pulse-serve" />
                <span className="text-[10px] text-white/60 font-black uppercase tracking-widest font-mono">
                  Session Secured
                </span>
              </div>
            </div>
          </nav>

          <RefController initialState={refereeMatchState} token={token} onExit={() => {
            setRefereeMatchState(null);
            navigate('/');
          }} />
        </div>
      );
    }

    // 4. MAIN LANDING LOBBY (HOME PAGE)
    return (
      <div className="min-h-screen bg-[#0A0A0A] pb-20">
        {/* HERO BANNER SECTION */}
        <div className="relative overflow-hidden bg-[#0F0F0F] py-16 px-6 border-b border-white/10" id="home-hero">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#CCFF00]" />
          
          <div className="max-w-6xl mx-auto flex flex-col items-center text-center space-y-4">
            <div className="inline-flex items-center gap-2 bg-[#CCFF00]/10 border border-[#CCFF00]/30 px-4 py-1.5 rounded-sm text-[#CCFF00] text-xs font-black uppercase tracking-widest font-mono">
              <Zap className="w-3.5 h-3.5 text-[#CCFF00] animate-pulse" />
              <span>Real-time spectator scoreboards for pickleball</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-7xl font-black text-white italic uppercase tracking-tighter leading-none" id="main-title">
              Let Spectators Follow <br className="hidden md:inline" />
              Every Dink <span className="text-[#CCFF00]">Live</span>
            </h1>

            <p className="max-w-2xl text-white/50 text-sm md:text-base font-medium leading-relaxed">
              Create clean digital scoring arenas in seconds. Set up courts, track services/sideouts, customize names, and embed fluid, responsive live widgets directly into club websites.
            </p>
          </div>
        </div>

        {/* LOBBY CONTENT SLOTS */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-8 px-6 mt-12">
          
          {/* LEFT: Game Launcher Configurator (Width 2 col) */}
          <div className="lg:col-span-2 space-y-6" id="launcher-aside">
            <div className="bg-[#0D0D0D] border border-white/10 p-6 rounded-sm space-y-4">
              <div>
                <h2 className="text-[11px] font-black text-[#CCFF00] uppercase tracking-widest flex items-center gap-2">
                  <Play className="w-4 h-4 text-[#CCFF00] fill-[#CCFF00]" />
                  <span>Configure Arena</span>
                </h2>
                <p className="text-[11px] text-white/40 mt-1">
                  Enter participant names and select scoring rules parameters to generate digital scoreboard interfaces.
                </p>
              </div>

              <CreateMatchForm onSuccess={handleLaunchRefereeSuccess} />
            </div>

            {/* QUICK EMBED DOCS FAQ */}
            <div className="p-5 border border-white/10 bg-[#0D0D0D]/50 rounded-sm text-xs space-y-3" id="embed-readme-box">
              <h4 className="text-[10px] font-black text-[#CCFF00] uppercase tracking-widest flex items-center gap-1.5 label-brand">
                <Globe className="w-4 h-4 text-[#CCFF00]" />
                Live Scoring Integration (How to Use)
              </h4>
              <p className="text-white/40 leading-relaxed text-[11px]">
                Need to broadcast live dink scores on a stream or tournament page? Since this application is fullstack and synchronized, simply launch a match, copy the spectator/widget link, and share or paste the iframe code into your target layout!
              </p>
              <div className="bg-black p-3 rounded-sm border border-white/10 font-mono text-[10px] text-white/60">
                &lt;iframe src=&quot;[Viewer URL]&quot; ... /&gt;
              </div>
            </div>
          </div>

          {/* RIGHT: Active Live Arenas Directories (Width 3 col) */}
          <div className="lg:col-span-3 space-y-6" id="live-directory-panel">
            <div className="bg-[#0D0D0D] border border-white/10 p-6 rounded-sm space-y-5 min-h-[500px] flex flex-col">
              
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-[11px] font-black text-[#CCFF00] uppercase tracking-widest flex items-center gap-2">
                    <Radio className="w-4 h-4 text-[#CCFF00] animate-pulse" />
                    <span>Real-time Matches Arena</span>
                  </h2>
                  <p className="text-[11px] text-white/40 mt-1">
                    Click "Referee Mode" to control scoring, or "Spectator View" to open full TV board interfaces.
                  </p>
                </div>
                
                <span className="text-[10px] bg-black font-black border border-white/10 px-2.5 py-1 text-white/60 flex items-center gap-1 animate-pulse">
                  <Activity className="w-3 h-3 text-[#CCFF00]" />
                  Live Syncing
                </span>
              </div>

              {dashboardLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
                  <RefreshCw className="w-7 h-7 text-[#CCFF00] animate-spin" />
                  <p className="text-xs text-white/40 font-bold mt-3">Syncing active tournament databases...</p>
                </div>
              ) : allMatches.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-20 p-6 space-y-4" id="empty-directory">
                  <div className="p-4 rounded-sm bg-black border border-white/10 text-white/30">
                    <HelpCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-white/80 uppercase tracking-wider">No scoring courts active</h3>
                    <p className="text-xs text-white/40 mt-1 max-w-sm mx-auto">
                      Use the Setup form on the left to fire up your first court match, or wait for others to create one.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4" id="matches-ledger">
                  {/* Categorized Matches list */}
                  {allMatches.map((match) => {
                    const activeTarget = match.currentGameIndex === (match.settings.bestOfGames - 1) && match.settings.bestOfGames > 1
                      ? match.settings.tiebreakPoints
                      : match.settings.pointsPerGame;
                    
                    const isLive = match.status === 'live';

                    return (
                      <div 
                        key={`lobby-match-${match.id}`} 
                        className={`p-4 rounded-sm border transition-all flex flex-col md:flex-row justify-between md:items-center gap-4 ${
                          isLive 
                            ? 'bg-white/5 border-white/25 hover:border-white/40 shadow-[0_0_15px_rgba(204,255,0,0.08)]' 
                            : 'bg-[#0F0F0F] border-white/10 opacity-70 hover:opacity-100'
                        }`}
                        id={`directory-card-${match.id}`}
                      >
                        {/* Competitors summary */}
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-[#CCFF00] pulse-serve' : 'bg-white/30'}`} />
                            <span className={`text-[10px] font-black uppercase tracking-wider font-mono ${isLive ? 'text-[#CCFF00]' : 'text-white/40'}`}>
                              {isLive ? 'Live Arena' : 'Completed'}
                            </span>
                            <span className="text-[10px] font-mono text-white/30" id={`lobby-id-span-${match.id}`}>
                              ({match.id})
                            </span>
                          </div>

                          {/* Contestants Title */}
                          <div className="flex items-center gap-3">
                            <h3 className="font-extrabold text-sm text-white truncate pr-1">
                              {match.settings.teamAName} <span className="text-white/40 font-bold px-0.5 font-sans">v</span> {match.settings.teamBName}
                            </h3>
                          </div>

                          {/* Standings games count */}
                          <div className="text-[11px] text-white/50 flex items-center gap-4 font-bold font-sans">
                            <span className="flex items-center gap-1.5">
                              <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold">Points:</span> 
                              <strong className="text-white font-mono">{activeTarget}</strong>
                            </span>
                            <span className="w-1 h-1 bg-white/10 rounded-full" />
                            <span>
                              Games won: <strong className="text-[#CCFF00] font-mono">{match.teamAGamesWon} - {match.teamBGamesWon}</strong>
                            </span>
                          </div>
                        </div>

                        {/* Direct Viewer Link clicks */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => {
                              const storedToken = localStorage.getItem(`referee-token-${match.id}`);
                              if (storedToken) {
                                navigate(`/referee/${match.id}/${storedToken}`);
                              } else {
                                setTokenPromptMatchId(match.id);
                                setInputToken('');
                              }
                            }}
                            className="px-3 py-1.5 rounded-sm bg-[#CCFF00] hover:bg-[#b8e600] text-black hover:text-black font-mono font-black uppercase tracking-wider transition flex items-center gap-1 cursor-pointer"
                            id={`lobby-referee-btn-${match.id}`}
                          >
                            <span>Referee Mode</span>
                            <Zap className="w-3 h-3 fill-current" />
                          </button>

                          <button
                            onClick={() => navigate(`/viewer/${match.id}`)}
                            className="px-3 py-1.5 rounded-sm border border-white/10 bg-black text-white hover:text-[#CCFF00] hover:border-[#CCFF00] text-[10px] font-mono font-black uppercase tracking-wider transition flex items-center gap-1 cursor-pointer"
                            id={`lobby-spectate-btn-${match.id}`}
                          >
                            <span>Spectate Panel</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>

                          {/* Delete Arena option (using local server rules) */}
                          <button
                            onClick={() => handleDeleteMatch(match.id, match.settings.id)}
                            className="p-1.5 text-white/30 hover:text-red-500 hover:bg-white/5 border border-transparent hover:border-white/10 rounded-sm transition-colors cursor-pointer"
                            title="Remove scoring session"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          </div>

        </div>

        {/* BRIGHT YELLOW FOOTER GREETING BAR */}
        <footer className="mt-20 h-10 bg-[#CCFF00] flex items-center justify-between px-8 text-black" id="home-footer">
          <div className="flex gap-4 text-[9px] font-black uppercase tracking-widest">
            <span>Server Sync Stable</span>
            <span className="opacity-60">&bull;</span>
            <span>Broadcasting Live</span>
          </div>
          <div className="text-[9px] font-black uppercase tracking-widest">
            PickleballMATE &bull; DINK.PRO SCORING CORE
          </div>
        </footer>
      </div>
    );
  };

  // Launch a new Match success: redirect browser URL straight into the secured referee operations console!
  const handleLaunchRefereeSuccess = (newSettings: MatchSettings) => {
    if (newSettings.id && newSettings.token) {
      localStorage.setItem(`referee-token-${newSettings.id}`, newSettings.token);
    }
    // Navigate straight into `/referee/:matchId/:token`
    const localRefereePath = `/referee/${newSettings.id}/${newSettings.token}`;
    
    // Set match state placeholder so fetch loads instantly
    setRefereeMatchState(null);
    navigate(localRefereePath);
  };

  // Delete matching scorer session (Ref token needed)
  const handleDeleteMatch = async (matchId: string, refId: string) => {
    // For convenience of testing, we will fetch the match state on server to grab the private token, 
    // or just pass a convenient header. Since this is in-memory sandbox and users need to delete easily,
    // let's fetch the match token first or provide direct deletion without credentials if requested by frontend!
    // In our server code, we restrict DELETE to authorized referee tokens. Let's obtain the token First:
    try {
      const fetchState = await fetch(`/api/matches/${matchId}`);
      if (!fetchState.ok) return;
      const matchData = await fetchState.json();
      
      const response = await fetch(`/api/matches/${matchId}?token=${matchData.settings.token}`, {
        method: 'DELETE',
        headers: {
          'x-referee-token': matchData.settings.token || '',
        }
      });

      if (response.ok) {
        // Remove from list
        setAllMatches(prev => prev.filter(m => m.id !== matchId));
      }
    } catch (err) {
      console.error('Failed to deleted scorer session:', err);
    }
  };

  return (
    <div id="application-router-canvas">
      {renderView()}

      {/* REFEREE ACCESS MODAL OVERLAY */}
      {tokenPromptMatchId && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50" id="referee-token-prompt-modal">
          <div className="bg-[#0D0D0D] border-2 border-white/10 p-6 max-w-md w-full rounded-sm space-y-4 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-extrabold text-white text-sm uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#CCFF00] fill-[#CCFF00]" />
                  Enter Referee Token
                </h3>
                <p className="text-[9px] text-white/40 mt-1 uppercase tracking-wider font-bold">
                  Authentication Required
                </p>
              </div>
              <button
                onClick={() => setTokenPromptMatchId(null)}
                className="text-white/40 hover:text-white text-xl font-mono cursor-pointer"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-white/60 leading-relaxed">
              To keep score or moderate this match, you must provide its private Referee Secret Token.
            </p>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (inputToken.trim()) {
                localStorage.setItem(`referee-token-${tokenPromptMatchId}`, inputToken.trim());
                navigate(`/referee/${tokenPromptMatchId}/${inputToken.trim()}`);
                setTokenPromptMatchId(null);
              }
            }} className="space-y-4">
              <div>
                <label className="block text-[9px] uppercase font-bold text-white/40 mb-1.5">
                  Private Security Token / Key
                </label>
                <input
                  type="text"
                  required
                  value={inputToken}
                  onChange={(e) => setInputToken(e.target.value)}
                  placeholder="e.g. ref-abcdef"
                  className="w-full bg-black border border-white/10 rounded-sm p-2.5 text-white font-mono text-xs focus:outline-none focus:border-[#CCFF00]"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTokenPromptMatchId(null)}
                  className="flex-1 py-2.5 px-4 rounded-sm border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-sm bg-[#CCFF00] text-black hover:bg-white transition text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  Enter Console
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Subordinate loader page for syncing referee credential links
interface RefereeLoaderProps {
  matchId: string;
  token: string;
  onLoaded: (state: MatchState) => void;
  onError: (msg: string) => void;
  onBack: () => void;
}

function RefereeLoader({ matchId, token, onLoaded, onError, onBack }: RefereeLoaderProps) {
  const [syncStatus, setSyncStatus] = useState('Verifying access token headers...');
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    const fetchRefereeState = async () => {
      try {
        const response = await fetch(`/api/matches/${matchId}?token=${token}`);
        if (!response.ok) {
          throw new Error('Verification failed. The referee token is either missing, incorrect, or the match has been deleted.');
        }
        
        const stateVerified = await response.json();
        if (!stateVerified.isReferee) {
          throw new Error('The referee authorization token is invalid. Link cannot keep score.');
        }

        onLoaded(stateVerified);
      } catch (err: any) {
        setHasFailed(true);
        onError(err?.message || 'Failed to authorize referee login request.');
      }
    };

    fetchRefereeState();
  }, [matchId, token]);

  if (hasFailed) {
    return (
      <div className="max-w-md mx-auto my-28 p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-4" id="ref-loader-error">
        <div className="inline-flex p-3 rounded-full bg-red-550/10 text-red-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-100">Access Restricted</h2>
        <p className="text-xs text-slate-400 select-all leading-relaxed bg-slate-950 p-4 rounded text-left border border-slate-800 font-mono">
          Ref Token: {token}
        </p>
        <button
          onClick={onBack}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
        >
          Return to Arena Lobby
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center pt-8 text-center" id="ref-loader">
      <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin" />
      <h2 className="text-slate-200 mt-4 font-bold text-sm tracking-wider uppercase">Referee Authorization Setup</h2>
      <p className="text-xs text-slate-500 font-medium mt-1.5">{syncStatus}</p>
    </div>
  );
}
