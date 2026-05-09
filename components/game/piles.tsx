'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { UnoCard } from './uno-card';
import type { UnoCard as UnoCardType, CardColor } from '@/types/uno';

const COLOR_MAP: Record<Exclude<CardColor, 'wild'>, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
};

interface DiscardPileProps {
  topCard?: UnoCardType;
  currentColor?: Exclude<CardColor, 'wild'>;
  lastPlayedBy?: string;
  className?: string;
}

export function DiscardPile({
  topCard,
  currentColor = 'red',
  lastPlayedBy,
  className,
}: DiscardPileProps) {
  return (
    <div className={cn('relative', className)}>
      {/* Pile base shadow */}
      <div className="absolute inset-0 bg-black/30 rounded-xl blur-lg" />
      
      {/* Stack effect - previous cards */}
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-xl bg-black/20"
          style={{
            width: 80,
            height: 120,
            top: -i * 2 - 4,
            left: i * 1,
            transform: `rotate(${(i - 1) * 5}deg)`,
            zIndex: i,
          }}
        />
      ))}
      
      {/* Top card */}
      <AnimatePresence mode="popLayout">
        {topCard && (
          <motion.div
            key={topCard.id}
            initial={{ 
              scale: 0.5, 
              y: -100, 
              rotate: Math.random() * 20 - 10,
              opacity: 0 
            }}
            animate={{ 
              scale: 1, 
              y: 0, 
              rotate: Math.random() * 10 - 5,
              opacity: 1 
            }}
            exit={{ 
              scale: 0.8, 
              opacity: 0 
            }}
            transition={{ 
              type: 'spring', 
              stiffness: 400, 
              damping: 25 
            }}
            style={{ zIndex: 10 }}
          >
            <UnoCard card={topCard} size="md" />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Current color indicator (for wild cards) */}
      {topCard?.color === 'wild' && currentColor && (
        <motion.div
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-white text-xs font-bold shadow-lg"
          style={{ backgroundColor: COLOR_MAP[currentColor] }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500 }}
        >
          {currentColor.toUpperCase()}
        </motion.div>
      )}
      
      {/* Last played by indicator */}
      {lastPlayedBy && (
        <motion.div
          className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground whitespace-nowrap"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {lastPlayedBy}
        </motion.div>
      )}
    </div>
  );
}

interface DrawPileProps {
  cardCount: number;
  canDraw?: boolean;
  pendingDraw?: number;
  onDraw?: () => void;
  className?: string;
}

export function DrawPile({
  cardCount,
  canDraw = false,
  pendingDraw = 0,
  onDraw,
  className,
}: DrawPileProps) {
  return (
    <motion.div 
      className={cn(
        'relative cursor-pointer',
        !canDraw && 'cursor-not-allowed opacity-70',
        className
      )}
      onClick={canDraw ? onDraw : undefined}
      whileHover={canDraw ? { scale: 1.05 } : {}}
      whileTap={canDraw ? { scale: 0.95 } : {}}
    >
      {/* Stack of cards */}
      {[...Array(Math.min(cardCount, 5))].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-xl overflow-hidden uno-card-shadow"
          style={{
            width: 80,
            height: 120,
            top: -i * 2,
            left: i * 1,
            zIndex: i,
          }}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: i * 0.05 }}
        >
          {/* Card back design */}
          <div className="absolute inset-0 bg-black" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className="w-[70%] h-[50%] rotate-45 rounded-sm"
              style={{
                background: 'linear-gradient(135deg, #ef4444 25%, #3b82f6 25%, #3b82f6 50%, #22c55e 50%, #22c55e 75%, #eab308 75%)',
              }}
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white font-black text-lg italic tracking-tighter drop-shadow-lg">
              UNO
            </span>
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
        </motion.div>
      ))}
      
      {/* Card count badge */}
      <motion.div 
        className="absolute -bottom-3 -right-3 bg-secondary text-secondary-foreground rounded-full min-w-[28px] h-7 flex items-center justify-center text-sm font-bold shadow-lg z-20 px-2"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 0.2 }}
      >
        {cardCount}
      </motion.div>
      
      {/* Pending draw indicator */}
      {pendingDraw > 0 && (
        <motion.div
          className="absolute -top-4 left-1/2 -translate-x-1/2 bg-destructive text-white rounded-full px-3 py-1 text-sm font-bold shadow-lg z-20"
          initial={{ scale: 0, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 500 }}
        >
          +{pendingDraw}
        </motion.div>
      )}
      
      {/* Draw prompt */}
      {canDraw && (
        <motion.div
          className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-xs text-primary font-medium whitespace-nowrap"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          Click to draw
        </motion.div>
      )}
    </motion.div>
  );
}

// Color picker modal for wild cards
interface ColorPickerProps {
  isOpen: boolean;
  onColorSelect: (color: Exclude<CardColor, 'wild'>) => void;
}

export function ColorPicker({ isOpen, onColorSelect }: ColorPickerProps) {
  const colors: Exclude<CardColor, 'wild'>[] = ['red', 'blue', 'green', 'yellow'];
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="glass-strong rounded-2xl p-6"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <h3 className="text-white text-xl font-bold text-center mb-4">
              Choose a Color
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {colors.map((color) => (
                <motion.button
                  key={color}
                  className="w-20 h-20 rounded-xl shadow-lg transition-transform"
                  style={{ backgroundColor: COLOR_MAP[color] }}
                  onClick={() => onColorSelect(color)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="sr-only">{color}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
