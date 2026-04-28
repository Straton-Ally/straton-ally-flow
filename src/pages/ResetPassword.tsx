import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { signOut, updatePassword } from '@/lib/auth';

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPassword() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [canReset, setCanReset] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === 'PASSWORD_RECOVERY' || session) {
        setCanReset(true);
        setIsCheckingSession(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;

      setCanReset(Boolean(session));
      setIsCheckingSession(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true);

    try {
      const { error } = await updatePassword(data.password);

      if (error) {
        toast({
          title: 'Password update failed',
          description: error,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Password updated',
        description: 'Please sign in with your new password.',
      });
      await signOut();
      navigate('/login', { replace: true });
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-accent/10 via-background to-muted/20">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-20 -top-20 w-80 h-80 rounded-full bg-accent/10" />
          <div className="absolute right-10 top-20 w-40 h-40 rounded-full bg-success/10" />
          <div className="absolute left-1/3 bottom-1/3 w-60 h-60 rounded-full bg-info/10" />
        </div>

        <div className="absolute top-12 left-12 z-20">
          <h1 className="text-5xl font-display font-bold text-foreground">FLOW</h1>
          <p className="text-lg text-muted-foreground mt-2">by STRATON ALLY</p>
        </div>

        <div className="relative z-10 flex flex-1 items-center justify-center px-12">
          <div className="max-w-md">
            <KeyRound className="h-16 w-16 text-accent mb-8" />
            <h2 className="text-4xl font-display font-bold text-foreground">Create a new password</h2>
            <p className="text-lg text-muted-foreground mt-4">
              Choose a strong password to restore access to your FLOW dashboard.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-4xl font-display font-bold text-foreground">FLOW</h1>
            <p className="text-muted-foreground mt-1">by STRATON ALLY</p>
          </div>

          <div className="space-y-6">
            <Button variant="ghost" asChild className="px-0 text-muted-foreground hover:text-foreground">
              <Link to="/login">
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Link>
            </Button>

            <div>
              <h2 className="text-3xl font-display font-bold text-foreground">Reset password</h2>
              <p className="text-muted-foreground mt-2">
                {isCheckingSession
                  ? 'Verifying your reset link...'
                  : canReset
                    ? 'Enter and confirm your new password.'
                    : 'This reset link is missing, expired, or already used.'}
              </p>
            </div>

            {isCheckingSession ? (
              <div className="flex items-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Checking reset session
              </div>
            ) : canReset ? (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    New Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      {...register('password')}
                      className="h-12 bg-secondary/50 border-border focus:border-accent focus:ring-accent/20 pr-10"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      {...register('confirmPassword')}
                      className="h-12 bg-secondary/50 border-border focus:border-accent focus:ring-accent/20 pr-10"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
                </div>

                <Button type="submit" size="xl" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Updating password...
                    </>
                  ) : (
                    <>
                      Update password
                      <CheckCircle2 className="h-5 w-5" />
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <Button asChild size="xl" className="w-full">
                  <Link to="/forgot-password">Request a new link</Link>
                </Button>
                <p className="text-sm text-center text-muted-foreground">
                  Password reset links expire for security. Request another link from the same device if needed.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
