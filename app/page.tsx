'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Users, Bot, Crown, LogOut, RotateCcw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FloatingCards } from '@/components/game/card-showcase';
import type { RoomSummary } from '@/lib/room-store';

const PHASE_COLORS: Record<string, string> = {
  waiting:  'text-green-400',
  playing:  'text-yellow-400',
  finished: 'text-muted-foreground',
};

const PHASE_LABELS: Record<string, string> = {
  waiting:  'Open',
  playing:  'In Progress',
  finished: 'Finished',
};

export default function HomePage() {
  const router = useRouter();

  const [userId,      setUserId]      = useState('');
  const [displayName, setDisplayName] = useState('');
  const [token,       setToken]       = useState('');
  const [rooms,       setRooms]       = useState<RoomSummary[]>([]);
  const [joining,     setJoining]     = useState<string | null>(null);
  const [resetting,   setResetting]   = useState(false);
  const [authReady,   setAuthReady]   = useState(false);

  // Auth guard — redirect to /auth if no valid token
  useEffect(() => {
    const t  = localStorage.getItem('uno-token')       ?? '';
    const id = localStorage.getItem('uno-user-id')     ?? '';
    const dn = localStorage.getItem('uno-displayname') ?? '';

    if (!t || !id) { router.replace('/auth'); return; }

    fetch(`/api/auth/me?token=${t}`).then(r => {
      if (!r.ok) { router.replace('/auth'); return; }
      setToken(t);
      setUserId(id);
      setDisplayName(dn);
      setAuthReady(true);
    }).catch(() => router.replace('/auth'));
  }, [router]);

  // Poll rooms
  useEffect(() => {
    if (!authReady) return;
    fetchRooms();
    const iv = setInterval(fetchRooms, 3000);
    return () => clearInterval(iv);
  }, [authReady]);

  async function fetchRooms() {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) setRooms(await res.json());
    } catch {}
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).catch(() => {});
    ['uno-token','uno-user-id','uno-username','uno-displayname'].forEach(k => localStorage.removeItem(k));
    ['uno-player-id','uno-player-name'].forEach(k => sessionStorage.removeItem(k));
    router.replace('/auth');
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
    if (!userId || !displayName) return;
    setJoining(roomId);

    // Keep sessionStorage in sync for the room page
    sessionStorage.setItem('uno-player-id',   userId);
    sessionStorage.setItem('uno-player-name', displayName);

    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'join', playerId: userId, playerName: displayName }),
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

  if (!authReady) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center text-white text-xl">
        Loading…
      </div>
    );
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

        {/* User identity strip */}
        <motion.div
          className="glass rounded-2xl p-4 w-full max-w-sm flex items-center justify-between"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-lg">
              {displayName[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-white">{displayName}</p>
              <p className="text-xs text-muted-foreground">Signed in</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-white">
            <LogOut className="w-4 h-4 mr-1" /> Sign out
          </Button>
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
              {resetting ? 'Resetting…' : 'Reset All Rooms'}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.length === 0
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="glass rounded-xl p-4 animate-pulse h-28" />
                ))
              : rooms.map((room, i) => {
                  const isFull    = room.humanCount >= room.maxPlayers;
                  const canJoin   = room.phase === 'waiting' && !isFull;
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
                          : 'border-border/20 opacity-60'
                      }`}
                      onClick={() => canJoin && joinRoom(room.id)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-bold text-white">{room.name}</h3>
                        <span className={`text-xs font-semibold ${PHASE_COLORS[room.phase]}`}>
                          {PHASE_LABELS[room.phase]}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
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

                      {/* Player slots visual */}
                      <div className="flex gap-1 mt-3">
                        {Array.from({ length: room.maxPlayers }).map((_, j) => (
                          <div
                            key={j}
                            className={`flex-1 h-1.5 rounded-full ${
                              j < totalPlayers
                                ? j < room.humanCount
                                  ? 'bg-primary'
                                  : 'bg-primary/40'
                                : 'bg-white/10'
                            }`}
                          />
                        ))}
                      </div>

                      {canJoin && (
                        <Button
                          size="sm"
                          className="w-full mt-3 bg-gradient-to-r from-primary to-accent"
                          disabled={joining === room.id}
                          onClick={e => { e.stopPropagation(); joinRoom(room.id); }}
                        >
                          {joining === room.id ? 'Joining…' : 'Join Room'}
                        </Button>
                      )}
                      {room.phase === 'playing' && (
                        <p className="text-xs text-center text-muted-foreground mt-2">
                          Game in progress
                        </p>
                      )}
                    </motion.div>
                  );
                })}
          </div>
        </motion.div>

        <p className="text-xs text-muted-foreground text-center max-w-sm">
          Join any open room — the first player becomes host and can add bots or start the game.
        </p>
      </div>
    </main>
  );
}
