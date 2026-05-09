import type { UnoCard, CardColor, CardValue, GameState, Player, GameSettings, CARD_POINTS } from '@/types/uno';

// Card point values for scoring
const CARD_POINTS: Record<CardValue, number> = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  skip: 20, reverse: 20, draw2: 20, wild: 50, wild4: 50,
};

// Generate unique ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Create a standard UNO deck (108 cards)
export function createDeck(): UnoCard[] {
  const deck: UnoCard[] = [];
  const colors: CardColor[] = ['red', 'blue', 'green', 'yellow'];
  
  // Number cards (0-9) for each color
  // One 0 per color, two of each 1-9
  colors.forEach(color => {
    // One 0
    deck.push({ id: generateId(), color, value: '0' });
    // Two of each 1-9
    for (let i = 1; i <= 9; i++) {
      deck.push({ id: generateId(), color, value: i.toString() as CardValue });
      deck.push({ id: generateId(), color, value: i.toString() as CardValue });
    }
    // Two Skip, Reverse, Draw Two per color
    for (let i = 0; i < 2; i++) {
      deck.push({ id: generateId(), color, value: 'skip' });
      deck.push({ id: generateId(), color, value: 'reverse' });
      deck.push({ id: generateId(), color, value: 'draw2' });
    }
  });
  
  // Wild cards (4 of each)
  for (let i = 0; i < 4; i++) {
    deck.push({ id: generateId(), color: 'wild', value: 'wild' });
    deck.push({ id: generateId(), color: 'wild', value: 'wild4' });
  }
  
  return deck;
}

