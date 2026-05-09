'use client';

import { cn } from '@/lib/utils';
import { motion, type HTMLMotionProps } from 'framer-motion';

interface GlassPanelProps extends HTMLMotionProps<'div'> {
  variant?: 'default' | 'strong';
  children: React.ReactNode;
}

export function GlassPanel({
  variant = 'default',
  className,
  children,
  ...props
}: GlassPanelProps) {
  return (
    <motion.div
      className={cn(
        'rounded-2xl',
        variant === 'default' && 'glass',
        variant === 'strong' && 'glass-strong',
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Animated glow border panel
interface GlowPanelProps extends GlassPanelProps {
  glowColor?: string;
  active?: boolean;
}

export function GlowPanel({
  glowColor = 'rgba(139, 92, 246, 0.5)',
  active = false,
  className,
  children,
  ...props
}: GlowPanelProps) {
  return (
    <motion.div
      className={cn(
        'relative rounded-2xl glass overflow-hidden',
        className
      )}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        boxShadow: active 
          ? `0 0 30px 5px ${glowColor}` 
          : 'none'
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      {...props}
    >
      {/* Animated border gradient */}
      {active && (
        <motion.div
          className="absolute inset-0 rounded-2xl"
          style={{
            background: `linear-gradient(90deg, transparent, ${glowColor}, transparent)`,
            backgroundSize: '200% 100%',
          }}
          animate={{
            backgroundPosition: ['0% 0%', '200% 0%'],
          }}
          transition={{
            repeat: Infinity,
            duration: 2,
            ease: 'linear',
          }}
        />
      )}
      <div className="relative glass rounded-2xl m-[1px]">
        {children}
      </div>
    </motion.div>
  );
}
