'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Trophy,
  RotateCcw,
  Home,
  Bot,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import { Hand } from '@/components/game/hand';
import { DiscardPile, DrawPile, ColorPicker } from '@/components/game/piles';
import {
  initializeGame,
  canPlayCard,
  getPlayableCards,
  getNextPlayerIndex,
  calculateHandScore,
  reshuffleDeck,
  botSelectCard,
  shouldBotCallUno,
  type BotDifficulty,
} from '@/lib/game-logic';
import type { UnoCard as UnoCardType, CardColor, GameState, Player } from '@/types/uno';

const POSITIONS = {
  2: ['bottom', 'top'],
  3: ['bottom', 'top-left', 'top-right'],
  4: ['bottom', 'left', 'top', 'right'],
  5: ['bottom', 'left', 'top-left', 'top-right', 'right'],
  6: ['bottom', 'left', 'top-left', 'top', 'top-right', 'right'],
  7: ['bottom', 'left', 'top-left', 'top', 'top-right', 'right', 'bottom-right'],
  8: ['bottom', 'bottom-left', 'left', 'top-left', 'top', 'top-right', 'right', 'bottom-right'],
} as const;

type Position =
  | 'bottom' | 'top' | 'left' | 'right'
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface BotPlayer {
  id: string;
  name: string;
  difficulty: BotDifficulty;
}

const BOT_AVATARS: Record<BotDifficulty, string> = { easy: '🤖', medium: '🦾', hard: '🧠' };
const BOT_NAMES = ['RoboUno', 'CardBot', 'UnoMaster', 'WildCard', 'DrawFour', 'StackAttack'];

const sessionKey = (code: string) => `uno-session-${code}`;
const configKey  = (code: string) => `uno-config-${code}`;

const DEFAULT_SETTINGS = {
  pointsToWin: 500,
  stackingEnabled: true,
  jumpInEnabled: false,
  sevenZeroEnabled: false,
  turnTimer: 30,
  forcePlay: true,
};