// Fisher-Yates shuffle
export function shuffleDeck(deck: UnoCard[]): UnoCard[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Deal cards to players
export function dealCards(deck: UnoCard[], playerCount: number, cardsPerPlayer: number = 7): { hands: UnoCard[][]; remainingDeck: UnoCard[] } {
  const hands: UnoCard[][] = Array.from({ length: playerCount }, () => []);
  let deckIndex = 0;
  
  for (let i = 0; i < cardsPerPlayer; i++) {
    for (let p = 0; p < playerCount; p++) {
      hands[p].push(deck[deckIndex++]);
    }
  }
  
  return {
    hands,
    remainingDeck: deck.slice(deckIndex),
  };
}

// Check if a card can be played
export function canPlayCard(
  card: UnoCard, 
  topCard: UnoCard, 
  currentColor: Exclude<CardColor, 'wild'>,
  pendingDraw: number = 0,
  stackingEnabled: boolean = true
): boolean {
  // If there's a pending draw, only +2 or +4 can be played (if stacking enabled)
  if (pendingDraw > 0) {
    if (!stackingEnabled) return false;
    if (topCard.value === 'draw2') {
      return card.value === 'draw2' || card.value === 'wild4';
    }
    if (topCard.value === 'wild4') {
      return card.value === 'wild4';
    }
  }
  
  // Wild cards can always be played
  if (card.color === 'wild') return true;
  
  // Match by color
  if (card.color === currentColor) return true;
  
  // Match by value (number or action)
  if (card.value === topCard.value) return true;
  
  return false;
}

// Get all playable cards from a hand
export function getPlayableCards(
  hand: UnoCard[],
  topCard: UnoCard,
  currentColor: Exclude<CardColor, 'wild'>,
  pendingDraw: number = 0,
  stackingEnabled: boolean = true
): UnoCard[] {
  return hand.filter(card => canPlayCard(card, topCard, currentColor, pendingDraw, stackingEnabled));
}

// Calculate next player index
export function getNextPlayerIndex(
  currentIndex: number,
  direction: 1 | -1,
  playerCount: number,
  skip: boolean = false
): number {
  let next = (currentIndex + direction + playerCount) % playerCount;
  if (skip) {
    next = (next + direction + playerCount) % playerCount;
  }
  return next;
}

// Calculate score for a hand (used when round ends)
export function calculateHandScore(hand: UnoCard[]): number {
  return hand.reduce((sum, card) => sum + CARD_POINTS[card.value], 0);
}

// Check if the deck needs reshuffling
export function reshuffleDeck(drawPile: UnoCard[], discardPile: UnoCard[]): { drawPile: UnoCard[]; discardPile: UnoCard[] } {
  if (drawPile.length > 0) return { drawPile, discardPile };
  
  // Keep the top card, shuffle the rest back
  const topCard = discardPile[discardPile.length - 1];
  const cardsToShuffle = discardPile.slice(0, -1);
  
  return {
    drawPile: shuffleDeck(cardsToShuffle),
    discardPile: [topCard],
  };
}

// Bot AI - select best card to play
export type BotDifficulty = 'easy' | 'medium' | 'hard';

export function botSelectCard(
  hand: UnoCard[],
  topCard: UnoCard,
  currentColor: Exclude<CardColor, 'wild'>,
  pendingDraw: number,
  difficulty: BotDifficulty,
  settings: GameSettings,
  gameContext?: {
    playerCardCounts: number[];
    direction: 1 | -1;
    currentPlayerIndex: number;
  }
): { card: UnoCard | null; chosenColor?: Exclude<CardColor, 'wild'> } {
  const playable = getPlayableCards(hand, topCard, currentColor, pendingDraw, settings.stackingEnabled);
  
  if (playable.length === 0) {
    return { card: null };
  }
  
  let selectedCard: UnoCard;
  let chosenColor: Exclude<CardColor, 'wild'> | undefined;
  
  // All difficulty levels now use smart selection, but with different randomness factors
  const scoredCards = scorePlayableCards(playable, hand, topCard, currentColor, gameContext);
  
  switch (difficulty) {
    case 'easy':
      // Pick randomly from top 50% of scored cards (still makes decent choices)
      const easyPool = scoredCards.slice(0, Math.max(1, Math.ceil(scoredCards.length * 0.5)));
      selectedCard = easyPool[Math.floor(Math.random() * easyPool.length)].card;
      break;
      
    case 'medium':
      // Pick randomly from top 2 choices (good but not perfect)
      const mediumPool = scoredCards.slice(0, Math.min(2, scoredCards.length));
      selectedCard = mediumPool[Math.floor(Math.random() * mediumPool.length)].card;
      break;
      
    case 'hard':
      // Always pick the best card
      selectedCard = scoredCards[0].card;
      break;
      
    default:
      selectedCard = scoredCards[0].card;
  }
  
  // Choose color for wild cards - always pick best color
  if (selectedCard.color === 'wild') {
    chosenColor = chooseBestColor(hand, difficulty);
  }
  
  return { card: selectedCard, chosenColor };
}

// Score all playable cards and return sorted by best choice
function scorePlayableCards(
  playable: UnoCard[],
  hand: UnoCard[],
  topCard: UnoCard,
  currentColor: Exclude<CardColor, 'wild'>,
  gameContext?: {
    playerCardCounts: number[];
    direction: 1 | -1;
    currentPlayerIndex: number;
  }
): Array<{ card: UnoCard; score: number }> {
  // Count cards of each color in hand (excluding wilds)
  const colorCounts: Record<Exclude<CardColor, 'wild'>, number> = {
    red: 0, blue: 0, green: 0, yellow: 0
  };
  hand.forEach(c => {
    if (c.color !== 'wild') {
      colorCounts[c.color]++;
    }
  });
  
  // Find the most common color
  const mostCommonColor = (['red', 'blue', 'green', 'yellow'] as Exclude<CardColor, 'wild'>[])
    .reduce((best, color) => colorCounts[color] > colorCounts[best] ? color : best);
  
  // Check if next player is close to winning
  let nextPlayerDanger = false;
  if (gameContext) {
    const nextPlayerIndex = getNextPlayerIndex(
      gameContext.currentPlayerIndex,
      gameContext.direction,
      gameContext.playerCardCounts.length
    );
    nextPlayerDanger = gameContext.playerCardCounts[nextPlayerIndex] <= 2;
  }
  
  const scored = playable.map(card => {
    let score = 0;
    
    // Priority 1: If next player is in danger, play attack cards
    if (nextPlayerDanger) {
      if (card.value === 'wild4') score += 100;
      if (card.value === 'draw2') score += 90;
      if (card.value === 'skip') score += 80;
      if (card.value === 'reverse') score += 70;
    }
    
    // Priority 2: Get rid of high point value cards
    const pointValue = CARD_POINTS[card.value];
    score += pointValue * 2; // Higher point cards are prioritized
    
    // Priority 3: Play cards that match our most common color (sets up future plays)
    if (card.color === mostCommonColor) {
      score += 30;
    }
    
    // Priority 4: Prefer non-wild cards (save wilds for when we need them)
    if (card.color === 'wild') {
      score -= 40; // Penalty for using wilds early
      // But if we have few cards, wilds become more valuable
      if (hand.length <= 3) {
        score += 20;
      }
    }
    
    // Priority 5: Play cards that change to our dominant color
    if (card.color !== 'wild' && card.color !== currentColor && card.color === mostCommonColor) {
      score += 25; // Bonus for changing to our best color
    }
    
    // Priority 6: If we're close to winning (2-3 cards), be more aggressive
    if (hand.length <= 3) {
      // Play high point cards first to minimize risk
      score += pointValue * 3;
    }
    
    // Slight randomness to make it less predictable
    score += Math.random() * 5;
    
    return { card, score };
  });
  
  // Sort by score descending (highest = best)
  return scored.sort((a, b) => b.score - a.score);
}

function chooseBestColor(hand: UnoCard[], difficulty: BotDifficulty): Exclude<CardColor, 'wild'> {
  const colors: Exclude<CardColor, 'wild'>[] = ['red', 'blue', 'green', 'yellow'];
  
  if (difficulty === 'easy') {
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  // Count cards of each color
  const colorCounts: Record<Exclude<CardColor, 'wild'>, number> = {
    red: 0, blue: 0, green: 0, yellow: 0
  };
  
  hand.forEach(card => {
    if (card.color !== 'wild') {
      colorCounts[card.color]++;
    }
  });
  
  // Return color with most cards
  return colors.reduce((best, color) => 
    colorCounts[color] > colorCounts[best] ? color : best
  );
}

// Bot decides whether to call UNO (slight delay for realism)
export function shouldBotCallUno(difficulty: BotDifficulty): boolean {
  switch (difficulty) {
    case 'easy':
      return Math.random() > 0.3; // 70% chance to remember
    case 'medium':
      return Math.random() > 0.1; // 90% chance
    case 'hard':
      return true; // Always remembers
    default:
      return true;
  }
}

// Initialize a new game
export function initializeGame(
  roomCode: string,
  players: Array<{ id: string; name: string; avatar?: string; isBot?: boolean; botDifficulty?: BotDifficulty }>,
  settings: GameSettings
): GameState {
  const deck = shuffleDeck(createDeck());
  const { hands, remainingDeck } = dealCards(deck, players.length);
  
  // Find first non-action card for starting
  let startingCardIndex = 0;
  for (let i = 0; i < remainingDeck.length; i++) {
    const card = remainingDeck[i];
    if (!['skip', 'reverse', 'draw2', 'wild', 'wild4'].includes(card.value)) {
      startingCardIndex = i;
      break;
    }
  }
  
  const startingCard = remainingDeck[startingCardIndex];
  const drawPile = [...remainingDeck.slice(0, startingCardIndex), ...remainingDeck.slice(startingCardIndex + 1)];
  
  const gamePlayers: Player[] = players.map((p, i) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    hand: hands[i],
    score: 0,
    isReady: true,
    isConnected: true,
    hasCalledUno: false,
  }));
  
  return {
    roomId: generateId(),
    roomCode,
    players: gamePlayers,
    currentPlayerIndex: 0,
    direction: 1,
    drawPile,
    discardPile: [startingCard],
    currentColor: startingCard.color as Exclude<CardColor, 'wild'>,
    pendingDraw: 0,
    phase: 'playing',
    roundNumber: 1,
    scores: Object.fromEntries(players.map(p => [p.id, 0])),
    settings,
    hostId: players[0].id,
  };
}
