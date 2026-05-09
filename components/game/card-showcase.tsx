'use client';

import { motion } from 'framer-motion';
import { UnoCard } from './uno-card';
import type { UnoCard as UnoCardType } from '@/types/uno';

// Sample cards for showcase
const showcaseCards: UnoCardType[] = [
  { id: '1', color: 'red', value: '7' },
  { id: '2', color: 'blue', value: 'reverse' },
  { id: '3', color: 'green', value: '4' },
  { id: '4', color: 'wild', value: 'wild4' },
  { id: '5', color: 'yellow', value: 'skip' },
];

export function CardShowcase() {
  return (
    <div className="relative flex items-center justify-center py-8">
      {showcaseCards.map((card, index) => {
        const centerIndex = (showcaseCards.length - 1) / 2;
        const offset = index - centerIndex;
        const rotation = offset * 8;
        const xOffset = offset * 60;
        const yOffset = Math.abs(offset) * 10;
        
        return (
          <motion.div
            key={card.id}
            className="absolute"
            style={{
              zIndex: showcaseCards.length - Math.abs(offset),
            }}
            initial={{ 
              x: 0, 
              y: 200, 
              rotate: 0, 
              opacity: 0 
            }}
            animate={{ 
              x: xOffset, 
              y: yOffset, 
              rotate: rotation, 
              opacity: 1 
            }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 20,
              delay: index * 0.1,
            }}
            whileHover={{
              y: yOffset - 30,
              scale: 1.1,
              zIndex: 100,
              transition: { type: 'spring', stiffness: 400, damping: 25 }
            }}
          >
            <UnoCard card={card} size="lg" />
          </motion.div>
        );
      })}
    </div>
  );
}

// Floating decorative cards for background
export function FloatingCards() {
  const floatingCards: UnoCardType[] = [
    { id: 'f1', color: 'red', value: '2' },
    { id: 'f2', color: 'blue', value: '8' },
    { id: 'f3', color: 'green', value: 'draw2' },
    { id: 'f4', color: 'yellow', value: '5' },
    { id: 'f5', color: 'wild', value: 'wild' },
    { id: 'f6', color: 'red', value: 'reverse' },
    { id: 'f7', color: 'blue', value: '3' },
    { id: 'f8', color: 'green', value: '9' },
  ];
  
  const positions = [
    { x: '5%', y: '10%', rotate: -15 },
    { x: '85%', y: '15%', rotate: 20 },
    { x: '10%', y: '75%', rotate: 12 },
    { x: '90%', y: '70%', rotate: -18 },
    { x: '15%', y: '40%', rotate: -8 },
    { x: '80%', y: '45%', rotate: 15 },
    { x: '3%', y: '55%', rotate: 25 },
    { x: '95%', y: '30%', rotate: -22 },
  ];
  
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {floatingCards.map((card, index) => (
        <motion.div
          key={card.id}
          className="absolute opacity-20"
          style={{
            left: positions[index].x,
            top: positions[index].y,
          }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ 
            opacity: 0.15, 
            scale: 1,
            y: [0, -20, 0],
            rotate: [positions[index].rotate, positions[index].rotate + 5, positions[index].rotate],
          }}
          transition={{
            opacity: { duration: 1, delay: index * 0.2 },
            scale: { duration: 1, delay: index * 0.2 },
            y: { 
              repeat: Infinity, 
              duration: 4 + index * 0.5, 
              ease: 'easeInOut' 
            },
            rotate: {
              repeat: Infinity,
              duration: 6 + index * 0.5,
              ease: 'easeInOut',
            },
          }}
        >
          <UnoCard card={card} size="md" />
        </motion.div>
      ))}
    </div>
  );
}
