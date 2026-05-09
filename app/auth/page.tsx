'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, LogIn, UserPlus, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FloatingCards } from '@/components/game/card-showcase';

type Tab = 'login' | 'register';

function saveAuth(token: string, userId: string, username: string, displayName: string) {
  localStorage.setItem('uno-token',       token);
  localStorage.setItem('uno-user-id',     userId);
  localStorage.setItem('uno-username',    username);
  localStorage.setItem('uno-displayname', displayName);
  // Keep sessionStorage in sync for quick reads
  sessionStorage.setItem('uno-player-id',   userId);
  sessionStorage.setItem('uno-player-name', displayName);
}

export default function AuthPage() {
  const router = useRouter();
  const [tab,         setTab]         = useState<Tab>('login');
  const [username,    setUsername]    = useState('');
  const [password,    setPassword]    = useState('');
  const [showPw,      setShowPw]      = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');

  // If already logged in redirect to home
  useEffect(() => {
    const token = localStorage.getItem('uno-token');
    if (token) {
      fetch(`/api/auth/me?token=${token}`).then(r => {
        if (r.ok) router.replace('/');
      });
    }
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!username.trim() || !password) { setError('Fill in both fields'); return; }
    setLoading(true);

    const endpoint = tab === 'register' ? '/api/auth/register' : '/api/auth/login';
    try {
      const res  = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return; }

      saveAuth(data.token, data.user.id, data.user.username, data.user.displayName);
      setSuccess(tab === 'register' ? `Welcome, ${data.user.displayName}!` : `Welcome back, ${data.user.displayName}!`);
      setTimeout(() => router.replace('/'), 700);
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen gradient-bg relative overflow-hidden flex items-center justify-center p-4">
      <FloatingCards />
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <motion.div
        className="relative z-10 w-full max-w-sm"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, type: 'spring' }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            className="relative inline-block"
            animate={{ rotate: [0, 2, -2, 0] }}
            transition={{ repeat: Infinity, duration: 4 }}
          >
            <h1 className="text-5xl font-black italic text-white text-glow">UNO</h1>
            <Crown className="absolute -top-2 -right-6 w-7 h-7 text-yellow-400" />
          </motion.div>
          <p className="text-muted-foreground text-sm mt-2">Sign in to play</p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-6 shadow-2xl">
          {/* Tabs */}
          <div className="flex rounded-xl bg-white/5 p-1 mb-6">
            {(['login', 'register'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); setSuccess(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  tab === t ? 'bg-primary text-white shadow' : 'text-muted-foreground hover:text-white'
                }`}
              >
                {t === 'login' ? <><LogIn className="inline w-3.5 h-3.5 mr-1" />Login</> : <><UserPlus className="inline w-3.5 h-3.5 mr-1" />Register</>}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Username</label>
              <Input
                autoFocus
                autoComplete={tab === 'login' ? 'username' : 'username'}
                placeholder="e.g. player123"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="bg-input/50"
                maxLength={20}
              />
              {tab === 'register' && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Letters, numbers, underscores only. 2–20 chars.
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Password</label>
              <div className="relative">
                <Input
                  type={showPw ? 'text' : 'password'}
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  placeholder={tab === 'register' ? 'Min 4 characters' : 'Your password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="bg-input/50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Feedback */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 rounded-lg px-3 py-2"
                >
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  {success}
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-accent font-bold"
              disabled={loading}
            >
              {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-4">
            {tab === 'login'
              ? <>No account? <button onClick={() => setTab('register')} className="text-primary hover:underline">Register</button></>
              : <>Have an account? <button onClick={() => setTab('login')} className="text-primary hover:underline">Login</button></>
            }
          </p>
        </div>
      </motion.div>
    </main>
  );
}
