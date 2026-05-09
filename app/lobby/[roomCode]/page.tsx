'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Copy, Check, Users, Settings,
  Crown, MessageSquare, Send, Play, QrCode, Share2, X, Bot, Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { GlassPanel } from '@/components/ui/glass-panel';
import { FloatingCards } from '@/components/game/card-showcase';

type BotDifficulty = 'easy' | 'medium' | 'hard';

interface Player {
  id: string;
  name: string;
  avatar: string;
  isReady: boolean;
  isHost: boolean;
  isBot?: boolean;
  botDifficulty?: BotDifficulty;
}

interface GameSettings {
  stacking: boolean;
  jumpIn: boolean;
  sevenZero: boolean;
  forcePlay: boolean;
  turnTimer: number;
  scoreLimit: number;
}

interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
}

const DEFAULT_SETTINGS: GameSettings = {
  stacking: true,
  jumpIn: false,
  sevenZero: false,
  forcePlay: true,
  turnTimer: 30,
  scoreLimit: 500,
};

const BOT_NAMES   = ['RoboUno', 'CardBot', 'UnoMaster', 'WildCard', 'DrawFour', 'StackAttack', 'ReverseBot'];
const BOT_AVATARS: Record<BotDifficulty, string> = { easy: '🤖', medium: '🦾', hard: '🧠' };
const DIFF_ORDER: BotDifficulty[] = ['easy', 'medium', 'hard'];
const DIFF_COLORS: Record<BotDifficulty, string> = {
  easy:   'bg-green-500/20 text-green-400 hover:bg-green-500/40 border-green-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/40 border-yellow-500/30',
  hard:   'bg-red-500/20 text-red-400 hover:bg-red-500/40 border-red-500/30',
};

function makeBot(index: number, difficulty: BotDifficulty): Player {
  return {
    id: `bot-${index}`,
    name: BOT_NAMES[index % BOT_NAMES.length],
    avatar: BOT_AVATARS[difficulty],
    isReady: true,
    isHost: false,
    isBot: true,
    botDifficulty: difficulty,
  };
}

function generateMockPlayer(): Player {
  const names   = ['Alex', 'Jordan', 'Sam', 'Taylor', 'Morgan', 'Casey'];
  const avatars = ['🎮', '🎲', '🃏', '👑', '🔥', '⭐'];
  return {
    id: Math.random().toString(36).substring(2, 9),
    name: names[Math.floor(Math.random() * names.length)],
    avatar: avatars[Math.floor(Math.random() * avatars.length)],
    isReady: false,
    isHost: false,
  };
}

