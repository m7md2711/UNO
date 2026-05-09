'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Bot, Users, Play, Plus, X,
  Trophy, RotateCcw, Home, Crown, Volume2, VolumeX,
  AlertCircle, Coffee, Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import { Hand } from '@/components/game/hand';
import { DiscardPile, DrawPile, ColorPicker } from '@/components/game/piles';
import { canPlayCard, getPlayableCards, getNextPlayerIndex, type BotDifficulty } from '@/lib/game-logic';
import type { Room, RoomPlayer } from '@/lib/room-store';
import type { UnoCard, CardColor, Player } from '@/types/uno';

// ─── Constants ────────────────────────────────────────────────────────────────

const TURN_TIMEOUT_MS = 30_000;
const POLL_INTERVAL   =  1_000;

const BOT_AVATARS: Record<BotDifficulty, string> = { easy: '🤖', medium: '🦾', hard: '🧠' };

const TABLE_POSITIONS = {
  2: ['bottom', 'top'],
  3: ['bottom', 'top-left', 'top-right'],
  4: ['bottom', 'left', 'top', 'right'],
  5: ['bottom', 'left', 'top-left', 'top-right', 'right'],
  6: ['bottom', 'left', 'top-left', 'top', 'top-right', 'right'],
  7: ['bottom', 'left', 'top-left', 'top', 'top-right', 'right', 'bottom-right'],
  8: ['bottom', 'bottom-left', 'left', 'top-left', 'top', 'top-right', 'right', 'bottom-right'],
} as const;

type Pos = 'bottom'|'top'|'left'|'right'|'top-left'|'top-right'|'bottom-left'|'bottom-right';

// ─── Session helpers ──────────────────────────────────────────────────────────

