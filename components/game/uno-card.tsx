'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { UnoCard as UnoCardType, CardColor, CardValue, CARD_COLOR_MAP, CARD_SYMBOLS } from '@/types/uno';

const CARD_COLORS: Record<CardColor, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  yellow: '#eab308',
  wild: '',
};

const SYMBOLS: Record<CardValue, string> = {
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

interface UnoCardProps {
  card: UnoCardType;
  size?: 'sm' | 'md' | 'lg';
  faceDown?: boolean;
  disabled?: boolean;
  selected?: boolean;
  colorblindMode?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const sizeConfig = {
  sm: { width: 60, height: 90, fontSize: 'text-xl', cornerSize: 'text-[10px]' },
  md: { width: 80, height: 120, fontSize: 'text-3xl', cornerSize: 'text-xs' },
  lg: { width: 120, height: 180, fontSize: 'text-5xl', cornerSize: 'text-sm' },
};

// Colorblind patterns for each color
const colorblindPatterns: Record<Exclude<CardColor, 'wild'>, string> = {
  red: '●', // Circle
  blue: '◆', // Diamond
  green: '▲', // Triangle
  yellow: '■', // Square
};

export function UnoCard({
  card,
  size = 'md',
  faceDown = false,
  disabled = false,
  selected = false,
  colorblindMode = false,
  onClick,
  className,
  style,
}: UnoCardProps) {
  const { width, height, fontSize, cornerSize } = sizeConfig[size];
  const isWild = card.color === 'wild';
  const cardColor = CARD_COLORS[card.color];
  const symbol = SYMBOLS[card.value];
  
  return (
    <motion.div
      className={cn(
        'relative cursor-pointer select-none',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
      style={{ width, height, ...style }}
      onClick={disabled ? undefined : onClick}
      whileHover={disabled ? {} : { y: -20, scale: 1.05 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        y: selected ? -30 : 0,
      }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {faceDown ? (
        <CardBack width={width} height={height} />
      ) : (
        <CardFace
          card={card}
          width={width}
          height={height}
          fontSize={fontSize}
          cornerSize={cornerSize}
          isWild={isWild}
          cardColor={cardColor}
          symbol={symbol}
          colorblindMode={colorblindMode}
        />
      )}
    </motion.div>
  );
}

function CardBack({ width, height }: { width: number; height: number }) {
  return (
    <div
      className="relative rounded-xl overflow-hidden uno-card-shadow"
      style={{ width, height }}
    >
      {/* Black background */}
      <div className="absolute inset-0 bg-black" />
      
      {/* Multi-color diamond pattern */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div 
          className="w-[70%] h-[50%] rotate-45"
          style={{
            background: 'linear-gradient(135deg, #ef4444 25%, #3b82f6 25%, #3b82f6 50%, #22c55e 50%, #22c55e 75%, #eab308 75%)',
          }}
        />
      </div>
      
      {/* UNO text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-white font-black text-xl italic tracking-tighter drop-shadow-lg">
          UNO
        </span>
      </div>
      
      {/* Subtle shine effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent" />
    </div>
  );
}

function CardFace({
  card,
  width,
  height,
  fontSize,
  cornerSize,
  isWild,
  cardColor,
  symbol,
  colorblindMode,
}: {
  card: UnoCardType;
  width: number;
  height: number;
  fontSize: string;
  cornerSize: string;
  isWild: boolean;
  cardColor: string;
  symbol: string;
  colorblindMode: boolean;
}) {
  const colorblindSymbol = !isWild && colorblindMode ? colorblindPatterns[card.color as Exclude<CardColor, 'wild'>] : null;
  
  return (
    <div
      className="relative rounded-xl overflow-hidden uno-card-shadow hover:uno-card-hover-shadow transition-shadow duration-200"
      style={{ width, height }}
    >
      {/* Card background - black border effect */}
      <div className="absolute inset-0 bg-black" />
      
      {/* Colored area with slight inset */}
      <div 
        className="absolute inset-[3px] rounded-lg"
        style={{ 
          background: isWild 
            ? 'linear-gradient(135deg, #ef4444 25%, #3b82f6 25%, #3b82f6 50%, #22c55e 50%, #22c55e 75%, #eab308 75%)'
            : cardColor 
        }}
      />
      
      {/* White diamond in center */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div 
          className="bg-white rotate-45 shadow-lg"
          style={{ 
            width: width * 0.55, 
            height: height * 0.45,
            borderRadius: width * 0.08,
          }}
        />
      </div>
      
      {/* Center symbol */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span 
          className={cn(fontSize, 'font-black italic drop-shadow-md')}
          style={{ color: isWild ? '#000' : cardColor }}
        >
          {symbol}
        </span>
      </div>
      
      {/* Top-left corner */}
      <div className="absolute top-2 left-2 flex flex-col items-center">
        <span className={cn(cornerSize, 'font-bold text-white drop-shadow-md')}>
          {symbol}
        </span>
        {colorblindSymbol && (
          <span className={cn(cornerSize, 'text-white/80')}>
            {colorblindSymbol}
          </span>
        )}
      </div>
      
      {/* Bottom-right corner (rotated) */}
      <div className="absolute bottom-2 right-2 flex flex-col items-center rotate-180">
        <span className={cn(cornerSize, 'font-bold text-white drop-shadow-md')}>
          {symbol}
        </span>
        {colorblindSymbol && (
          <span className={cn(cornerSize, 'text-white/80')}>
            {colorblindSymbol}
          </span>
        )}
      </div>
      
      {/* Shine effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none" />
    </div>
  );
}

export function CardStack({ count, className }: { count: number; className?: string }) {
  return (
    <div className={cn('relative', className)} style={{ width: 80, height: 120 }}>
      {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-xl overflow-hidden uno-card-shadow"
          style={{
            width: 80,
            height: 120,
            top: -i * 2,
            left: i * 1,
            zIndex: i,
          }}
        >
          <CardBack width={80} height={120} />
        </div>
      ))}
      {count > 0 && (
        <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow-lg z-10">
          {count}
        </div>
      )}
    </div>
  );
}
