'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, Eye, EyeOff, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { 
  UnoCard, 
  Hand, 
  DiscardPile, 
  DrawPile, 
  ColorPicker 
} from '@/components/game';
import type { UnoCard as UnoCardType, CardColor } from '@/types/uno';

// Generate sample cards
const generateSampleHand = (): UnoCardType[] => [
  { id: '1', color: 'red', value: '7' },
  { id: '2', color: 'blue', value: '3' },
  { id: '3', color: 'green', value: 'skip' },
  { id: '4', color: 'yellow', value: '9' },
  { id: '5', color: 'wild', value: 'wild' },
  { id: '6', color: 'red', value: 'draw2' },
  { id: '7', color: 'blue', value: 'reverse' },
];

const allCardExamples: UnoCardType[] = [
  // Numbers
  { id: 'n1', color: 'red', value: '0' },
  { id: 'n2', color: 'blue', value: '5' },
  { id: 'n3', color: 'green', value: '9' },
  { id: 'n4', color: 'yellow', value: '2' },
  // Action cards
  { id: 'a1', color: 'red', value: 'skip' },
  { id: 'a2', color: 'blue', value: 'reverse' },
  { id: 'a3', color: 'green', value: 'draw2' },
  // Wild cards
  { id: 'w1', color: 'wild', value: 'wild' },
  { id: 'w2', color: 'wild', value: 'wild4' },
];

export default function DemoPage() {
  const [hand, setHand] = useState<UnoCardType[]>(generateSampleHand());
  const [selectedCard, setSelectedCard] = useState<string | undefined>();
  const [topCard, setTopCard] = useState<UnoCardType>({ id: 'top', color: 'red', value: '5' });
  const [currentColor, setCurrentColor] = useState<Exclude<CardColor, 'wild'>>('red');
  const [deckCount, setDeckCount] = useState(56);
  const [colorblindMode, setColorblindMode] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  const playableCardIds = hand
    .filter(card => 
      card.color === 'wild' || 
      card.color === currentColor || 
      card.value === topCard.value
    )
    .map(card => card.id);
  
  const handleCardClick = (card: UnoCardType) => {
    if (selectedCard === card.id) {
      // Play the card
      if (card.color === 'wild') {
        setShowColorPicker(true);
      }
      setTopCard(card);
      setHand(prev => prev.filter(c => c.id !== card.id));
      setSelectedCard(undefined);
      if (card.color !== 'wild') {
        setCurrentColor(card.color as Exclude<CardColor, 'wild'>);
      }
    } else {
      setSelectedCard(card.id);
    }
  };
  
  const handleDraw = () => {
    const colors: CardColor[] = ['red', 'blue', 'green', 'yellow'];
    const values = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'] as const;
    const newCard: UnoCardType = {
      id: `drawn-${Date.now()}`,
      color: colors[Math.floor(Math.random() * colors.length)],
      value: values[Math.floor(Math.random() * values.length)],
    };
    setHand(prev => [...prev, newCard]);
    setDeckCount(prev => prev - 1);
  };
  
  const handleColorSelect = (color: Exclude<CardColor, 'wild'>) => {
    setCurrentColor(color);
    setShowColorPicker(false);
  };
  
  const shuffleHand = () => {
    setHand(generateSampleHand());
    setSelectedCard(undefined);
  };
  
  return (
    <main className="min-h-screen gradient-bg p-4 md:p-8">
      {/* Header */}
      <header className="max-w-6xl mx-auto mb-8 flex items-center justify-between">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-white">Component Demo</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Colorblind Mode</span>
          <Switch 
            checked={colorblindMode} 
            onCheckedChange={setColorblindMode}
          />
        </div>
      </header>
      
      <div className="max-w-6xl mx-auto space-y-12">
        {/* All Card Types */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-6">All Card Types</h2>
          <div className="flex flex-wrap gap-4 justify-center">
            {allCardExamples.map((card) => (
              <UnoCard 
                key={card.id} 
                card={card} 
                size="md"
                colorblindMode={colorblindMode}
              />
            ))}
          </div>
        </section>
        
        {/* Card Sizes */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-6">Card Sizes</h2>
          <div className="flex items-end gap-8 justify-center">
            <div className="text-center">
              <UnoCard 
                card={{ id: 'sm', color: 'blue', value: '7' }} 
                size="sm"
                colorblindMode={colorblindMode}
              />
              <span className="text-sm text-muted-foreground mt-2 block">Small</span>
            </div>
            <div className="text-center">
              <UnoCard 
                card={{ id: 'md', color: 'green', value: 'reverse' }} 
                size="md"
                colorblindMode={colorblindMode}
              />
              <span className="text-sm text-muted-foreground mt-2 block">Medium</span>
            </div>
            <div className="text-center">
              <UnoCard 
                card={{ id: 'lg', color: 'red', value: 'draw2' }} 
                size="lg"
                colorblindMode={colorblindMode}
              />
              <span className="text-sm text-muted-foreground mt-2 block">Large</span>
            </div>
          </div>
        </section>
        
        {/* Interactive Game Area */}
        <section className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Interactive Demo</h2>
            <Button variant="secondary" size="sm" onClick={shuffleHand}>
              <Shuffle className="w-4 h-4 mr-2" />
              Reset Hand
            </Button>
          </div>
          
          <div className="text-center text-sm text-muted-foreground mb-4">
            Click a card to select it, click again to play. Playable cards have a glow.
          </div>
          
          {/* Game table simulation */}
          <div className="relative min-h-[400px] flex flex-col items-center justify-between py-8">
            {/* Center area - piles */}
            <div className="flex items-center gap-8 mb-8">
              <DrawPile 
                cardCount={deckCount}
                canDraw={true}
                onDraw={handleDraw}
              />
              <DiscardPile 
                topCard={topCard}
                currentColor={currentColor}
              />
            </div>
            
            {/* Current color indicator */}
            <motion.div 
              className="glass rounded-full px-4 py-2 mb-4"
              key={currentColor}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <span className="text-sm text-muted-foreground">Current Color: </span>
              <span 
                className="font-bold uppercase"
                style={{ 
                  color: currentColor === 'red' ? '#ef4444' :
                         currentColor === 'blue' ? '#3b82f6' :
                         currentColor === 'green' ? '#22c55e' :
                         '#eab308'
                }}
              >
                {currentColor}
              </span>
            </motion.div>
            
            {/* Player hand */}
            <Hand
              cards={hand}
              selectedCardId={selectedCard}
              playableCardIds={playableCardIds}
              colorblindMode={colorblindMode}
              isCurrentPlayer={true}
              onCardClick={handleCardClick}
            />
          </div>
        </section>
        
        {/* Face-down cards */}
        <section className="glass rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-6">Card Back</h2>
          <div className="flex justify-center">
            <UnoCard 
              card={{ id: 'back', color: 'red', value: '0' }} 
              size="lg"
              faceDown={true}
            />
          </div>
        </section>
      </div>
      
      {/* Color Picker Modal */}
      <ColorPicker 
        isOpen={showColorPicker}
        onColorSelect={handleColorSelect}
      />
    </main>
  );
}