export default function LobbyPage() {
  const params       = useParams();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const roomCode     = params.roomCode as string;
  const isBotMode    = searchParams.get('bots') === 'true';

  const [copied,       setCopied]       = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showQR,       setShowQR]       = useState(false);
  const [chatMessage,  setChatMessage]  = useState('');
  const [settings,     setSettings]     = useState<GameSettings>(DEFAULT_SETTINGS);

  const currentPlayer: Player = {
    id: 'current-user', name: 'You', avatar: '👤', isReady: false, isHost: true,
  };

  const [players,  setPlayers]  = useState<Player[]>([currentPlayer]);
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: '1', playerId: 'system', playerName: 'System',
    message: 'Room created! Share the code to invite friends.',
  }]);

  const addSystemMessage = (text: string) =>
    setMessages(prev => [...prev, {
      id: Math.random().toString(), playerId: 'system', playerName: 'System', message: text,
    }]);

  // Add initial bots in bot mode
  useEffect(() => {
    if (!isBotMode || players.length > 1) return;
    const initialBots = [makeBot(0, 'easy'), makeBot(1, 'medium'), makeBot(2, 'hard')];
    setPlayers(prev => [...prev, ...initialBots]);
    addSystemMessage('3 bot players joined: Easy, Medium, and Hard!');
  }, [isBotMode]);

  // Simulate a human joining (non-bot mode demo)
  useEffect(() => {
    if (isBotMode) return;
    const timer = setTimeout(() => {
      if (players.length < 3) {
        const newPlayer = generateMockPlayer();
        setPlayers(prev => [...prev, newPlayer]);
        addSystemMessage(`${newPlayer.name} joined the room!`);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [players.length, isBotMode]);

  const copyRoomCode = async () => {
    await navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyInviteLink = async () => {
    const link = `${window.location.origin}/lobby/${roomCode}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Cycle a bot's difficulty: easy → medium → hard → easy
  const cycleBotDifficulty = (botId: string) => {
    setPlayers(prev => prev.map(p => {
      if (p.id !== botId || !p.isBot) return p;
      const current = DIFF_ORDER.indexOf(p.botDifficulty ?? 'medium');
      const next    = DIFF_ORDER[(current + 1) % DIFF_ORDER.length];
      return { ...p, botDifficulty: next, avatar: BOT_AVATARS[next] };
    }));
  };

  const addBot = () => {
    if (players.length >= 8) return;
    const botIndex  = players.filter(p => p.isBot).length;
    const newBot    = makeBot(botIndex, 'medium');
    setPlayers(prev => [...prev, newBot]);
    addSystemMessage(`${newBot.name} (Bot) joined!`);
  };

  const removeBot = (botId: string) => {
    const bot = players.find(p => p.id === botId);
    if (!bot?.isBot) return;
    setPlayers(prev => prev.filter(p => p.id !== botId));
    addSystemMessage(`${bot.name} (Bot) left.`);
  };

  const sendMessage = () => {
    if (!chatMessage.trim()) return;
    setMessages(prev => [...prev, {
      id: Math.random().toString(), playerId: 'current-user',
      playerName: 'You', message: chatMessage,
    }]);
    setChatMessage('');
  };

  const startGame = () => {
    const bots = players.filter(p => p.isBot);

    // Save config so the game page can read it.
    const config = {
      bots: bots.map((b, i) => ({
        id: `bot-${i}`,
        name: b.name,
        difficulty: b.botDifficulty ?? 'medium',
      })),
      settings: {
        pointsToWin:    settings.scoreLimit,
        stackingEnabled: settings.stacking,
        jumpInEnabled:   settings.jumpIn,
        sevenZeroEnabled: settings.sevenZero,
        turnTimer:       settings.turnTimer,
        forcePlay:       settings.forcePlay,
      },
    };

    try {
      localStorage.setItem(`uno-config-${roomCode}`, JSON.stringify(config));
    } catch {}

    router.push(`/game/${roomCode}`);
  };

  const allReady = players.length >= 2 &&
    players.every(p => p.isReady || p.isHost || p.isBot);

  return (
    <main className="min-h-screen gradient-bg relative overflow-hidden">
      <FloatingCards />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="p-4 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Leave
            </Button>
          </Link>

          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <GlassPanel className="px-4 py-2 flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Room Code:</span>
              <span className="font-mono text-lg font-bold tracking-widest text-primary">{roomCode}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyRoomCode}>
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </GlassPanel>
          </motion.div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setShowQR(true)}>
              <QrCode className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)}>
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* Main */}
        <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-7xl mx-auto w-full">
          {/* Players */}
          <GlassPanel className="lg:col-span-2 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                {isBotMode ? <Bot className="w-5 h-5 text-primary" /> : <Users className="w-5 h-5 text-primary" />}
                Players ({players.length}/8)
                {isBotMode && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full ml-2">
                    Bot Game
                  </span>
                )}
              </h2>
              {!isBotMode && (
                <Button variant="outline" size="sm" onClick={copyInviteLink}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Invite
                </Button>
              )}
            </div>

            {/* Bot controls */}
            {isBotMode && (
              <div className="mb-6 p-4 rounded-xl bg-card/30 border border-border/50 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Click a bot's difficulty badge to change it.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addBot}
                  disabled={players.length >= 8}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Bot
                </Button>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {players.map((player, index) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className={`relative p-4 rounded-xl border-2 transition-colors ${
                    player.isReady || player.isBot
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-border/50 bg-card/30'
                  }`}
                >
                  {player.isHost && (
                    <Crown className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400" />
                  )}
                  {player.isBot && (
                    <button
                      onClick={() => removeBot(player.id)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors"
                      title="Remove bot"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  )}

                  <div className="text-center">
                    <div className="text-4xl mb-2">{player.avatar}</div>
                    <p className="font-semibold truncate flex items-center justify-center gap-1 text-sm">
                      {player.isBot && <Bot className="w-3 h-3 text-muted-foreground" />}
                      {player.name}
                    </p>

                    {player.isBot && player.botDifficulty ? (
                      /* Clickable difficulty badge */
                      <button
                        onClick={() => cycleBotDifficulty(player.id)}
                        className={`mt-1 text-xs px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${DIFF_COLORS[player.botDifficulty]}`}
                        title="Click to change difficulty"
                      >
                        {BOT_AVATARS[player.botDifficulty]} {player.botDifficulty}
                      </button>
                    ) : (
                      <p className={`text-xs mt-1 ${
                        player.isHost ? 'text-yellow-400' :
                        player.isReady ? 'text-green-400' : 'text-muted-foreground'
                      }`}>
                        {player.isHost ? 'Host' : player.isReady ? 'Ready' : 'Not Ready'}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}

              {/* Empty slots */}
              {Array.from({ length: 8 - players.length }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="p-4 rounded-xl border-2 border-dashed border-border/30 bg-card/10 flex items-center justify-center"
                >
                  <span className="text-muted-foreground text-sm">Empty</span>
                </div>
              ))}
            </div>

            {/* Start button */}
            <div className="mt-6">
              <Button
                className="w-full h-12 text-lg font-bold bg-gradient-to-r from-primary to-accent"
                disabled={!allReady}
                onClick={startGame}
              >
                <Play className="w-5 h-5 mr-2" />
                {allReady
                  ? 'Start Game'
                  : `Waiting… (${players.filter(p => p.isReady || p.isHost || p.isBot).length}/${players.length})`}
              </Button>
            </div>
          </GlassPanel>

          {/* Chat */}
          <GlassPanel className="p-4 flex flex-col h-[500px] lg:h-auto">
            <h3 className="font-bold flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4 text-primary" />
              Chat
            </h3>

            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`text-sm ${msg.playerId === 'system' ? 'text-muted-foreground italic' : ''}`}
                >
                  {msg.playerId !== 'system' && (
                    <span className="font-semibold text-primary">{msg.playerName}: </span>
                  )}
                  {msg.message}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Type a message…"
                value={chatMessage}
                onChange={e => setChatMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                className="bg-input/50"
              />
              <Button size="icon" onClick={sendMessage}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </GlassPanel>
        </div>
      </div>

      {/* Settings modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSettings(false)} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative"
            >
              <GlassPanel className="w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Game Settings</h2>
                  <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)}>
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <SettingToggle label="Stacking" description="Allow +2 and +4 cards to stack"
                    checked={settings.stacking}
                    onCheckedChange={v => setSettings(s => ({ ...s, stacking: v }))} />
                  <SettingToggle label="Jump-In" description="Play identical cards out of turn"
                    checked={settings.jumpIn}
                    onCheckedChange={v => setSettings(s => ({ ...s, jumpIn: v }))} />
                  <SettingToggle label="7-0 Rule" description="7 swaps hands, 0 rotates all hands"
                    checked={settings.sevenZero}
                    onCheckedChange={v => setSettings(s => ({ ...s, sevenZero: v }))} />
                  <SettingToggle label="Force Play" description="Must play drawn card if valid"
                    checked={settings.forcePlay}
                    onCheckedChange={v => setSettings(s => ({ ...s, forcePlay: v }))} />

                  <div className="pt-4 border-t border-border/50">
                    <label className="text-sm font-medium mb-2 block">Turn Timer: {settings.turnTimer}s</label>
                    <input type="range" min={10} max={60} step={5} value={settings.turnTimer}
                      onChange={e => setSettings(s => ({ ...s, turnTimer: parseInt(e.target.value) }))}
                      className="w-full accent-primary" />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Score Limit: {settings.scoreLimit} pts</label>
                    <input type="range" min={100} max={1000} step={100} value={settings.scoreLimit}
                      onChange={e => setSettings(s => ({ ...s, scoreLimit: parseInt(e.target.value) }))}
                      className="w-full accent-primary" />
                  </div>
                </div>

                <Button className="w-full mt-6" onClick={() => setShowSettings(false)}>
                  Save Settings
                </Button>
              </GlassPanel>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR modal */}
      <AnimatePresence>
        {showQR && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowQR(false)} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative"
            >
              <GlassPanel className="w-full max-w-sm p-6 text-center">
                <h2 className="text-xl font-bold mb-4">Scan to Join</h2>
                <div className="bg-white p-4 rounded-xl inline-block mb-4">
                  <div className="w-48 h-48 bg-black/10 flex items-center justify-center text-black">
                    <div className="text-center">
                      <QrCode className="w-16 h-16 mx-auto mb-2" />
                      <p className="text-sm font-mono">{roomCode}</p>
                    </div>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm">
                  Room: <span className="font-mono font-bold text-primary">{roomCode}</span>
                </p>
                <Button variant="outline" className="mt-4" onClick={() => setShowQR(false)}>
                  Close
                </Button>
              </GlassPanel>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function SettingToggle({
  label, description, checked, onCheckedChange,
}: {
  label: string; description: string; checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
