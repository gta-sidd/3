import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Tv,
  Smartphone,
  Pause,
  Play,
  RotateCcw,
  HelpCircle,
  QrCode,
  ShieldAlert,
  Zap,
  Gamepad2,
  Flame,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
  Globe,
  Settings2,
  CheckCircle2,
} from 'lucide-react';
import { RetroArcadeEngine } from '../game/retroArcadeEngine.ts';
import { RETRO_GAMES, RetroGameId } from '../game/retroGames.ts';
import type { GameInput, GameStatus } from '../game/types.ts';
import { sound } from '../game/audio.ts';

import { NetworkClient } from '../network/networkClient.ts';

interface ProjectorDisplayProps {
  roomId: string;
  activeGame?: RetroGameId;
  onGameChange?: (gameId: RetroGameId) => void;
  onOpenHelp?: () => void;
  onOpenPhoneView?: () => void;
}

export const ProjectorDisplay: React.FC<ProjectorDisplayProps> = ({
  roomId,
  activeGame: propActiveGame = 'super_plumber',
  onGameChange,
  onOpenHelp,
  onOpenPhoneView,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<RetroArcadeEngine | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const netRef = useRef<NetworkClient | null>(null);

  const [activeGame, setActiveGame] = useState<RetroGameId>(propActiveGame);
  const [gameStatus, setGameStatus] = useState<GameStatus>('title');
  const [showCartridgeMenu, setShowCartridgeMenu] = useState(false);
  const [stats, setStats] = useState({
    score: 0,
    health: 5,
    shield: 100,
    energy: 100,
    bombCharge: 100,
    wave: 1,
    combo: 1,
  });

  const [connectedControllers, setConnectedControllers] = useState<number[]>([]);
  const [highScore, setHighScore] = useState(12500);
  const [isMuted, setIsMuted] = useState(false);
  const [projectorHighContrast, setProjectorHighContrast] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [controllerUrl, setControllerUrl] = useState<string>('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showHostSettings, setShowHostSettings] = useState(false);
  const [customHost, setCustomHost] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('castpad_custom_host') || '';
    }
    return '';
  });
  const [tempHost, setTempHost] = useState('');

  // Sync prop changes
  useEffect(() => {
    if (propActiveGame && propActiveGame !== activeGame) {
      setActiveGame(propActiveGame);
      engineRef.current?.setGame(propActiveGame);
    }
  }, [propActiveGame, activeGame]);

  // Compute public/accessible controller URL
  const computeControllerUrl = useCallback((room: string, game: RetroGameId, overrideHost?: string) => {
    if (typeof window === 'undefined') return '';
    const activeCustom = (overrideHost !== undefined ? overrideHost : customHost).trim();
    if (activeCustom) {
      let host = activeCustom;
      if (!host.startsWith('http://') && !host.startsWith('https://')) {
        host = `https://${host}`;
      }
      const cleanHost = host.replace(/\/+$/, '');
      return `${cleanHost}/?mode=controller&room=${encodeURIComponent(room)}&game=${encodeURIComponent(game)}`;
    }

    let origin = window.location.origin;
    // CRITICAL: Google AI Studio developer URLs (ais-dev-*) require internal Google login session.
    // When a phone camera scans it, Cloud Run returns 403 Forbidden ("You do not have access").
    // We automatically convert 'ais-dev-' to 'ais-pre-' (the public shared preview URL)
    // so any phone camera or external player can connect immediately without login!
    if (origin.includes('ais-dev-')) {
      origin = origin.replace('ais-dev-', 'ais-pre-');
    }

    const pathname = window.location.pathname || '/';
    const cleanPath = pathname.endsWith('/') ? pathname : `${pathname}/`;
    return `${origin}${cleanPath}?mode=controller&room=${encodeURIComponent(room)}&game=${encodeURIComponent(game)}`;
  }, [customHost]);

  // Generate QR code for phone controller using the public accessible URL
  useEffect(() => {
    const fullUrl = computeControllerUrl(roomId, activeGame);
    setControllerUrl(fullUrl);
    QRCode.toDataURL(fullUrl, {
      width: 320,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#00f0ff',
      },
    })
      .then((url) => setQrCodeUrl(url))
      .catch(() => {});
  }, [roomId, activeGame, computeControllerUrl]);

  const handleCopyLink = () => {
    if (!controllerUrl) return;
    navigator.clipboard.writeText(controllerUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }).catch(() => {});
  };

  const handleSaveCustomHost = () => {
    const trimmed = tempHost.trim();
    setCustomHost(trimmed);
    if (typeof window !== 'undefined') {
      if (trimmed) {
        localStorage.setItem('castpad_custom_host', trimmed);
      } else {
        localStorage.removeItem('castpad_custom_host');
      }
    }
    setShowHostSettings(false);
  };

  // Switch game cartridge
  const selectGame = useCallback((gameId: RetroGameId) => {
    setActiveGame(gameId);
    setShowCartridgeMenu(false);
    engineRef.current?.setGame(gameId);
    sound.playClick(true);
    if (onGameChange) onGameChange(gameId);
    netRef.current?.sendGameChange(gameId);
  }, [onGameChange]);

  // Handle Multi-Transport Network Client (WebSocket + WebRTC + BroadcastChannel)
  useEffect(() => {
    const net = new NetworkClient('display', roomId, 1, {
      onConnected: () => {
        // Connected
      },
      onControllerJoined: (pid) => {
        setConnectedControllers((prev) => Array.from(new Set([...prev, pid])));
        sound.playClick(true);
      },
      onControllerLeft: (pid) => {
        setConnectedControllers((prev) => prev.filter((id) => id !== pid));
      },
      onInput: (input) => {
        engineRef.current?.setInput(input);
      },
      onGameChanged: (gameId) => {
        setActiveGame(gameId);
        engineRef.current?.setGame(gameId);
      },
    });
    netRef.current = net;

    return () => {
      net.dispose();
    };
  }, [roomId]);

  // Send haptic feedback to phone controller when taking hits or detonating bomb
  const sendHapticToController = useCallback((
    targetPlayerId: number,
    pattern: number[],
    health: number,
    shield: number,
    score: number
  ) => {
    netRef.current?.sendHapticFeedback(pattern, health, shield, score, targetPlayerId);
  }, []);

  // Initialize Retro Arcade Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = 1920;
    canvas.height = 1080;

    const engine = new RetroArcadeEngine(canvas);
    engineRef.current = engine;
    engine.setGame(activeGame);

    engine.onStatsChange = (newStats) => {
      setStats({
        score: newStats.score,
        health: newStats.health,
        shield: newStats.shield,
        energy: newStats.energy,
        bombCharge: newStats.bombCharge,
        wave: newStats.wave,
        combo: newStats.combo,
      });
      setGameStatus(newStats.status);
      setHighScore((prev) => Math.max(prev, newStats.score));
    };

    engine.onHapticTrigger = sendHapticToController;

    // Initial render
    engine.render();

    // Check query params for autostart
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      engine.startGame();
    }

    return () => {
      engine.stop();
    };
  }, [sendHapticToController, activeGame]);

  // Keyboard controls listener (fallback when playing directly)
  useEffect(() => {
    const keysDown = new Set<string>();

    const updateFromKeys = () => {
      if (!engineRef.current) return;
      let sx = 0;
      let sy = 0;
      if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) sx -= 1;
      if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) sx += 1;
      if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) sy -= 1;
      if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) sy += 1;

      const input: GameInput = {
        stickX: sx,
        stickY: sy,
        fire: keysDown.has('Space') || keysDown.has('KeyJ'),
        boost: keysDown.has('ShiftLeft') || keysDown.has('ShiftRight') || keysDown.has('KeyK'),
        shield: keysDown.has('KeyC') || keysDown.has('KeyL'),
        bomb: keysDown.has('KeyB') || keysDown.has('KeyI'),
      };
      engineRef.current.setInput(input);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      // Numeric shortcuts 1-6 for instant retro game swapping
      if (e.key >= '1' && e.key <= '6') {
        const idx = parseInt(e.key, 10) - 1;
        if (RETRO_GAMES[idx]) {
          selectGame(RETRO_GAMES[idx].id);
          return;
        }
      }

      if (e.code === 'KeyP' || e.code === 'Escape') {
        engineRef.current?.pauseGame();
        return;
      }
      if (e.code === 'KeyM') {
        setIsMuted((prev) => {
          sound.setMuted(!prev);
          return !prev;
        });
        return;
      }
      if (e.code === 'KeyF') {
        toggleFullscreen();
        return;
      }
      if (gameStatus === 'title' && (e.code === 'Space' || e.code === 'Enter')) {
        handleStartGame();
        return;
      }

      keysDown.add(e.code);
      updateFromKeys();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysDown.delete(e.code);
      updateFromKeys();
    };

    const handleBlur = () => {
      keysDown.clear();
      updateFromKeys();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [gameStatus, selectGame]);

  const handleStartGame = () => {
    engineRef.current?.startGame();
  };

  const handleRestartGame = () => {
    engineRef.current?.restartGame();
  };

  const handlePauseGame = () => {
    engineRef.current?.pauseGame();
  };

  const toggleFullscreen = () => {
    const el = containerRef.current || document.documentElement;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const currentDef = RETRO_GAMES.find((g) => g.id === activeGame) || RETRO_GAMES[0];

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full flex items-center justify-center bg-black overflow-hidden select-none font-sans ${
        projectorHighContrast ? 'contrast-[1.12] brightness-[1.05]' : ''
      }`}
    >
      {/* 16:9 Cinema Viewport Container */}
      <div className="relative w-full aspect-video max-h-screen bg-slate-950 shadow-2xl flex items-center justify-center">
        {/* Hardware Canvas */}
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain block"
          style={{ imageRendering: 'crisp-edges' }}
        />

        {/* HUD Overlay - strictly pointer-events-none except for interactive buttons */}
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 sm:p-5 md:p-6 lg:p-8">
          {/* Top Perimeter HUD */}
          <div className="flex items-start justify-between w-full">
            {/* Left Cluster: Ship Vitality & Energy Meters */}
            <div className="flex flex-col gap-1.5 bg-slate-950/75 border border-slate-800/80 p-2.5 sm:p-3 rounded-xl backdrop-blur-xs min-w-[170px] sm:min-w-[200px]">
              {/* Vitality Pips */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono tracking-wider text-slate-400 font-bold">LIVES / HP</span>
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-xs border transition-all ${
                        i < stats.health
                          ? 'bg-emerald-400 border-emerald-300 shadow-[0_0_8px_#10b981]'
                          : 'bg-slate-900 border-slate-700 opacity-40'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Game Badge Readout */}
              <div className="flex items-center justify-between text-[10px] font-mono border-t border-slate-800/80 pt-1 text-cyan-300">
                <span className="font-bold">{currentDef.badge}</span>
                <span className="text-slate-400">{currentDef.year}</span>
              </div>
            </div>

            {/* Center: Active Game Cartridge Title Badge */}
            <div className="flex flex-col items-center">
              <button
                onClick={() => setShowCartridgeMenu(!showCartridgeMenu)}
                className="pointer-events-auto px-4 py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/50 backdrop-blur-xs flex items-center gap-2 hover:bg-cyan-950 transition-colors shadow-lg"
              >
                <Gamepad2 className="w-4 h-4 text-cyan-400" />
                <span className="text-xs sm:text-sm font-mono tracking-widest text-cyan-300 font-bold uppercase">
                  {currentDef.title}
                </span>
                <span className="text-[10px] text-cyan-400/80 font-mono">▼ CHANGE (1-6)</span>
              </button>

              {stats.combo > 1 && (
                <div className="mt-1 text-xs sm:text-sm font-black font-mono tracking-wider text-yellow-400 animate-bounce">
                  {stats.combo}X COMBO MULTIPLIER!
                </div>
              )}
            </div>

            {/* Right Cluster: Score & Utilities */}
            <div className="flex flex-col items-end gap-1.5">
              <div className="bg-slate-950/75 border border-slate-800/80 px-3 sm:px-4 py-2 rounded-xl backdrop-blur-xs text-right">
                <div className="text-[10px] font-mono tracking-wider text-slate-400">SCORE</div>
                <div className="text-xl sm:text-2xl lg:text-3xl font-black font-mono text-cyan-400 tabular-nums">
                  {stats.score.toLocaleString()}
                </div>
              </div>

              {/* Utility Buttons Cluster */}
              <div className="flex items-center gap-1 pointer-events-auto">
                <button
                  onClick={() => setShowCartridgeMenu(true)}
                  title="Switch Retro Game"
                  className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-mono font-bold flex items-center gap-1"
                >
                  <Gamepad2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">GAMES</span>
                </button>

                <button
                  onClick={() => setShowQrModal(true)}
                  title="Phone Controller QR Code"
                  className="px-2 py-1.5 rounded-lg bg-cyan-950/80 border border-cyan-700 text-cyan-300 hover:bg-cyan-900 text-xs font-mono font-bold flex items-center gap-1 transition-colors"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">PAIR</span>
                </button>

                <button
                  onClick={() => setProjectorHighContrast(!projectorHighContrast)}
                  title="Projector High-Contrast Boost"
                  className={`p-1.5 rounded-lg border transition-colors ${
                    projectorHighContrast
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Tv className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => {
                    setIsMuted(!isMuted);
                    sound.setMuted(!isMuted);
                  }}
                  title="Audio Mute [M]"
                  className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-slate-200"
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>

                {gameStatus === 'playing' && (
                  <button
                    onClick={handlePauseGame}
                    title="Pause [P]"
                    className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-slate-200"
                  >
                    <Pause className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={toggleFullscreen}
                  title="Projector Fullscreen [F]"
                  className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-slate-200"
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Perimeter HUD: Connection Badge & Control Hint */}
          <div className="flex items-end justify-between w-full">
            {/* Projector Connection Badge */}
            <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-xl backdrop-blur-xs">
              <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-mono text-slate-300">
                PHONE CONTROLLER:
              </span>
              {connectedControllers.length > 0 ? (
                <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  ONLINE ({connectedControllers.length} CONNECTED)
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-mono text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  SCAN QR (ROOM: {roomId})
                </span>
              )}
            </div>

            {/* Bottom Non-Interactive Control Hint */}
            <div className="text-[10px] sm:text-[11px] font-mono text-slate-500 tracking-wider">
              {currentDef.controlsSummary}
            </div>
          </div>
        </div>

        {/* MODAL: Retro Game Cartridge Carousel Selector */}
        {showCartridgeMenu && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 z-30 pointer-events-auto">
            <div className="max-w-3xl w-full bg-slate-900 border-2 border-cyan-500/50 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-cyan-400 font-mono font-bold text-base">
                  <Gamepad2 className="w-5 h-5" />
                  SELECT RETRO ARCADE CARTRIDGE (KEYS 1-6)
                </div>
                <button
                  onClick={() => setShowCartridgeMenu(false)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-300"
                >
                  CLOSE [ESC]
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {RETRO_GAMES.map((game, i) => (
                  <button
                    key={game.id}
                    onClick={() => selectGame(game.id)}
                    className={`flex flex-col text-left p-3.5 rounded-xl border-2 transition-all ${
                      activeGame === game.id
                        ? 'bg-cyan-950/80 border-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.3)]'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px] text-slate-400 font-bold">[{i + 1}] {game.year}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] font-mono text-cyan-300 font-bold">
                        {game.badge}
                      </span>
                    </div>
                    <div className="font-mono font-bold text-white text-sm mb-1">{game.title}</div>
                    <div className="text-[11px] font-mono text-slate-400 mb-2 leading-relaxed">{game.description}</div>
                    <div className="mt-auto pt-2 border-t border-slate-800 text-[10px] font-mono text-cyan-400 flex items-center justify-between">
                      <span>CONTROLLER: {game.controllerType.replace('_', ' ').toUpperCase()}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Title Screen */}
        {gameStatus === 'title' && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 z-20">
            <div className="max-w-xl w-full bg-slate-900 border-2 border-cyan-500/40 rounded-2xl p-6 sm:p-8 shadow-[0_0_50px_rgba(0,240,255,0.2)] text-center flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-cyan-950 border border-cyan-500 flex items-center justify-center mb-3 shadow-[0_0_20px_#00f0ff]">
                <Zap className="w-7 h-7 text-cyan-400" />
              </div>

              <h1 className="text-2xl sm:text-4xl font-black font-mono tracking-tight text-white mb-0.5">
                {currentDef.title.toUpperCase()}
              </h1>
              <p className="text-cyan-400 text-xs sm:text-sm font-mono tracking-wider mb-5">
                {currentDef.subtitle.toUpperCase()} ({currentDef.year})
              </p>

              {/* QR Code and Quick Pairing Box */}
              <div className="w-full bg-slate-950/90 border border-cyan-500/30 rounded-xl p-4 mb-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
                <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0">
                  {qrCodeUrl && (
                    <div className="relative group">
                      <img
                        src={qrCodeUrl}
                        alt="Pair phone controller QR code"
                        className="w-28 h-28 sm:w-32 sm:h-32 rounded-lg border-2 border-cyan-400 p-1.5 bg-slate-950 shadow-[0_0_15px_rgba(0,240,255,0.25)]"
                      />
                      <div className="absolute -bottom-2 -right-2 px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold text-[9px] font-mono tracking-wider uppercase shadow">
                        PUBLIC
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5 max-w-xs">
                    <div className="text-cyan-300 font-bold uppercase text-xs flex items-center gap-1.5 font-mono">
                      <Smartphone className="w-4 h-4 text-cyan-400" /> SCAN WITH PHONE CAMERA
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Public Link (No Google Login Required)</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Turns your phone into an authentic retro controller for <strong>{currentDef.title}</strong> with zero lag.
                    </p>
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="text-[11px] font-mono text-slate-400">ROOM:</span>
                      <span className="text-xs font-mono font-bold text-cyan-300 px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
                        {roomId}
                      </span>
                      {connectedControllers.length > 0 && (
                        <span className="text-emerald-400 font-bold text-[11px] font-mono flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          {connectedControllers.length} CONNECTED
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Direct Link Action Box */}
                <div className="flex flex-col gap-2 w-full sm:w-auto shrink-0 border-t sm:border-t-0 sm:border-l border-slate-800 pt-2 sm:pt-0 sm:pl-3">
                  <button
                    onClick={handleCopyLink}
                    className={`py-2 px-3 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all ${
                      copiedLink
                        ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                        : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700'
                    }`}
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'LINK COPIED!' : 'COPY PHONE LINK'}</span>
                  </button>

                  <button
                    onClick={() => {
                      if (onOpenPhoneView) {
                        onOpenPhoneView();
                      } else if (controllerUrl) {
                        window.open(controllerUrl, '_blank');
                      }
                    }}
                    className="py-1.5 px-3 rounded-lg text-[11px] font-mono text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3 text-cyan-400" />
                    <span>OPEN ON THIS DEVICE</span>
                  </button>

                  <button
                    onClick={() => {
                      setTempHost(customHost);
                      setShowHostSettings(!showHostSettings);
                    }}
                    className="text-[10px] font-mono text-slate-500 hover:text-slate-300 flex items-center justify-center gap-1 transition-colors"
                  >
                    <Settings2 className="w-3 h-3" />
                    <span>{customHost ? 'CUSTOM HOST ACTIVE' : 'HOST / LAN SETTINGS'}</span>
                  </button>
                </div>
              </div>

              {/* Host / LAN IP Configuration Drawer */}
              {showHostSettings && (
                <div className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl mb-4 text-left font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-300 font-bold">
                    <span className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-cyan-400" />
                      CONTROLLER HOST SETTINGS
                    </span>
                    <button
                      onClick={() => setShowHostSettings(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      [X]
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    By default, the QR code uses the public shared link (<code>ais-pre-*</code>) so phone cameras scan without needing Google login. If playing on your local Wi-Fi outside the cloud, enter your computer&apos;s LAN IP (e.g., <code>http://192.168.1.50:3000</code>).
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tempHost}
                      onChange={(e) => setTempHost(e.target.value)}
                      placeholder="e.g. https://ais-pre-... or 192.168.1.15:3000"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      onClick={handleSaveCustomHost}
                      className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs"
                    >
                      APPLY
                    </button>
                    {customHost && (
                      <button
                        onClick={() => {
                          setTempHost('');
                          setCustomHost('');
                          if (typeof window !== 'undefined') localStorage.removeItem('castpad_custom_host');
                          setShowHostSettings(false);
                        }}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                      >
                        RESET
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Start Actions */}
              <div className="flex flex-col sm:flex-row gap-2.5 w-full">
                <button
                  data-start="true"
                  onClick={handleStartGame}
                  className="flex-1 py-3 px-6 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono tracking-wider shadow-[0_0_25px_rgba(0,240,255,0.6)] active:scale-95 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <Play className="w-4 h-4 fill-current" />
                  START GAME (ENTER / SPACE)
                </button>

                <button
                  onClick={() => setShowCartridgeMenu(true)}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Gamepad2 className="w-4 h-4 text-cyan-400" />
                  SELECT OTHER GAME
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Paused */}
        {gameStatus === 'paused' && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-6 z-20">
            <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center">
              <h2 className="text-2xl font-black font-mono text-white mb-2">GAME PAUSED</h2>
              <p className="text-slate-400 text-xs font-mono mb-6">Press [P] or [Escape] to resume</p>
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={handlePauseGame}
                  className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold"
                >
                  RESUME
                </button>
                <button
                  onClick={handleRestartGame}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs border border-slate-700"
                >
                  RESTART
                </button>
                <button
                  onClick={() => {
                    handlePauseGame();
                    setShowCartridgeMenu(true);
                  }}
                  className="w-full py-2 rounded-xl bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-xs"
                >
                  SWITCH RETRO GAME
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Game Over */}
        {gameStatus === 'gameover' && (
          <div className="absolute inset-0 bg-rose-950/70 backdrop-blur-xs flex items-center justify-center p-6 z-20">
            <div className="max-w-md w-full bg-slate-900 border-2 border-rose-500 rounded-2xl p-6 sm:p-8 text-center shadow-[0_0_50px_rgba(244,63,94,0.3)]">
              <div className="text-rose-500 text-xs font-mono font-bold tracking-widest uppercase mb-1">
                ROUND COMPLETE
              </div>
              <h2 className="text-3xl font-black font-mono text-white mb-4">GAME OVER</h2>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400">FINAL SCORE</div>
                  <div className="text-xl font-bold font-mono text-cyan-400 tabular-nums">
                    {stats.score.toLocaleString()}
                  </div>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400">CARTRIDGE</div>
                  <div className="text-sm font-bold font-mono text-amber-400 truncate">
                    {currentDef.title}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  data-start="true"
                  onClick={handleRestartGame}
                  className="w-full py-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-mono font-bold tracking-wider shadow-[0_0_20px_rgba(244,63,94,0.5)] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  PLAY AGAIN (ENTER)
                </button>
                <button
                  onClick={() => setShowCartridgeMenu(true)}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs border border-slate-700"
                >
                  CHOOSE ANOTHER RETRO GAME
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: QR Code popup */}
        {showQrModal && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 z-30 pointer-events-auto">
            <div className="max-w-lg w-full bg-slate-900 border-2 border-cyan-500/60 rounded-2xl p-6 text-center shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-cyan-400 font-mono font-bold text-sm">
                  <Smartphone className="w-5 h-5 text-cyan-400" />
                  CONNECT PHONE CONTROLLER
                </div>
                <button
                  onClick={() => setShowQrModal(false)}
                  className="text-slate-400 hover:text-white font-mono text-xs px-2.5 py-1 bg-slate-800 rounded-lg hover:bg-slate-700"
                >
                  [CLOSE]
                </button>
              </div>

              {/* Public Access Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 font-mono text-xs font-semibold mb-3">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Public Link: Anyone can scan without Google Login</span>
              </div>

              {qrCodeUrl && (
                <div className="flex justify-center mb-3">
                  <div className="relative p-2 rounded-2xl bg-slate-950 border-2 border-cyan-400 shadow-[0_0_25px_rgba(0,240,255,0.25)]">
                    <img
                      src={qrCodeUrl}
                      alt="Pair phone QR code"
                      className="w-48 h-48 sm:w-56 sm:h-56 rounded-xl"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2 mb-4 text-xs font-mono">
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-left">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">ROOM CODE</div>
                    <div className="text-cyan-300 font-bold text-base">{roomId}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 uppercase">ACTIVE CARTRIDGE</div>
                    <div className="text-amber-400 font-bold text-xs">{currentDef.title}</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCopyLink}
                    className={`flex-1 py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                      copiedLink
                        ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                        : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(0,240,255,0.3)]'
                    }`}
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'LINK COPIED!' : 'COPY CONTROLLER LINK'}</span>
                  </button>

                  <button
                    onClick={() => {
                      if (onOpenPhoneView) {
                        setShowQrModal(false);
                        onOpenPhoneView();
                      } else if (controllerUrl) {
                        window.open(controllerUrl, '_blank');
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 text-cyan-400" />
                    <span>OPEN TAB</span>
                  </button>
                </div>
              </div>

              {/* Helpful Explanation for "No Access" error */}
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-left text-[11px] font-mono text-slate-400 leading-relaxed">
                <strong className="text-slate-200 block mb-1">
                  💡 Scanned and saw &ldquo;no access&rdquo; before?
                </strong>
                Google AI Studio&apos;s developer links require Google workspace sign-in. This QR code automatically uses the public shared link (<code>ais-pre-*</code>) so phone cameras can scan and play immediately with zero login or permission issues!
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
