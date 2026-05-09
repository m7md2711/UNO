export type CardColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild';

export type CardValue = 
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'skip' | 'reverse' | 'draw2'
  | 'wild' | 'wild4';

export interface UnoCard {
  id: string;
  color: CardColor;
  value: CardValue;
}

export type GamePhase = 'waiting' | 'playing' | 'choosing-color' | 'round-end' | 'game-end';

export interface Player {
  id: string;
  name: string;
  avatar?: string;
  hand: UnoCard[];
  score: number;
  isReady: boolean;
  isConnected: boolean;
  hasCalledUno: boolean;
}

export interface GameSettings {
  pointsToWin: number;
  stackingEnabled: boolean;
  jumpInEnabled: boolean;
  sevenZeroEnabled: boolean;
  turnTimer: number;
  forcePlay: boolean;
}

export interface GameState {
  roomId: string;
  roomCode: string;
  players: Player[];
  currentPlayerIndex: number;
  direction: 1 | -1;
  drawPile: UnoCard[];
  discardPile: UnoCard[];
  currentColor: Exclude<CardColor, 'wild'>;
  pendingDraw: number;
  phase: GamePhase;
  winner?: string;
  roundNumber: number;
  scores: Record<string, number>;
  settings: GameSettings;
  hostId: string;
  turnStartTime?: number;
}

export const CARD_COLORS: CardColor[] = ['red', 'blue', 'green', 'yellow'];

export const CARD_COLOR_MAP: Record<CardColor, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  wild: 'linear-gradient(135deg, #ef4444 25%, #3b82f6 25%, #3b82f6 50%, #22c55e 50%, #22c55e 75%, #eab308 75%)',
};

export const CARD_SYMBOLS: Record<CardValue, string> = {
  '0': '0',
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  skip: '⊘',
  reverse: '⟲',
  draw2: '+2',
  wild: '★',
  wild4: '+4',
};

export const CARD_POINTS: Record<CardValue, number> = {
  '0': 0,
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  skip: 20,
  reverse: 20,
  draw2: 20,
  wild: 50,
  wild4: 50,
};