function getPlayerId(): string {
  if (typeof window === 'undefined') return '';
  let id = sessionStorage.getItem('uno-player-id');
  if (!id) { id = Math.random().toString(36).substring(2, 11); sessionStorage.setItem('uno-player-id', id); }
  return id;
}
function getPlayerName(): string {
  return typeof window !== 'undefined' ? sessionStorage.getItem('uno-player-name') ?? '' : '';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RoomPage() {
  const { roomId } = useParams() as { roomId: string };
  const router     = useRouter();

  const playerId   = useRef(getPlayerId()).current;
  const playerName = useRef(getPlayerName()).current;

  const [room,          setRoom]          = useState<Room | null>(null);
  const [timeLeft,      setTimeLeft]      = useState(30);
  const [showColorPick, setShowColorPick] = useState(false);
  const [pendingCard,   setPendingCard]   = useState<UnoCard | null>(null);
  const [soundOn,       setSoundOn]       = useState(true);
  const [addBotDiff,    setAddBotDiff]    = useState<BotDifficulty>('medium');
  const [busySend,      setBusySend]      = useState(false);

  // Keep a ref to current room so the interval trigger can read it without stale closures
  const roomRef     = useRef<Room | null>(null);
  const triggerBusy = useRef(false);

  useEffect(() => { roomRef.current = room; }, [room]);

  // ── Poll ───────────────────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}?playerId=${playerId}`, { cache: 'no-store' });
      if (!res.ok) return;
      setRoom(await res.json());
    } catch {}
  }, [roomId, playerId]);

  const pollRef = useRef(poll);
  useEffect(() => { pollRef.current = poll; }, [poll]);

  // ── Join + poll loop ───────────────────────────────────────────────────────
  useEffect(() => {
    if (playerName) {
      fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'join', playerId, playerName }),
      });
    }
    poll();
    const iv = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(iv);
  }, [roomId, playerId, playerName, poll]);

  // ── Timer countdown ────────────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const r = roomRef.current;
      if (!r?.turnStartTime) return;
      const elapsed = Date.now() - r.turnStartTime;
      setTimeLeft(Math.max(0, Math.round((TURN_TIMEOUT_MS - elapsed) / 1000)));
    }, 100);
    return () => clearInterval(iv);
  }, []);

  // ── Auto-trigger: timeout / bot-move / uno-penalty ────────────────────────
  // Uses an interval + ref to avoid the stale-closure bug of dep-based effects.
  useEffect(() => {
    const iv = setInterval(async () => {
      if (triggerBusy.current) return;
      const r = roomRef.current;
      if (!r?.gameState || r.phase !== 'playing') return;
      const gs  = r.gameState;
      const now = Date.now();

      let body: object | null = null;

      if (now - r.turnStartTime >= TURN_TIMEOUT_MS) {
        body = { type: 'timeout', playerId, turnIndex: gs.currentPlayerIndex };
      } else if (r.botMoveAfter !== null && now >= r.botMoveAfter) {
        const cp = gs.players[gs.currentPlayerIndex];
        const rp = r.players.find(p => p.id === cp.id);
        if (rp?.isBot || (r.afkPlayerIds ?? []).includes(cp.id)) {
          body = { type: 'bot-move', playerId, turnIndex: gs.currentPlayerIndex };
        }
      } else if (r.unoPendingId && r.unoDeadline && now >= r.unoDeadline) {
        body = { type: 'uno-penalty', playerId, targetId: r.unoPendingId };
      }

      if (!body) return;
      triggerBusy.current = true;
      try {
        await fetch(`/api/rooms/${roomId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        await pollRef.current();
      } catch {}
      triggerBusy.current = false;
    }, 500);
    return () => clearInterval(iv);
  }, [roomId, playerId]);

  // ── User action sender ─────────────────────────────────────────────────────
  async function action(body: object) {
    if (busySend) return;
    setBusySend(true);
    try {
      await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await poll();
    } catch {}
    setBusySend(false);
  }

  async function handleLeave() {
    await action({ type: 'leave', playerId });
    router.push('/');
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!room) return (
    <div className="min-h-screen gradient-bg flex items-center justify-center text-white text-xl">
      Loading…
    </div>
  );

  if (room.phase === 'waiting') {
    return <LobbyView room={room} playerId={playerId} addBotDiff={addBotDiff}
      setAddBotDiff={setAddBotDiff} action={action} onLeave={handleLeave} />;
  }

  if (room.phase === 'finished' || room.gameState?.phase === 'round-end') {
    return <GameOverView room={room} playerId={playerId} action={action} onLeave={handleLeave} />;
  }

  return (
    <GameView
      room={room} playerId={playerId} timeLeft={timeLeft}
      showColorPick={showColorPick} setShowColorPick={setShowColorPick}
      pendingCard={pendingCard} setPendingCard={setPendingCard}
      soundOn={soundOn} setSoundOn={setSoundOn}
      action={action} onLeave={handleLeave}
    />
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LOBBY VIEW
// ═════════════════════════════════════════════════════════════════════════════

function LobbyView({ room, playerId, addBotDiff, setAddBotDiff, action, onLeave }: {
  room: Room; playerId: string; addBotDiff: BotDifficulty;
  setAddBotDiff: (d: BotDifficulty) => void;
  action: (b: object) => void; onLeave: () => void;
}) {
  const isHost   = room.hostId === playerId;
  const canStart = room.players.length >= 2;

  return (
    <main className="min-h-screen gradient-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="text-white/70 hover:text-white" onClick={onLeave}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Leave
          </Button>
          <GlassPanel className="px-4 py-2 text-center">
            <span className="font-mono text-primary font-bold text-lg">{room.name}</span>
            <p className="text-xs text-yellow-400 mt-0.5">🏆 First to {room.matchTarget.toLocaleString()} pts</p>
          </GlassPanel>
          <div className="w-16" />
        </div>

        <GlassPanel className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Players ({room.players.length}/8)
            </h2>
            {isHost && (
              <div className="flex items-center gap-2">
                <select
                  value={addBotDiff}
                  onChange={e => setAddBotDiff(e.target.value as BotDifficulty)}
                  className="text-xs rounded px-2 py-1 bg-card border border-border text-foreground"
                >
                  <option value="easy">🤖 Easy</option>
                  <option value="medium">🦾 Medium</option>
                  <option value="hard">🧠 Hard</option>
                </select>
                <Button size="sm" variant="outline"
                  disabled={room.players.length >= 8}
                  onClick={() => action({ type: 'add-bot', playerId, difficulty: addBotDiff })}>
                  <Plus className="w-3 h-3 mr-1" /> Add Bot
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {room.players.map(p => (
              <motion.div key={p.id}
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                className="relative p-3 rounded-xl border-2 border-primary/30 bg-primary/5 text-center"
              >
                {p.isHost && <Crown className="absolute -top-2 -right-2 w-5 h-5 text-yellow-400" />}
                {p.isBot && isHost && (
                  <button onClick={() => action({ type: 'remove-bot', playerId, botId: p.id })}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center">
                    <X className="w-2.5 h-2.5 text-white" />
                  </button>
                )}
                <div className="text-3xl mb-1">{p.isBot ? BOT_AVATARS[p.botDifficulty ?? 'medium'] : '👤'}</div>
                <p className="text-xs font-semibold truncate">{p.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {p.isHost ? '👑 Host' : p.isBot ? `Bot (${p.botDifficulty})` : 'Player'}
                </p>
                {p.id === playerId && (
                  <span className="absolute top-1 left-1 text-[9px] bg-primary/30 text-primary rounded px-1">You</span>
                )}
              </motion.div>
            ))}
            {Array.from({ length: Math.max(0, 4 - room.players.length) }).map((_, i) => (
              <div key={i} className="p-3 rounded-xl border-2 border-dashed border-border/30 text-center">
                <p className="text-muted-foreground text-xs mt-4">Empty</p>
              </div>
            ))}
          </div>
        </GlassPanel>

        {isHost ? (
          <Button
            className="w-full h-12 text-lg font-bold bg-gradient-to-r from-primary to-accent"
            disabled={!canStart}
            onClick={() => action({ type: 'start', playerId })}
          >
            <Play className="w-5 h-5 mr-2" />
            {canStart ? 'Start Game' : 'Need at least 2 players'}
          </Button>
        ) : (
          <GlassPanel className="p-4 text-center text-muted-foreground text-sm">
            Waiting for host to start…
          </GlassPanel>
        )}
      </div>
    </main>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// GAME OVER VIEW  (handles both round-end and match-winner states)
// ═════════════════════════════════════════════════════════════════════════════

function GameOverView({ room, playerId, action, onLeave }: {
  room: Room; playerId: string; action: (b: object) => void; onLeave: () => void;
}) {
  const gs          = room.gameState;
  const isHost      = room.hostId === playerId;
  const hasWinner   = !!room.matchWinner;
  const target      = room.matchTarget;

  // Sort match scores descending
  const matchRanking = room.players
    .map(p => ({ id: p.id, name: p.name, score: room.matchScores[p.id] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  // Round winner from gs.scores (highest per-round score)
  const roundWinner = gs
    ? [...(gs.players)].sort((a, b) => (gs.scores[b.id] ?? 0) - (gs.scores[a.id] ?? 0))[0]
    : null;

  const MEDALS = ['🥇', '🥈', '🥉'];

  if (hasWinner) {
    // ── Match winner screen ─────────────────────────────────────────────────
    return (
      <main className="min-h-screen gradient-bg flex items-center justify-center p-4">
        <GlassPanel className="p-8 text-center max-w-md w-full">
          <motion.div animate={{ scale: [1, 1.15, 1], rotate: [0, -8, 8, 0] }} transition={{ repeat: Infinity, duration: 1.2 }}>
            <Trophy className="w-24 h-24 mx-auto text-yellow-400 mb-4" />
          </motion.div>

          <h2 className="text-4xl font-black text-white mb-1">Match Winner!</h2>
          <p className="text-yellow-400 font-bold text-xl mb-1">
            {room.matchWinnerName === gs?.players.find(p => p.id === playerId)?.name
              ? '🎉 That\'s You!'
              : `👑 ${room.matchWinnerName}`}
          </p>
          <p className="text-muted-foreground text-sm mb-6">
            First to reach {target.toLocaleString()} points!
          </p>

          <div className="bg-white/5 rounded-xl p-4 mb-6 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Final Scores</p>
            {matchRanking.map((p, i) => (
              <div key={p.id} className={`flex justify-between items-center px-3 py-2 rounded-lg ${i === 0 ? 'bg-yellow-500/20' : ''}`}>
                <span className="flex items-center gap-2 text-sm">
                  <span>{MEDALS[i] ?? '  '}</span>
                  {p.id === playerId ? <strong>{p.name} (You)</strong> : p.name}
                </span>
                <span className="font-bold text-yellow-400">{p.score} pts</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onLeave}>
              <Home className="w-4 h-4 mr-2" /> Leave
            </Button>
            {isHost && (
              <Button
                className="flex-1 bg-gradient-to-r from-primary to-accent"
                onClick={() => action({ type: 'new-match', playerId })}
              >
                <RotateCcw className="w-4 h-4 mr-2" /> New Match
              </Button>
            )}
          </div>
          {!isHost && (
            <p className="text-xs text-muted-foreground mt-3">Waiting for host to start a new match…</p>
          )}
        </GlassPanel>
      </main>
    );
  }

  // ── Round-end screen ────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <GlassPanel className="p-8 text-center max-w-md w-full">
        <Star className="w-16 h-16 mx-auto text-yellow-400 mb-3" />

        <h2 className="text-3xl font-black text-white mb-1">Round Over!</h2>
        <p className="text-muted-foreground text-sm mb-1">
          {roundWinner?.id === playerId ? '🎉 You won the round!' : `${roundWinner?.name} won the round!`}
        </p>
        {roundWinner && gs && (
          <p className="text-green-400 text-sm font-semibold mb-5">
            +{gs.scores[roundWinner.id] ?? 0} points collected
          </p>
        )}

        {/* Match score progress */}
        <div className="bg-white/5 rounded-xl p-4 mb-6">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
            Match Progress — first to {target.toLocaleString()} pts
          </p>
          <div className="space-y-3">
            {matchRanking.map((p, i) => {
              const pct = Math.min(100, (p.score / target) * 100);
              return (
                <div key={p.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="flex items-center gap-1">
                      {MEDALS[i] && <span>{MEDALS[i]}</span>}
                      <span className={p.id === playerId ? 'font-bold text-white' : 'text-muted-foreground'}>
                        {p.name}{p.id === playerId ? ' (You)' : ''}
                      </span>
                    </span>
                    <span className="font-mono font-bold text-white">{p.score} / {target}</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onLeave}>
            <Home className="w-4 h-4 mr-2" /> Leave
          </Button>
          {isHost && (
            <Button
              className="flex-1 bg-gradient-to-r from-primary to-accent"
              onClick={() => action({ type: 'start', playerId })}
            >
              <Play className="w-4 h-4 mr-2" /> Next Round
            </Button>
          )}
        </div>
        {!isHost && (
          <p className="text-xs text-muted-foreground mt-3">Waiting for host to start the next round…</p>
        )}
      </GlassPanel>
    </main>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// GAME VIEW
// ═════════════════════════════════════════════════════════════════════════════

function GameView({
  room, playerId, timeLeft, showColorPick, setShowColorPick,
  pendingCard, setPendingCard, soundOn, setSoundOn, action, onLeave,
}: {
  room: Room; playerId: string; timeLeft: number;
  showColorPick: boolean; setShowColorPick: (v: boolean) => void;
  pendingCard: UnoCard | null; setPendingCard: (c: UnoCard | null) => void;
  soundOn: boolean; setSoundOn: (v: boolean) => void;
  action: (b: object) => void; onLeave: () => void;
}) {
  const gs = room.gameState!;

  const myPlayer  = gs.players.find(p => p.id === playerId);
  const isMyTurn  = gs.players[gs.currentPlayerIndex]?.id === playerId;
  const isBotTurn = room.players.find(p => p.id === gs.players[gs.currentPlayerIndex]?.id)?.isBot ?? false;
  const isAfk     = (room.afkPlayerIds ?? []).includes(playerId);

  const nextIndex  = getNextPlayerIndex(gs.currentPlayerIndex, gs.direction, gs.players.length);
  const nextPlayer = gs.players[nextIndex];

  const topCard     = gs.discardPile[gs.discardPile.length - 1];
  const playableIds = myPlayer
    ? getPlayableCards(myPlayer.hand, topCard, gs.currentColor, gs.pendingDraw, gs.settings.stackingEnabled).map(c => c.id)
    : [];

  const unoPendingMe = room.unoPendingId === playerId;
  const unoTimeLeft  = room.unoDeadline ? Math.max(0, Math.ceil((room.unoDeadline - Date.now()) / 1000)) : 0;

  const myIndex        = gs.players.findIndex(p => p.id === playerId);
  const orderedPlayers = myIndex >= 0
    ? [...gs.players.slice(myIndex), ...gs.players.slice(0, myIndex)]
    : gs.players;

  function handleCardClick(card: UnoCard) {
    if (!isMyTurn || !myPlayer || isAfk) return;
    if (!canPlayCard(card, topCard, gs.currentColor, gs.pendingDraw, gs.settings.stackingEnabled)) return;
    if (card.color === 'wild') { setPendingCard(card); setShowColorPick(true); return; }
    action({ type: 'play-card', playerId, cardId: card.id });
  }

  function handleColorSelect(color: Exclude<CardColor, 'wild'>) {
    if (!pendingCard) return;
    action({ type: 'play-card', playerId, cardId: pendingCard.id, chosenColor: color });
    setPendingCard(null); setShowColorPick(false);
  }

  const timerProgress = timeLeft / 30;
  const timerColor    = timerProgress > 0.5 ? '#22c55e' : timerProgress > 0.25 ? '#eab308' : '#ef4444';

  return (
    <main className="min-h-screen gradient-bg relative overflow-hidden flex flex-col">

      {/* ── AFK Overlay ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isAfk && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-6 p-6"
          >
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
              <Coffee className="w-20 h-20 text-yellow-400" />
            </motion.div>
            <div className="text-center">
              <h2 className="text-3xl font-black text-white mb-2">You are AFK</h2>
              <p className="text-muted-foreground text-sm max-w-xs">
                A bot is covering your turns. Press the button when you're ready.
              </p>
            </div>
            <Button
              className="px-10 py-4 text-lg font-bold bg-gradient-to-r from-primary to-accent shadow-xl"
              onClick={() => action({ type: 'return', playerId })}
            >
              I'm Back! 👋
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="z-20 px-4 pt-3 pb-2 flex items-center gap-3">
        <Button variant="ghost" size="sm" className="text-white/70 hover:text-white shrink-0" onClick={onLeave}>
          <ArrowLeft className="w-4 h-4" />
        </Button>

        <GlassPanel className="px-3 py-1.5 shrink-0">
          <span className="font-mono text-primary font-bold text-sm">{room.name}</span>
        </GlassPanel>

        {/* Timer */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-white/60">
              {isMyTurn && !isAfk
                ? '⏱ Your turn'
                : isBotTurn || (isMyTurn && isAfk)
                  ? '🤖 Bot thinking…'
                  : `⏱ ${gs.players[gs.currentPlayerIndex]?.name}'s turn`}
            </span>
            <span className="font-mono font-bold" style={{ color: timerColor }}>{timeLeft}s</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: timerColor }}
              animate={{ width: `${timerProgress * 100}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </div>

        {/* Match score mini-badge */}
        <div className="shrink-0 text-right">
          <p className="text-[10px] text-muted-foreground">Match</p>
          <p className="text-xs font-bold text-yellow-400">
            {room.matchScores[playerId] ?? 0}/{room.matchTarget}
          </p>
        </div>

        <Button variant="ghost" size="icon" className="text-white/70 hover:text-white shrink-0"
          onClick={() => setSoundOn(!soundOn)}>
          {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </Button>
      </header>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-2 pb-0">
        <div className="relative w-full max-w-4xl" style={{ minHeight: 340 }}>

          {/* Center piles */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-6 z-10">
            <DrawPile
              cardCount={gs.drawPile.length}
              canDraw={isMyTurn && !isAfk && (playableIds.length === 0 || gs.pendingDraw > 0)}
              pendingDraw={gs.pendingDraw}
              onDraw={() => action({ type: 'draw-card', playerId })}
            />
            <div className="flex flex-col items-center gap-2">
              <DiscardPile topCard={topCard} currentColor={gs.currentColor} />
              <div className="text-xs text-white/50">
                {gs.direction === 1 ? '↻ Clockwise' : '↺ Counter'}
              </div>
              {gs.pendingDraw > 0 && (
                <div className="text-xs font-bold text-red-400 animate-pulse">
                  +{gs.pendingDraw} stacked!
                </div>
              )}
            </div>
          </div>

          {/* Opponents */}
          {orderedPlayers.slice(1).map((player, idx) => {
            const pos    = (TABLE_POSITIONS[orderedPlayers.length as keyof typeof TABLE_POSITIONS] || TABLE_POSITIONS[4])[idx + 1] as Pos;
            const isActive  = gs.players[gs.currentPlayerIndex].id === player.id;
            const isNext    = nextPlayer?.id === player.id;
            const roomP     = room.players.find(rp => rp.id === player.id);
            const isOppAfk  = (room.afkPlayerIds ?? []).includes(player.id);
            const matchScore = room.matchScores[player.id] ?? 0;
            return (
              <OpponentSpot
                key={player.id}
                player={player}
                position={pos}
                isActive={isActive}
                isNext={isNext && !isActive}
                isBot={roomP?.isBot ?? false}
                difficulty={roomP?.botDifficulty}
                isAfk={isOppAfk}
                matchScore={matchScore}
                matchTarget={room.matchTarget}
              />
            );
          })}
        </div>
      </div>

      {/* ── UNO penalty warning ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {unoPendingMe && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-40"
          >
            <div className="bg-red-500/90 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 animate-pulse" />
              <span className="font-bold">Press UNO! ({unoTimeLeft}s left)</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Turn badge ──────────────────────────────────────────────────────── */}
      {isMyTurn && !isAfk && (
        <div className="text-center mb-1">
          <motion.span
            className="inline-block px-4 py-1 bg-primary text-white rounded-full text-sm font-bold"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ repeat: Infinity, duration: 0.9 }}
          >
            Your Turn!
          </motion.span>
        </div>
      )}

      {/* ── My hand ────────────────────────────────────────────────────────── */}
      <div className="relative z-10 px-2 pb-1" style={{ minHeight: 120 }}>
        <div className="flex items-end justify-center" style={{ height: 110 }}>
          {myPlayer ? (
            <Hand
              cards={myPlayer.hand}
              selectedCardId={null}
              playableCardIds={isMyTurn && !isAfk ? playableIds : []}
              isCurrentPlayer={isMyTurn && !isAfk}
              onCardClick={handleCardClick}
            />
          ) : (
            <div className="text-white/40 text-sm">Spectating…</div>
          )}
        </div>

        {/* Player info strip */}
        <div className="flex items-center justify-between px-2 py-1">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${isMyTurn && !isAfk ? 'bg-primary ring-2 ring-white' : 'bg-primary/40'}`}>
              {gs.players.find(p => p.id === playerId)?.name?.[0] ?? 'Y'}
            </div>
            <div>
              <p className="text-xs font-semibold text-white flex items-center gap-1">
                {gs.players.find(p => p.id === playerId)?.name ?? 'You'}
                {isAfk && <span className="text-[9px] bg-yellow-500/30 text-yellow-400 px-1.5 py-0.5 rounded">AFK</span>}
                {isMyTurn && !isAfk && <span className="text-[10px] bg-primary/40 text-primary px-1.5 py-0.5 rounded">PLAYING</span>}
                {nextPlayer?.id === playerId && !isMyTurn && !isAfk && <span className="text-[10px] bg-orange-500/30 text-orange-400 px-1.5 py-0.5 rounded">NEXT</span>}
              </p>
              <p className="text-[10px] text-muted-foreground">{myPlayer?.hand.length ?? 0} cards</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Round / Match</p>
            <p className="text-sm font-bold text-white">
              {gs.scores[playerId] ?? 0} / <span className="text-yellow-400">{room.matchScores[playerId] ?? 0}</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Action buttons ──────────────────────────────────────────────────── */}
      <div className="z-20 px-3 pb-4 pt-2 border-t border-white/10">
        <div className="flex gap-2 max-w-sm mx-auto">
          {isAfk ? (
            <ActionBtn
              label="I'm Back!"
              emoji="👋"
              color="from-yellow-500 to-orange-500"
              disabled={false}
              pulse
              onClick={() => action({ type: 'return', playerId })}
            />
          ) : (
            <>
              <ActionBtn
                label="Draw Card"
                emoji="🃏"
                color="from-blue-600 to-blue-700"
                disabled={!isMyTurn || room.drawnThisTurn}
                onClick={() => action({ type: 'draw-card', playerId })}
              />
              <ActionBtn
                label="Skip"
                emoji="⏭"
                color="from-slate-600 to-slate-700"
                disabled={!isMyTurn || !room.drawnThisTurn}
                onClick={() => action({ type: 'skip-turn', playerId })}
              />
              <ActionBtn
                label="UNO!"
                emoji="🔴"
                color={unoPendingMe ? 'from-red-500 to-red-600' : 'from-red-700 to-rose-800'}
                disabled={!myPlayer || (myPlayer.hand.length !== 2 && !unoPendingMe)}
                pulse={unoPendingMe || (isMyTurn && myPlayer?.hand.length === 2)}
                onClick={() => action({ type: 'call-uno', playerId })}
              />
            </>
          )}
        </div>
      </div>

      <ColorPicker isOpen={showColorPick} onColorSelect={handleColorSelect} />
    </main>
  );
}

// ─── Action Button ────────────────────────────────────────────────────────────

function ActionBtn({ label, emoji, color, disabled, pulse, onClick }: {
  label: string; emoji: string; color: string;
  disabled: boolean; pulse?: boolean; onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      animate={pulse && !disabled ? { scale: [1, 1.08, 1] } : {}}
      transition={{ repeat: Infinity, duration: 0.7 }}
      onClick={onClick}
      disabled={disabled}
      className={`
        flex-1 flex flex-col items-center justify-center gap-0.5 py-3 rounded-2xl
        bg-gradient-to-b ${color} text-white font-bold text-xs shadow-lg
        disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95
      `}
    >
      <span className="text-xl">{emoji}</span>
      <span>{label}</span>
    </motion.button>
  );
}

// ─── Opponent Spot ─────────────────────────────────────────────────────────────

const POS_STYLES: Record<Pos, string> = {
  top:           'top-0 left-1/2 -translate-x-1/2',
  bottom:        'bottom-0 left-1/2 -translate-x-1/2',
  left:          'left-0 top-1/2 -translate-y-1/2',
  right:         'right-0 top-1/2 -translate-y-1/2',
  'top-left':    'top-6 left-4',
  'top-right':   'top-6 right-4',
  'bottom-left': 'bottom-6 left-4',
  'bottom-right':'bottom-6 right-4',
};

function OpponentSpot({ player, position, isActive, isNext, isBot, difficulty, isAfk, matchScore, matchTarget }: {
  player: Player; position: Pos;
  isActive: boolean; isNext: boolean; isBot: boolean; difficulty?: BotDifficulty;
  isAfk: boolean; matchScore: number; matchTarget: number;
}) {
  const pct = Math.min(100, (matchScore / matchTarget) * 100);
  return (
    <motion.div
      className={`absolute ${POS_STYLES[position]}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: isAfk ? 0.65 : 1, scale: isActive ? 1.12 : 1 }}
      transition={{ type: 'spring', stiffness: 200 }}
    >
      <div className="flex flex-col items-center gap-1">
        <div className={`
          px-3 py-1.5 rounded-xl border-2 flex items-center gap-2 text-sm transition-all duration-300
          ${isActive
            ? 'border-green-400 bg-green-500/20 shadow-[0_0_16px_rgba(34,197,94,0.4)]'
            : isNext
              ? 'border-orange-400/60 bg-orange-500/10'
              : isAfk
                ? 'border-yellow-500/40 bg-yellow-500/5'
                : 'border-white/10 bg-white/5'}
        `}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
            ${isActive ? 'bg-green-500' : isNext ? 'bg-orange-500/60' : 'bg-white/20'}`}>
            {isAfk ? '💤' : isBot ? (difficulty === 'hard' ? '🧠' : difficulty === 'medium' ? '🦾' : '🤖') : '👤'}
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs font-semibold text-white truncate max-w-[70px]">{player.name}</p>
            <p className="text-[10px] text-muted-foreground">{player.hand.length} cards</p>
          </div>

          {isAfk && <span className="text-[9px] bg-yellow-500/40 text-yellow-300 px-1.5 py-0.5 rounded font-bold ml-1">AFK</span>}
          {isActive && !isAfk && (
            <motion.span
              className="text-[9px] bg-green-500 text-white px-1.5 py-0.5 rounded font-bold ml-1"
              animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}
            >PLAYING</motion.span>
          )}
          {isActive && isAfk && (
            <motion.span
              className="text-[9px] bg-yellow-500 text-white px-1.5 py-0.5 rounded font-bold ml-1"
              animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}
            >BOT</motion.span>
          )}
          {isNext && !isActive && <span className="text-[9px] bg-orange-500/70 text-white px-1.5 py-0.5 rounded font-bold ml-1">NEXT</span>}
          {player.hand.length === 1 && <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded font-bold">UNO</span>}
        </div>

        {/* Match score mini-bar */}
        <div className="w-full px-1">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-400/70 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[9px] text-yellow-400/70 text-center mt-0.5">{matchScore} pts</p>
        </div>

        {/* Face-down cards */}
        <div className="flex -space-x-4">
          {Array.from({ length: Math.min(player.hand.length, 6) }).map((_, i) => (
            <motion.div
              key={i}
              className={`w-8 h-12 rounded-md border flex items-center justify-center
                ${isActive ? 'border-green-400/50 bg-green-900/30' : 'border-white/15 bg-black/40'}`}
              style={{ zIndex: i }}
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.04 }}
            >
              <div className="w-4 h-3 rotate-45 rounded-sm"
                style={{ background: 'linear-gradient(135deg,#ef4444 25%,#3b82f6 25%,#3b82f6 50%,#22c55e 50%,#22c55e 75%,#eab308 75%)' }}
              />
            </motion.div>
          ))}
          {player.hand.length === 0 && <span className="text-xs text-white/40 italic">No cards</span>}
        </div>
      </div>
    </motion.div>
  );
}
