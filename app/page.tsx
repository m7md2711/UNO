'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Users, Bot, Crown, LogIn, ShieldAlert, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FloatingCards } from '@/components/game/card-showcase';
import type { RoomSummary } from '@/lib/room-store';

const PHASE_COLORS: Record<string, string> = {
  waiting:  'text-green-400',
  playing:  'text-yellow-400',
  finished: 'text-orange-400',
};

const PHASE_LABELS: Record<string, string> = {
  waiting:  'Open',
  playing:  'In Progress',
  finished: 'Round Over',
};

function getOrCreatePlayerId(): string {
  if (typeof window === 'undefined') return '';
  let id = sessionStorage.getItem('uno-player-id');
  if (!id) {
    id = Math.random().toString(36).substring(2, 11);
    sessionStorage.setItem('uno-player-id', id);
  }
  return id;
}

export default function HomePage() {
  const router = useRouter();

  const [playerName,  setPlayerName]  = useState('');
  const [savedName,   setSavedName]   = useState('');
  const [editingName, setEditingName] = useState(false);
  const [rooms,       setRooms]       = useState<RoomSummary[]>([]);
  const [joining,     setJoining]     = useState<string | null>(null);
  const [resetting,   setResetting]   = useState(false);

  useEffect(() => {
    const name = sessionStorage.getItem('uno-player-name') ?? '';
    setSavedName(name);
    setPlayerName(name);
    if (!name) setEditingName(true);
    fetchRooms();
    const iv = setInterval(fetchRooms, 3000);
    return () => clearInterval(iv);
  }, []);

  async function fetchRooms() {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) setRooms(await res.json());
    } catch {}
  }

  function saveName() {
    const trimmed = playerName.trim();
    if (!trimmed) return;
    sessionStorage.setItem('uno-player-name', trimmed);
    setSavedName(trimmed);
    setEditingName(false);
  }

  async function handleReset() {
    if (!confirm('Reset all rooms? All active games will be cleared.')) return;
    setResetting(true);
    try {
      await fetch('/api/admin/reset', { method: 'POST' });
      await fetchRooms();
    } catch {}
    setResetting(false);
  }

  async function joinRoom(roomId: string) {
    const name = savedName.trim();
    if (!name) { setEditingName(true); return; }
    setJoining(roomId);

    const playerId = getOrCreatePlayerId();
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'join', playerId, playerName: name }),
      });
      if (res.ok) {
        router.push(`/room/${roomId}`);
      } else {
        const err = await res.json();
        alert(err.error ?? 'Could not join room');
      }
    } catch {
      alert('Network error');
    } finally {
      setJoining(null);
    }
  }

  return (
    <main className="min-h-screen gradient-bg relative overflow-hidden">
      <FloatingCards />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80 pointer-events-none" />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-8 gap-8">

        {/* Logo */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, type: 'spring' }}
        >
          <motion.div
            className="relative inline-block mb-2"
            animate={{ rotate: [0, 2, -2, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          >
            <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter text-white text-glow">
              UNO
            </h1>
            <Crown className="absolute -top-2 -right-8 w-8 h-8 text-yellow-400 drop-shadow-lg" />
          </motion.div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            ROYALE
          </h2>
        </motion.div>

        {/* Name panel */}
        <motion.div
          className="glass rounded-2xl p-6 w-full max-w-sm"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          {editingName ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Enter your name to play</p>
              <Input
                autoFocus
                placeholder="Your name…"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveName()}
                className="text-center text-lg bg-input/50"
                maxLength={20}
              />
              <Button className="w-full bg-gradient-to-r from-primary to-accent" onClick={saveName}>
                <LogIn className="w-4 h-4 mr-2" />
                Set Name &amp; Play
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-lg">
                  {savedName[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-white">{savedName}</p>
                  <p className="text-xs text-muted-foreground">Playing as</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditingName(true)}>
                Change
              </Button>
            </div>
          )}
        </motion.div>

        {/* Rooms grid */}
        <motion.div
          className="w-full max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Choose a Room
            </h2>
            <Button
              variant="outline"
              size="sm"
              className="text-red-400 border-red-500/40 hover:bg-red-500/10"
              onClick={handleReset}
              disabled={resetting}
            >
              <ShieldAlert className="w-3.5 h-3.5 mr-1" />
              {resetting ? 'Resetting…' : 'Reset All'}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.length === 0
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="glass rounded-xl p-4 animate-pulse h-32" />
                ))
              : rooms.map((room, i) => {
                  const isFull  = room.humanCount >= room.maxPlayers;
                  const canJoin = room.phase === 'waiting' && !isFull;
                  const totalPlayers = room.humanCount + room.botCount;

                  return (
                    <motion.div
                      key={room.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`glass rounded-xl p-4 border-2 transition-all ${
                        canJoin
                          ? 'border-primary/30 hover:border-primary cursor-pointer hover:scale-105'
                          : 'border-border/20 opacity-70'
                      }`}
                      onClick={() => canJoin && joinRoom(room.id)}
                    >
                      {/* Header row */}
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="font-bold text-white">{room.name}</h3>
                        <span className={`text-xs font-semibold ${PHASE_COLORS[room.phase]}`}>
                          {PHASE_LABELS[room.phase]}
                        </span>
                      </div>

                      {/* Target */}
                      <p className="text-[11px] text-yellow-400 font-medium mb-2 flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        First to {room.matchTarget.toLocaleString()} pts wins
                      </p>

                      {/* Champion badge */}
                      {room.matchWinnerName && (
                        <p className="text-[11px] text-yellow-300 font-semibold mb-2 flex items-center gap-1">
                          <Crown className="w-3 h-3 text-yellow-400" />
                          Champion: {room.matchWinnerName}
                        </p>
                      )}

                      {/* Player counts */}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {room.humanCount}/{room.maxPlayers}
                        </span>
                        {room.botCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Bot className="w-3.5 h-3.5" />
                            {room.botCount} bots
                          </span>
                        )}
                      </div>

                      {/* Slot bar */}
                      <div className="flex gap-1 mb-2">
                        {Array.from({ length: room.maxPlayers }).map((_, j) => (
                          <div
                            key={j}
                            className={`flex-1 h-1.5 rounded-full ${
                              j < totalPlayers
                                ? j < room.humanCount ? 'bg-primary' : 'bg-primary/40'
                                : 'bg-white/10'
                            }`}
                          />
                        ))}
                      </div>

                      {canJoin && (
                        <Button
                          size="sm"
                          className="w-full bg-gradient-to-r from-primary to-accent"
                          disabled={joining === room.id || !savedName}
                          onClick={e => { e.stopPropagation(); joinRoom(room.id); }}
                        >
                          {joining === room.id ? 'Joining…' : 'Join Room'}
                        </Button>
                      )}
                      {!canJoin && room.phase === 'playing' && (
                        <p className="text-xs text-center text-muted-foreground mt-1">
                          Game in progress
                        </p>
                      )}
                    </motion.div>
                  );
                })}
          </div>
        </motion.div>

        <p className="text-xs text-muted-foreground text-center max-w-sm">
          Join any open room — the first player becomes host and starts the game.
        </p>
      </div>
    </main>
  );
}
