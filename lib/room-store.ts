/**
 * Server-side in-memory room store.
 * Uses a global variable so state survives Next.js hot-reloads in development.
 */

import type { GameState, GameSettings, CardColor, UnoCard } from '@/types/uno';
import {
  initializeGame,
  botSelectCard,
  shouldBotCallUno,
  canPlayCard,
  getPlayableCards,
  getNextPlayerIndex,
  calculateHandScore,
  reshuffleDeck,
  type BotDifficulty,
} from './game-logic';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RoomPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isBot: boolean;
  botDifficulty?: BotDifficulty;
  lastSeen: number;
}

export interface Room {
  id: string;
  name: string;
  players: RoomPlayer[];
  gameState: GameState | null;
  phase: 'waiting' | 'playing' | 'finished';
  hostId: string | null;
  // Turn timing
  turnStartTime: number;
  botMoveAfter: number | null;   // timestamp for bot / AFK auto-play
  drawnThisTurn: boolean;
  // UNO enforcement
  unoPendingId: string | null;
  unoDeadline: number | null;
  // AFK
  afkPlayerIds: string[];        // human players temporarily controlled by bot AI
}

export type RoomSummary = Pick<Room, 'id' | 'name' | 'phase'> & {
  humanCount: number;
  botCount: number;
  maxPlayers: number;
};

export type RoomAction =
  | { type: 'join';         playerId: string; playerName: string }
  | { type: 'leave';        playerId: string }
  | { type: 'add-bot';      playerId: string; difficulty: BotDifficulty }
  | { type: 'remove-bot';   playerId: string; botId: string }
  | { type: 'start';        playerId: string }
  | { type: 'play-card';    playerId: string; cardId: string; chosenColor?: Exclude<CardColor, 'wild'> }
  | { type: 'draw-card';    playerId: string }
  | { type: 'skip-turn';    playerId: string }
  | { type: 'call-uno';     playerId: string }
  | { type: 'timeout';      playerId: string; turnIndex: number }
  | { type: 'bot-move';     playerId: string; turnIndex: number }
  | { type: 'uno-penalty';  playerId: string; targetId: string }
  | { type: 'return';       playerId: string };   // player returning from AFK

// ─── Constants ───────────────────────────────────────────────────────────────

const TURN_TIMEOUT_MS = 30_000;
const UNO_WINDOW_MS   =  5_000;
const MAX_PLAYERS     = 8;
const BOT_NAMES       = ['RoboUno', 'CardBot', 'UnoMaster', 'WildCard', 'DrawFour', 'StackBot', 'ReverseBot'];

// ─── Singleton store ──────────────────────────────────────────────────────────

declare global { var __unoRooms: Map<string, Room> | undefined; }

const store: Map<string, Room> =
  global.__unoRooms ?? (global.__unoRooms = new Map());

for (let i = 1; i <= 5; i++) {
  const id = `room-${i}`;
  if (!store.has(id)) store.set(id, emptyRoom(id, `Room ${i}`));
}

function emptyRoom(id: string, name: string): Room {
  return {
    id, name, players: [], gameState: null,
    phase: 'waiting', hostId: null,
    turnStartTime: Date.now(), botMoveAfter: null,
    drawnThisTurn: false, unoPendingId: null, unoDeadline: null,
    afkPlayerIds: [],
  };
}

// ─── Public read API ──────────────────────────────────────────────────────────

export function getRoomSummaries(): RoomSummary[] {
  return Array.from(store.values()).map(r => ({
    id: r.id, name: r.name, phase: r.phase,
    humanCount: r.players.filter(p => !p.isBot).length,
    botCount:   r.players.filter(p =>  p.isBot).length,
    maxPlayers: MAX_PLAYERS,
  }));
}

/** Returns room state with other players' cards redacted. */
export function getRoomView(roomId: string, playerId?: string): Room | null {
  const room = store.get(roomId);
  if (!room) return null;
  if (!room.gameState || !playerId) return room;

  const redacted: GameState = {
    ...room.gameState,
    players: room.gameState.players.map(p =>
      p.id === playerId
        ? p
        : { ...p, hand: p.hand.map(c => ({ ...c, _hidden: true } as UnoCard)) }
    ),
  };
  return { ...room, gameState: redacted };
}

