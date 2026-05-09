'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { UnoCard } from './uno-card';
import type { UnoCard as UnoCardType } from '@/types/uno';

interface HandProps {
  cards: UnoCardType[];
  selectedCardId?: string;
  playableCardIds?: string[];
  colorblindMode?: boolean;
  isCurrentPlayer?: boolean;
  onCardClick?: (card: UnoCardType) => void;
  className?: string;
}

export function Hand({
  cards,
  selectedCardId,
  playableCardIds = [],
  colorblindMode = false,
  isCurrentPlayer = false,
  onCardClick,
  className,
}: HandProps) {
  const cardCount = cards.length;
  const maxRotation = Math.min(cardCount * 2, 30);
  const cardWidth = 80;
  const overlapFactor = Math.max(0.3, 1 - cardCount * 0.05);
  
  return (
    <motion.div 
      className={cn(
        'relative flex items-end justify-center',
        className
      )}
      style={{ 
        height: 180,
        minWidth: 200,
      }}
    >
      {cards.map((card, index) => {
        const centerIndex = (cardCount - 1) / 2;
        const offset = index - centerIndex;
        const rotation = (offset / centerIndex) * maxRotation || 0;
        const yOffset = Math.abs(offset) * 5;
        const isPlayable = playableCardIds.includes(card.id);
        const isSelected = card.id === selectedCardId;
        
        return (
          <motion.div
            key={card.id}
            className="absolute"
            style={{
              left: `calc(50% + ${offset * cardWidth * overlapFactor}px - ${cardWidth / 2}px)`,
              zIndex: isSelected ? 100 : index,
            }}
            initial={{ 
              rotate: 0, 
              y: 100, 
              opacity: 0 
            }}
            animate={{
              rotate: rotation,
              y: yOffset,
              opacity: 1,
            }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 25,
              delay: index * 0.05,
            }}
          >
            <UnoCard
              card={card}
              size="md"
              selected={isSelected}
              disabled={!isCurrentPlayer || !isPlayable}
              colorblindMode={colorblindMode}
              onClick={() => onCardClick?.(card)}
              className={cn(
                isPlayable && isCurrentPlayer && 'ring-2 ring-white/50',
                !isPlayable && isCurrentPlayer && 'opacity-60'
              )}
            />
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// Opponent hand (face-down cards)
interface OpponentHandProps {
  cardCount: number;
  position: 'top' | 'left' | 'right' | 'top-left' | 'top-right';
  playerName: string;
  isCurrentPlayer?: boolean;
  hasCalledUno?: boolean;
  className?: string;
}

export function OpponentHand({
  cardCount,
  position,
  playerName,
  isCurrentPlayer = false,
  hasCalledUno = false,
  className,
}: OpponentHandProps) {
  const isVertical = position === 'left' || position === 'right';
  const cardSize = 'sm';
  const maxCards = Math.min(cardCount, 10);
  
  return (
    <div 
      className={cn(
        'flex flex-col items-center gap-2',
        isVertical && 'flex-row',
        position === 'left' && 'flex-row-reverse',
        className
      )}
    >
      {/* Player info */}
      <div 
        className={cn(
          'glass rounded-lg px-3 py-2 flex items-center gap-2',
          isCurrentPlayer && 'ring-2 ring-primary animate-pulse-glow'
        )}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm">
          {playerName.charAt(0).toUpperCase()}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-white truncate max-w-[80px]">
            {playerName}
          </span>
          <span className="text-xs text-muted-foreground">
            {cardCount} cards
          </span>
        </div>
        {hasCalledUno && cardCount === 1 && (
          <motion.span 
            className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 0.5 }}
          >
            UNO!
          </motion.span>
        )}
      </div>
      
      {/* Cards */}
      <div 
        className={cn(
          'relative flex',
          isVertical ? 'flex-col -space-y-12' : '-space-x-8'
        )}
      >
        {Array.from({ length: maxCards }).map((_, index) => (
          <motion.div
            key={index}
            className="relative"
            style={{
              zIndex: index,
              transform: isVertical 
                ? `rotate(${90 * (position === 'left' ? -1 : 1)}deg)` 
                : undefined,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: index * 0.03 }}
          >
            <div 
              className="rounded-lg overflow-hidden uno-card-shadow"
              style={{ width: 45, height: 68 }}
            >
              <div className="absolute inset-0 bg-black" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div 
                  className="w-[70%] h-[50%] rotate-45"
                  style={{
                    background: 'linear-gradient(135deg, #ef4444 25%, #3b82f6 25%, #3b82f6 50%, #22c55e 50%, #22c55e 75%, #eab308 75%)',
                  }}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
