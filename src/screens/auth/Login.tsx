import React, { useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { loginAtom, authErrorAtom, isLoadingAtom } from '@/store/auth';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [, login] = useAtom(loginAtom);
  const [error] = useAtom(authErrorAtom);
  const [isLoading] = useAtom(isLoadingAtom);
  const [loginError, setLoginError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formTouched, setFormTouched] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        navigate('/admin');
      }
    };
    checkSession();
  }, []);

  const validateForm = () => {
    if (!email) return 'Email is required';
    if (!email.includes('@')) return 'Please enter a valid email';
    if (!password) return 'Password is required';
    if (password.length < 6) return 'Password must be at least 6 characters';
    return null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'email') setEmail(value);
    if (name === 'password') setPassword(value);
    setFormTouched(true);
    setLoginError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    const validationError = validateForm();
    if (validationError) {
      setLoginError(validationError);
      setIsSubmitting(false);
      return;
    }
    
    try {
      const success = await login({ email, password });
      console.log('Login attempt result:', success);
      
      if (success) {
        navigate('/admin');
      } else {
        setLoginError('Invalid email or password');
      }
    } catch (error) {
      setLoginError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-svh items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md space-y-8 rounded-xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <div className="text-center">
          <img src="/images/logo.svg" alt="Logo" className="mx-auto h-14 w-14" />
          <h2 className="mt-6 text-3xl font-bold text-white">Sign in to your account</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Access your LegalLeads dashboard
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {(error || loginError) && (
            <div className="rounded-md bg-red-900/30 p-3 text-sm text-red-400">
              {error || loginError}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
                Email address
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-800 text-white"
                placeholder="email@example.com"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-300">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-800 text-white"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link to="/forgot-password" className="text-cyan-500 hover:text-cyan-400">
                Forgot your password?
              </Link>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-cyan-600 hover:bg-cyan-500"
            disabled={isSubmitting || !email || !password}
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
          
          <div className="text-center text-sm text-zinc-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-cyan-500 hover:text-cyan-400">
              Register now
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};