/** Reset all rooms to empty — used by admin. */
export function resetAllRooms(): void {
  for (const [id, room] of store) {
    store.set(id, emptyRoom(id, room.name));
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function isAutoPlay(room: Room, playerId: string): boolean {
  const rp = room.players.find(p => p.id === playerId);
  return !!(rp?.isBot || room.afkPlayerIds.includes(playerId));
}

function setTurnStart(room: Room) {
  room.drawnThisTurn = false;
  room.turnStartTime = Date.now();
  room.botMoveAfter  = null;

  const gs = room.gameState;
  if (!gs) return;

  const currentId = gs.players[gs.currentPlayerIndex].id;
  if (isAutoPlay(room, currentId)) {
    // Random 0-15 second delay for bots / AFK players
    room.botMoveAfter = Date.now() + Math.floor(Math.random() * 15_000);
  }
}

function applyPlayCard(
  room: Room,
  playerIndex: number,
  card: UnoCard,
  chosenColor?: Exclude<CardColor, 'wild'>,
): string | null {
  const gs      = room.gameState!;
  const player  = gs.players[playerIndex];
  const newHand = player.hand.filter(c => c.id !== card.id);

  let newColor     = gs.currentColor;
  let newDirection = gs.direction;
  let skipNext     = false;
  let pendingDraw  = gs.pendingDraw;

  if (card.color === 'wild') {
    newColor = chosenColor ?? 'red';
  } else {
    newColor = card.color as Exclude<CardColor, 'wild'>;
  }

  if      (card.value === 'reverse') { newDirection = (gs.direction * -1) as 1 | -1; if (gs.players.length === 2) skipNext = true; }
  else if (card.value === 'skip')    { skipNext = true; }
  else if (card.value === 'draw2')   { pendingDraw += 2; }
  else if (card.value === 'wild4')   { pendingDraw += 4; }

  const hasDrawEffect = card.value === 'draw2' || card.value === 'wild4';
  const nextIndex = hasDrawEffect
    ? getNextPlayerIndex(playerIndex, newDirection, gs.players.length)
    : getNextPlayerIndex(playerIndex, newDirection, gs.players.length, skipNext);

  const newPlayers = gs.players.map((p, i) =>
    i === playerIndex ? { ...p, hand: newHand } : p
  );

  room.gameState = {
    ...gs, players: newPlayers,
    discardPile: [...gs.discardPile, card],
    currentColor: newColor, direction: newDirection,
    currentPlayerIndex: nextIndex,
    pendingDraw: hasDrawEffect ? pendingDraw : 0,
  };

  // UNO check
  if (newHand.length === 1) {
    room.unoPendingId = player.id;
    room.unoDeadline  = Date.now() + UNO_WINDOW_MS;
  } else if (room.unoPendingId === player.id) {
    room.unoPendingId = null; room.unoDeadline = null;
  }

  // Winner
  if (newHand.length === 0) {
    const points = gs.players.filter(p => p.id !== player.id)
      .reduce((s, p) => s + calculateHandScore(p.hand), 0);
    room.gameState.scores = { ...room.gameState.scores, [player.id]: (room.gameState.scores[player.id] ?? 0) + points };
    room.gameState.phase  = 'round-end';
    room.phase            = 'finished';
    return null;
  }

  setTurnStart(room);
  return null;
}

// ─── Main action dispatcher ───────────────────────────────────────────────────

export function performAction(roomId: string, action: RoomAction): Room | { error: string } {
  const room = store.get(roomId);
  if (!room) return { error: 'Room not found' };

  const rp = room.players.find(p => p.id === action.playerId);
  if (rp) rp.lastSeen = Date.now();

  switch (action.type) {

    // ── Lobby ──────────────────────────────────────────────────────────────
    case 'join': {
      if (room.phase !== 'waiting') {
        // Allow rejoining in-progress game if player is already a member
        const existing = room.gameState?.players.find(p => p.id === action.playerId);
        if (existing) {
          const existingRoom = room.players.find(p => p.id === action.playerId);
          if (existingRoom) { existingRoom.lastSeen = Date.now(); return room; }
        }
        return { error: 'Game already started' };
      }
      const existing = room.players.find(p => p.id === action.playerId);
      if (existing) { existing.lastSeen = Date.now(); return room; }
      if (room.players.filter(p => !p.isBot).length >= MAX_PLAYERS) return { error: 'Room is full' };
      const isFirst = room.players.length === 0;
      room.players.push({ id: action.playerId, name: action.playerName, isHost: isFirst, isBot: false, lastSeen: Date.now() });
      if (isFirst) room.hostId = action.playerId;
      return room;
    }

    case 'leave': {
      room.players = room.players.filter(p => p.id !== action.playerId);
      room.afkPlayerIds = room.afkPlayerIds.filter(id => id !== action.playerId);
      if (room.hostId === action.playerId) {
        const next = room.players.find(p => !p.isBot);
        if (next) { next.isHost = true; room.hostId = next.id; }
        else room.hostId = null;
      }
      if (room.players.filter(p => !p.isBot).length === 0) {
        Object.assign(room, emptyRoom(room.id, room.name));
      }
      return room;
    }

    case 'add-bot': {
      if (room.hostId !== action.playerId) return { error: 'Not host' };
      if (room.phase !== 'waiting') return { error: 'Game started' };
      if (room.players.length >= MAX_PLAYERS) return { error: 'Room full' };
      const botCount = room.players.filter(p => p.isBot).length;
      room.players.push({
        id: `bot-${Date.now()}-${botCount}`,
        name: BOT_NAMES[botCount % BOT_NAMES.length],
        isHost: false, isBot: true,
        botDifficulty: action.difficulty, lastSeen: Date.now(),
      });
      return room;
    }

    case 'remove-bot': {
      if (room.hostId !== action.playerId) return { error: 'Not host' };
      const bot = room.players.find(p => p.id === action.botId);
      if (!bot?.isBot) return { error: 'Not a bot' };
      room.players = room.players.filter(p => p.id !== action.botId);
      return room;
    }

    case 'start': {
      if (room.hostId !== action.playerId) return { error: 'Not host' };
      if (room.players.length < 2) return { error: 'Need at least 2 players' };
      if (room.phase !== 'waiting') {
        // Allow host to restart a finished game
        if (room.phase !== 'finished') return { error: 'Already in progress' };
        // Reset game state for replay
        room.gameState    = null;
        room.phase        = 'waiting';
        room.afkPlayerIds = [];
      }
      const settings: GameSettings = {
        pointsToWin: 500, stackingEnabled: true, jumpInEnabled: false,
        sevenZeroEnabled: false, turnTimer: 30, forcePlay: false,
      };
      const playersData = room.players.map(p => ({
        id: p.id, name: p.name,
        avatar: p.isBot ? (p.botDifficulty === 'hard' ? '🧠' : p.botDifficulty === 'medium' ? '🦾' : '🤖') : '👤',
        isBot: p.isBot, botDifficulty: p.botDifficulty,
      }));
      room.gameState = initializeGame(room.id, playersData, settings);
      room.phase     = 'playing';
      setTurnStart(room);
      return room;
    }

    // ── Gameplay ──────────────────────────────────────────────────────────
    case 'play-card': {
      if (!room.gameState || room.phase !== 'playing') return { error: 'Not playing' };
      const gs = room.gameState;
      const pi = gs.currentPlayerIndex;
      if (gs.players[pi].id !== action.playerId) return { error: 'Not your turn' };
      const card = gs.players[pi].hand.find(c => c.id === action.cardId);
      if (!card) return { error: 'Card not in hand' };
      const top = gs.discardPile[gs.discardPile.length - 1];
      if (!canPlayCard(card, top, gs.currentColor, gs.pendingDraw, gs.settings.stackingEnabled))
        return { error: 'Cannot play this card' };
      const err = applyPlayCard(room, pi, card, action.chosenColor);
      return err ? { error: err } : room;
    }

    case 'draw-card': {
      if (!room.gameState || room.phase !== 'playing') return { error: 'Not playing' };
      const gs = room.gameState;
      const pi = gs.currentPlayerIndex;
      if (gs.players[pi].id !== action.playerId) return { error: 'Not your turn' };
      if (room.drawnThisTurn && gs.pendingDraw === 0) return { error: 'Already drew' };

      let { drawPile, discardPile } = gs;
      if (drawPile.length === 0) { const r = reshuffleDeck(drawPile, discardPile); drawPile = r.drawPile; discardPile = r.discardPile; }

      const count = gs.pendingDraw > 0 ? gs.pendingDraw : 1;
      const drawn = drawPile.slice(0, count);
      const newPlayers = gs.players.map((p, i) => i === pi ? { ...p, hand: [...p.hand, ...drawn] } : p);

      if (gs.pendingDraw > 0) {
        const next = getNextPlayerIndex(pi, gs.direction, gs.players.length);
        room.gameState = { ...gs, players: newPlayers, drawPile: drawPile.slice(count), discardPile, currentPlayerIndex: next, pendingDraw: 0 };
        setTurnStart(room);
      } else {
        room.gameState = { ...gs, players: newPlayers, drawPile: drawPile.slice(count), discardPile };
        room.drawnThisTurn = true;
      }
      return room;
    }

    case 'skip-turn': {
      if (!room.gameState || room.phase !== 'playing') return { error: 'Not playing' };
      const gs = room.gameState;
      if (gs.players[gs.currentPlayerIndex].id !== action.playerId) return { error: 'Not your turn' };
      if (!room.drawnThisTurn) return { error: 'Must draw first' };
      const next = getNextPlayerIndex(gs.currentPlayerIndex, gs.direction, gs.players.length);
      room.gameState = { ...gs, currentPlayerIndex: next };
      setTurnStart(room);
      return room;
    }

    case 'call-uno': {
      if (!room.gameState) return { error: 'Not playing' };
      const gs = room.gameState;
      room.gameState = { ...gs, players: gs.players.map(p => p.id === action.playerId ? { ...p, hasCalledUno: true } : p) };
      if (room.unoPendingId === action.playerId) { room.unoPendingId = null; room.unoDeadline = null; }
      return room;
    }

    case 'timeout': {
      if (!room.gameState || room.phase !== 'playing') return { error: 'Not playing' };
      const gs = room.gameState;
      if (gs.currentPlayerIndex !== action.turnIndex) return { error: 'Stale turn' };
      if (Date.now() - room.turnStartTime < TURN_TIMEOUT_MS) return { error: 'Not timed out yet' };

      const currentId = gs.players[gs.currentPlayerIndex].id;

      // Mark as AFK (if it's a human player who missed their turn)
      const rp2 = room.players.find(p => p.id === currentId);
      if (!rp2?.isBot && !room.afkPlayerIds.includes(currentId)) {
        room.afkPlayerIds.push(currentId);
      }

      // Draw 1 card and advance turn
      let { drawPile, discardPile } = gs;
      if (drawPile.length === 0) { const r = reshuffleDeck(drawPile, discardPile); drawPile = r.drawPile; discardPile = r.discardPile; }
      const drawn = drawPile.slice(0, 1);
      const newPlayers = gs.players.map((p, i) => i === gs.currentPlayerIndex ? { ...p, hand: [...p.hand, ...drawn] } : p);
      const next = getNextPlayerIndex(gs.currentPlayerIndex, gs.direction, gs.players.length);
      room.gameState = { ...gs, players: newPlayers, drawPile: drawPile.slice(1), discardPile, currentPlayerIndex: next, pendingDraw: 0 };
      setTurnStart(room);
      return room;
    }

    case 'bot-move': {
      if (!room.gameState || room.phase !== 'playing') return { error: 'Not playing' };
      const gs = room.gameState;
      if (gs.currentPlayerIndex !== action.turnIndex) return { error: 'Stale turn' };
      if (!room.botMoveAfter || Date.now() < room.botMoveAfter) return { error: 'Not ready yet' };

      const currentId = gs.players[gs.currentPlayerIndex].id;
      if (!isAutoPlay(room, currentId)) return { error: 'Not a bot/AFK turn' };

      // Lock to prevent duplicate execution
      room.botMoveAfter = null;

      const botRoomPlayer = room.players.find(p => p.id === currentId);
      const diff = botRoomPlayer?.isBot ? (botRoomPlayer.botDifficulty ?? 'medium') : 'medium';

      const top = gs.discardPile[gs.discardPile.length - 1];
      const { card, chosenColor } = botSelectCard(
        gs.players[gs.currentPlayerIndex].hand, top, gs.currentColor, gs.pendingDraw, diff,
        gs.settings, { playerCardCounts: gs.players.map(p => p.hand.length), direction: gs.direction, currentPlayerIndex: gs.currentPlayerIndex }
      );

      if (card) {
        const err = applyPlayCard(room, gs.currentPlayerIndex, card, chosenColor);
        // Auto-clear UNO pending for bots / AFK
        if (!err && room.unoPendingId === currentId) { room.unoPendingId = null; room.unoDeadline = null; }
        return err ? { error: err } : room;
      } else {
        const drawResult = performAction(roomId, { type: 'draw-card', playerId: currentId });
        if ('error' in drawResult) return drawResult;
        if (room.drawnThisTurn) return performAction(roomId, { type: 'skip-turn', playerId: currentId });
        return room;
      }
    }

    case 'uno-penalty': {
      if (!room.gameState) return { error: 'Not playing' };
      if (!room.unoDeadline || Date.now() < room.unoDeadline) return { error: 'UNO window still open' };
      if (room.unoPendingId !== action.targetId) return { error: 'Wrong target' };
      const gs = room.gameState;
      let { drawPile, discardPile } = gs;
      if (drawPile.length < 2) { const r = reshuffleDeck(drawPile, discardPile); drawPile = r.drawPile; discardPile = r.discardPile; }
      const drawn = drawPile.slice(0, 2);
      room.gameState = { ...gs, players: gs.players.map(p => p.id === action.targetId ? { ...p, hand: [...p.hand, ...drawn] } : p), drawPile: drawPile.slice(2), discardPile };
      room.unoPendingId = null; room.unoDeadline = null;
      return room;
    }

    case 'return': {
      // Player coming back from AFK
      room.afkPlayerIds = room.afkPlayerIds.filter(id => id !== action.playerId);
      // If it's currently their turn, cancel the bot timer so they can play
      if (room.gameState) {
        const currentId = room.gameState.players[room.gameState.currentPlayerIndex]?.id;
        if (currentId === action.playerId) {
          room.botMoveAfter  = null;
          room.turnStartTime = Date.now(); // reset timer for fairness
        }
      }
      return room;
    }

    default:
      return { error: 'Unknown action' };
  }
}