export default function GamePage() {
  const params       = useParams();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const roomCode     = params.roomCode as string;

  const [gameState,      setGameState]      = useState<GameState | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingWildCard, setPendingWildCard] = useState<UnoCardType | null>(null);
  const [soundEnabled,   setSoundEnabled]   = useState(true);
  const [showGameOver,   setShowGameOver]   = useState(false);
  const [winner,         setWinner]         = useState<Player | null>(null);
  const [lastAction,     setLastAction]     = useState('');
  const [botPlayers,     setBotPlayers]     = useState<BotPlayer[]>([]);

  const currentPlayerId    = 'current-user';
  const botTimeoutRef      = useRef<NodeJS.Timeout | null>(null);
  const gameStateRef       = useRef<GameState | null>(null);
  const isProcessingBotRef = useRef(false);

  // Keep gameStateRef always current so the bot callback never reads stale state.
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // ─── Initialize ────────────────────────────────────────────────────────────
  useEffect(() => {
    // 1. Try to restore an in-progress session.
    try {
      const raw = localStorage.getItem(sessionKey(roomCode));
      if (raw) {
        const { gameState: gs, botPlayers: bps } = JSON.parse(raw);
        if (gs?.phase === 'playing') {
          setGameState(gs);
          setBotPlayers(bps ?? []);
          return;
        }
      }
    } catch {}

    // 2. Load config saved by the lobby.
    let bots: BotPlayer[]  = [];
    let settings           = { ...DEFAULT_SETTINGS };

    try {
      const raw = localStorage.getItem(configKey(roomCode));
      if (raw) {
        const cfg = JSON.parse(raw);
        bots     = cfg.bots     ?? [];
        settings = cfg.settings ?? settings;
      }
    } catch {}

    // 3. Fall back to URL params (direct navigation / demo links).
    if (bots.length === 0) {
      const diff     = (searchParams.get('difficulty') as BotDifficulty) || 'medium';
      const count    = Math.min(parseInt(searchParams.get('bots') || '3', 10), 7);
      for (let i = 0; i < count; i++) {
        bots.push({ id: `bot-${i}`, name: BOT_NAMES[i], difficulty: diff });
      }
    }

    setBotPlayers(bots);

    const players = [
      { id: currentPlayerId, name: 'You', avatar: '👤' },
      ...bots.map(b => ({
        id: b.id,
        name: b.name,
        avatar: BOT_AVATARS[b.difficulty],
        isBot: true,
        botDifficulty: b.difficulty,
      })),
    ];

    setGameState(initializeGame(roomCode, players, settings));
  }, [roomCode]);

  // ─── Persist session on every state change ─────────────────────────────────
  useEffect(() => {
    if (!gameState || botPlayers.length === 0) return;
    if (gameState.phase === 'round-end' || gameState.phase === 'game-end') {
      localStorage.removeItem(sessionKey(roomCode));
      return;
    }
    try {
      localStorage.setItem(sessionKey(roomCode), JSON.stringify({ gameState, botPlayers }));
    } catch {}
  }, [gameState, botPlayers, roomCode]);

  // ─── Derived ───────────────────────────────────────────────────────────────
  const currentPlayer = gameState?.players.find(p => p.id === currentPlayerId);
  const activePlayer  = gameState?.players[gameState.currentPlayerIndex];
  const isMyTurn      = activePlayer?.id === currentPlayerId;

  const playableCardIds =
    currentPlayer && gameState
      ? getPlayableCards(
          currentPlayer.hand,
          gameState.discardPile[gameState.discardPile.length - 1],
          gameState.currentColor,
          gameState.pendingDraw,
          gameState.settings.stackingEnabled
        ).map(c => c.id)
      : [];

  // ─── Winner check ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing') return;
    const roundWinner = gameState.players.find(p => p.hand.length === 0);
    if (!roundWinner) return;

    const points = gameState.players
      .filter(p => p.id !== roundWinner.id)
      .reduce((sum, p) => sum + calculateHandScore(p.hand), 0);

    setWinner(roundWinner);
    setShowGameOver(true);
    setGameState(prev =>
      prev
        ? {
            ...prev,
            phase: 'round-end',
            scores: {
              ...prev.scores,
              [roundWinner.id]: (prev.scores[roundWinner.id] || 0) + points,
            },
          }
        : null
    );
  }, [gameState?.players]);

  // ─── Core card actions ─────────────────────────────────────────────────────
  const playCardInternal = useCallback(
    (playerId: string, card: UnoCardType, chosenColor?: Exclude<CardColor, 'wild'>) => {
      setGameState(prev => {
        if (!prev) return null;
        const playerIndex = prev.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) return prev;

        const player  = prev.players[playerIndex];
        const newHand = player.hand.filter(c => c.id !== card.id);

        let newColor     = prev.currentColor;
        let newDirection = prev.direction;
        let skipNext     = false;
        let pendingDraw  = prev.pendingDraw;

        if (card.color === 'wild') {
          newColor = chosenColor || 'red';
        } else {
          newColor = card.color as Exclude<CardColor, 'wild'>;
        }

        if (card.value === 'reverse') {
          newDirection = (prev.direction * -1) as 1 | -1;
          if (prev.players.length === 2) skipNext = true;
        } else if (card.value === 'skip') {
          skipNext = true;
        } else if (card.value === 'draw2') {
          pendingDraw += 2;
        } else if (card.value === 'wild4') {
          pendingDraw += 4;
        }

        const nextPlayerIndex =
          card.value === 'draw2' || card.value === 'wild4'
            ? getNextPlayerIndex(playerIndex, newDirection, prev.players.length)
            : getNextPlayerIndex(playerIndex, newDirection, prev.players.length, skipNext);

        const newPlayers = [...prev.players];
        newPlayers[playerIndex] = { ...player, hand: newHand };

        setLastAction(`${player.name} played ${card.color} ${card.value}`);

        return {
          ...prev,
          players: newPlayers,
          discardPile: [...prev.discardPile, card],
          currentColor: newColor,
          direction: newDirection,
          currentPlayerIndex: nextPlayerIndex,
          pendingDraw:
            card.value === 'draw2' || card.value === 'wild4' ? pendingDraw : 0,
        };
      });
    },
    []
  );

  const drawCardInternal = useCallback((playerId: string) => {
    setGameState(prev => {
      if (!prev) return null;
      const playerIndex = prev.players.findIndex(p => p.id === playerId);
      if (playerIndex === -1) return prev;

      let { drawPile, discardPile } = prev;
      if (drawPile.length === 0) {
        const reshuffled = reshuffleDeck(drawPile, discardPile);
        drawPile    = reshuffled.drawPile;
        discardPile = reshuffled.discardPile;
      }

      const count      = prev.pendingDraw > 0 ? prev.pendingDraw : 1;
      const drawn      = drawPile.slice(0, count);
      const newDraw    = drawPile.slice(count);
      const player     = prev.players[playerIndex];
      const newPlayers = [...prev.players];
      newPlayers[playerIndex] = { ...player, hand: [...player.hand, ...drawn] };

      const nextPlayerIndex = getNextPlayerIndex(
        playerIndex, prev.direction, prev.players.length
      );

      setLastAction(`${player.name} drew ${count} card${count > 1 ? 's' : ''}`);

      return {
        ...prev,
        players: newPlayers,
        drawPile: newDraw,
        discardPile,
        currentPlayerIndex: nextPlayerIndex,
        pendingDraw: 0,
      };
    });
  }, []);

  // ─── Bot turns (uses refs to avoid stale closures) ─────────────────────────
  useEffect(() => {
    if (!gameState || gameState.phase !== 'playing') return;
    if (isProcessingBotRef.current) return;

    const activeBot = botPlayers.find(b => b.id === activePlayer?.id);
    if (!activeBot) return;

    isProcessingBotRef.current = true;

    const delay =
      activeBot.difficulty === 'easy'   ? 1500 :
      activeBot.difficulty === 'medium' ? 1000 : 700;

    botTimeoutRef.current = setTimeout(() => {
      const state = gameStateRef.current;
      if (!state || state.phase !== 'playing') {
        isProcessingBotRef.current = false;
        return;
      }

      const botPlayer = state.players.find(p => p.id === activeBot.id);
      if (!botPlayer) {
        isProcessingBotRef.current = false;
        return;
      }

      const topCard = state.discardPile[state.discardPile.length - 1];
      const { card, chosenColor } = botSelectCard(
        botPlayer.hand,
        topCard,
        state.currentColor,
        state.pendingDraw,
        activeBot.difficulty,
        state.settings,
        {
          playerCardCounts: state.players.map(p => p.hand.length),
          direction: state.direction,
          currentPlayerIndex: state.currentPlayerIndex,
        }
      );

      if (card) {
        playCardInternal(activeBot.id, card, chosenColor);
        if (botPlayer.hand.length - 1 === 1 && shouldBotCallUno(activeBot.difficulty)) {
          setTimeout(() => setLastAction(`${activeBot.name} calls UNO!`), 200);
        }
      } else {
        drawCardInternal(activeBot.id);
      }

      isProcessingBotRef.current = false;
    }, delay);

    return () => {
      if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
      isProcessingBotRef.current = false;
    };
  }, [gameState?.currentPlayerIndex, gameState?.phase, botPlayers, playCardInternal, drawCardInternal]);

  // ─── Player actions ────────────────────────────────────────────────────────
  const handleCardClick = useCallback(
    (card: UnoCardType) => {
      if (!isMyTurn || !gameState) return;

      const topCard = gameState.discardPile[gameState.discardPile.length - 1];
      if (
        !canPlayCard(
          card, topCard, gameState.currentColor,
          gameState.pendingDraw, gameState.settings.stackingEnabled
        )
      ) return;

      if (card.color === 'wild') {
        setPendingWildCard(card);
        setShowColorPicker(true);
        return;
      }

      playCardInternal(currentPlayerId, card);
    },
    [isMyTurn, gameState, playCardInternal]
  );

  const handleColorSelect = useCallback(
    (color: Exclude<CardColor, 'wild'>) => {
      if (!pendingWildCard) return;
      playCardInternal(currentPlayerId, pendingWildCard, color);
      setPendingWildCard(null);
      setShowColorPicker(false);
    },
    [pendingWildCard, playCardInternal]
  );

  const handleDraw = useCallback(() => {
    if (!isMyTurn) return;
    drawCardInternal(currentPlayerId);
  }, [isMyTurn, drawCardInternal]);

  const handleCallUno = useCallback(() => {
    if (!currentPlayer || currentPlayer.hand.length !== 2) return;
    setGameState(prev =>
      prev
        ? { ...prev, players: prev.players.map(p => p.id === currentPlayerId ? { ...p, hasCalledUno: true } : p) }
        : null
    );
    setLastAction('You called UNO!');
  }, [currentPlayer]);

  const handleRestart = useCallback(() => {
    localStorage.removeItem(sessionKey(roomCode));
    if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    isProcessingBotRef.current = false;

    let settings = { ...DEFAULT_SETTINGS };
    try {
      const raw = localStorage.getItem(configKey(roomCode));
      if (raw) settings = JSON.parse(raw).settings ?? settings;
    } catch {}

    const players = [
      { id: currentPlayerId, name: 'You', avatar: '👤' },
      ...botPlayers.map(b => ({
        id: b.id,
        name: b.name,
        avatar: BOT_AVATARS[b.difficulty],
        isBot: true,
        botDifficulty: b.difficulty,
      })),
    ];

    setGameState(initializeGame(roomCode, players, settings));
    setShowGameOver(false);
    setWinner(null);
    setLastAction('');
  }, [roomCode, botPlayers]);

  // ─── Render ────────────────────────────────────────────────────────────────
  if (!gameState || !currentPlayer) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    );
  }

  const topCard      = gameState.discardPile[gameState.discardPile.length - 1];
  const playerCount  = gameState.players.length as keyof typeof POSITIONS;
  const positions    = POSITIONS[playerCount] || POSITIONS[4];
  const myIndex      = gameState.players.findIndex(p => p.id === currentPlayerId);
  const orderedPlayers = [
    ...gameState.players.slice(myIndex),
    ...gameState.players.slice(0, myIndex),
  ];

  return (
    <main className="min-h-screen gradient-bg relative overflow-hidden">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center justify-between">
        <Link href="/">
          <Button variant="ghost" size="sm" className="text-white/70 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Leave
          </Button>
        </Link>

        <GlassPanel className="px-4 py-2">
          <span className="font-mono text-primary font-bold">{roomCode}</span>
        </GlassPanel>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="text-white/70 hover:text-white"
        >
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </Button>
      </header>

      {/* Game Table */}
      <div className="min-h-screen flex items-center justify-center p-4 pt-20 pb-48">
        <div className="relative w-full max-w-4xl aspect-[4/3]">
          {/* Piles */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-8">
            <DrawPile
              cardCount={gameState.drawPile.length}
              canDraw={isMyTurn && playableCardIds.length === 0}
              pendingDraw={gameState.pendingDraw}
              onDraw={handleDraw}
            />
            <DiscardPile topCard={topCard} currentColor={gameState.currentColor} />
          </div>

          {/* Direction ring */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border-2 border-white/10 pointer-events-none"
            animate={{ rotate: gameState.direction === 1 ? 360 : -360 }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full" />
          </motion.div>

          {/* Opponents */}
          {orderedPlayers.slice(1).map((player, index) => {
            const position = positions[index + 1] as Position;
            const isActive = gameState.players[gameState.currentPlayerIndex].id === player.id;
            const isBot    = botPlayers.some(b => b.id === player.id);
            const botDiff  = botPlayers.find(b => b.id === player.id)?.difficulty;
            return (
              <OpponentPosition
                key={player.id}
                player={player}
                position={position}
                isActive={isActive}
                isBot={isBot}
                difficulty={botDiff}
              />
            );
          })}
        </div>
      </div>

      {/* Last action toast */}
      <AnimatePresence>
        {lastAction && (
          <motion.div
            className="absolute top-24 left-1/2 -translate-x-1/2 z-30"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            key={lastAction}
          >
            <GlassPanel className="px-4 py-2 text-sm">{lastAction}</GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Turn indicator */}
      <div className="absolute bottom-52 left-1/2 -translate-x-1/2 z-20">
        <motion.div
          className={`px-6 py-2 rounded-full text-sm font-bold ${
            isMyTurn ? 'bg-primary text-primary-foreground' : 'bg-white/10 text-white/70'
          }`}
          animate={isMyTurn ? { scale: [1, 1.05, 1] } : {}}
          transition={{ repeat: Infinity, duration: 1 }}
        >
          {isMyTurn ? 'Your Turn!' : `${activePlayer?.name}'s turn`}
        </motion.div>
      </div>

      {/* UNO button — show when you have 2 cards on your turn */}
      <AnimatePresence>
        {currentPlayer.hand.length === 2 && isMyTurn && (
          <motion.div
            className="absolute bottom-52 right-8 z-20"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
          >
            <Button
              className="bg-red-500 hover:bg-red-600 text-white font-black text-xl px-6 py-4 rounded-full"
              onClick={handleCallUno}
            >
              UNO!
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Player hand */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <div className="relative h-48 flex items-end justify-center pb-4">
          <Hand
            cards={currentPlayer.hand}
            selectedCardId={null}
            playableCardIds={isMyTurn ? playableCardIds : []}
            isCurrentPlayer={isMyTurn}
            onCardClick={handleCardClick}
          />
        </div>

        {/* Player info */}
        <div className="absolute bottom-4 left-4">
          <GlassPanel className="px-4 py-2 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-white">You</p>
              <p className="text-xs text-muted-foreground">{currentPlayer.hand.length} cards</p>
            </div>
          </GlassPanel>
        </div>

        {/* Draw button */}
        {isMyTurn && (
          <div className="absolute bottom-4 right-4">
            <Button
              variant="secondary"
              onClick={handleDraw}
              disabled={playableCardIds.length > 0 && gameState.pendingDraw === 0}
            >
              Draw Card
            </Button>
          </div>
        )}
      </div>

      {/* Color picker */}
      <ColorPicker isOpen={showColorPicker} onColorSelect={handleColorSelect} />

      {/* Game over */}
      <AnimatePresence>
        {showGameOver && winner && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative"
            >
              <GlassPanel className="p-8 text-center max-w-md">
                <motion.div
                  animate={{ rotate: [0, -10, 10, 0] }}
                  transition={{ repeat: Infinity, duration: 0.5 }}
                >
                  <Trophy className="w-20 h-20 mx-auto text-yellow-400 mb-4" />
                </motion.div>

                <h2 className="text-3xl font-black text-white mb-2">
                  {winner.id === currentPlayerId ? 'You Win!' : `${winner.name} Wins!`}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {winner.id === currentPlayerId
                    ? 'Congratulations! You played all your cards!'
                    : `${winner.name} played all their cards first.`}
                </p>

                {/* Scores */}
                <div className="bg-white/5 rounded-lg p-4 mb-6">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">SCORES</h3>
                  <div className="space-y-2">
                    {gameState.players
                      .sort((a, b) => (gameState.scores[b.id] || 0) - (gameState.scores[a.id] || 0))
                      .map((player, i) => (
                        <div
                          key={player.id}
                          className={`flex items-center justify-between px-3 py-2 rounded ${i === 0 ? 'bg-yellow-500/20' : ''}`}
                        >
                          <span className="flex items-center gap-2">
                            {i === 0 && <Trophy className="w-4 h-4 text-yellow-400" />}
                            {player.name}
                          </span>
                          <span className="font-bold">{gameState.scores[player.id] || 0}</span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => router.push('/')}>
                    <Home className="w-4 h-4 mr-2" />
                    Home
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-primary to-accent"
                    onClick={handleRestart}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Play Again
                  </Button>
                </div>
              </GlassPanel>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

// ─── Opponent card display ───────────────────────────────────────────────────
const DIFFICULTY_LABEL: Record<BotDifficulty, string> = {
  easy: '🤖 Easy', medium: '🦾 Medium', hard: '🧠 Hard',
};

function OpponentPosition({
  player,
  position,
  isActive,
  isBot,
  difficulty,
}: {
  player: Player;
  position: Position;
  isActive: boolean;
  isBot: boolean;
  difficulty?: BotDifficulty;
}) {
  const positionStyles: Record<Position, string> = {
    top:           'top-0 left-1/2 -translate-x-1/2',
    bottom:        'bottom-0 left-1/2 -translate-x-1/2',
    left:          'left-0 top-1/2 -translate-y-1/2',
    right:         'right-0 top-1/2 -translate-y-1/2',
    'top-left':    'top-8 left-8',
    'top-right':   'top-8 right-8',
    'bottom-left': 'bottom-8 left-8',
    'bottom-right':'bottom-8 right-8',
  };

  return (
    <motion.div
      className={`absolute ${positionStyles[position]}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className={`flex flex-col items-center gap-2 ${isActive ? 'scale-110' : ''} transition-transform`}>
        <GlassPanel className={`px-3 py-2 flex items-center gap-2 ${isActive ? 'ring-2 ring-primary' : ''}`}>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/50 to-accent/50 flex items-center justify-center">
            {isBot ? <Bot className="w-4 h-4 text-white" /> : <User className="w-4 h-4 text-white" />}
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white flex items-center gap-1">
              {player.name}
              {player.hand.length === 1 && (
                <span className="text-[10px] bg-red-500 text-white px-1 rounded">UNO</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {isBot && difficulty ? DIFFICULTY_LABEL[difficulty] : `${player.hand.length} cards`}
            </p>
          </div>
        </GlassPanel>

        {/* Face-down cards */}
        <div className="flex -space-x-6">
          {Array.from({ length: Math.min(player.hand.length, 7) }).map((_, i) => (
            <motion.div
              key={i}
              className="w-10 h-14 rounded-md bg-black border border-white/20 flex items-center justify-center"
              style={{ zIndex: i }}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.05 }}
            >
              <div
                className="w-6 h-4 rotate-45 rounded-sm"
                style={{
                  background:
                    'linear-gradient(135deg, #ef4444 25%, #3b82f6 25%, #3b82f6 50%, #22c55e 50%, #22c55e 75%, #eab308 75%)',
                }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
