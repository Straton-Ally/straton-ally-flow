import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, ArrowRight, Download, Share, PlusSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { signIn, getCurrentUser, getRedirectPath } from '@/lib/auth';
import { AnimatedCharacters } from '@/components/ui/animated-characters';
const loginSchema = z.object({
  email: z.string().min(1, 'Email username is required').regex(/^[a-zA-Z0-9._-]+$/, 'Invalid email username format'),
  password: z.string().min(1, 'Password is required')
});
type LoginFormData = z.infer<typeof loginSchema>;
export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isInstallHelpOpen, setIsInstallHelpOpen] = useState(false);
  const navigate = useNavigate();
  const { canShowInstall, isInstallable, isIOS, install } = usePWAInstall();
  const {
    toast
  } = useToast();
  const {
    register,
    handleSubmit,
    formState: {
      errors
    },
    watch
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
  });
  const password = watch('password', '');
  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      // Append @stratonally.com to the username
      const fullEmail = `${data.email}@stratonally.com`;
      const {
        user,
        error
      } = await signIn(fullEmail, data.password);
      if (error) {
        toast({
          title: 'Sign in failed',
          description: error,
          variant: 'destructive'
        });
        return;
      }
      if (user) {
        const authUser = await getCurrentUser();
        const redirectPath = getRedirectPath(authUser?.role ?? null, authUser?.isTeamLead ?? false);
        navigate(redirectPath, {
          replace: true
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  const handleInstallClick = async () => {
    if (isInstallable) {
      const installed = await install();
      if (!installed) {
        toast({
          title: 'Install not completed',
          description: 'You can install FLOW from your browser menu anytime.',
        });
      }
      return;
    }

    setIsInstallHelpOpen(true);
  };
  return <div className="min-h-screen flex">
      {/* Left side - Animated Characters */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-accent/10 via-background to-muted/20 flex-col">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-20 -top-20 w-80 h-80 rounded-full bg-accent/10" />
          <div className="absolute right-10 top-20 w-40 h-40 rounded-full bg-success/10" />
          <div className="absolute left-1/3 bottom-1/3 w-60 h-60 rounded-full bg-info/10" />
        </div>

        {/* Characters section */}
        <div className="flex-1 flex items-end justify-center px-12 pb-0 relative z-10">
          <AnimatedCharacters isTyping={isTyping} isPasswordVisible={showPassword} hasPassword={password.length > 0} />
        </div>
        
        {/* Brand overlay */}
        <div className="absolute top-12 left-12 z-20">
          <h1 className="text-5xl font-display font-bold text-foreground">FLOW</h1>
          <p className="text-lg text-muted-foreground mt-2">by STRATON ALLY</p>
        </div>

        {/* Footer links */}
        <div className="absolute bottom-12 right-12 z-20 flex gap-6 text-sm text-muted-foreground">
          
          
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-4xl font-display font-bold text-foreground">FLOW</h1>
            <p className="text-muted-foreground mt-1">by STRATON ALLY</p>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-display font-bold text-foreground">Welcome back</h2>
              <p className="text-muted-foreground mt-2">
                Sign in to access your dashboard
              </p>
            </div>

            {canShowInstall && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 justify-center gap-2 border-accent/40 bg-accent/5 text-foreground hover:bg-accent/10"
                  onClick={handleInstallClick}
                >
                  <Download className="h-5 w-5" />
                  Install FLOW app
                </Button>
                <Dialog open={isInstallHelpOpen} onOpenChange={setIsInstallHelpOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Install FLOW app</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 text-sm text-muted-foreground">
                    {isIOS ? (
                      <>
                        <div className="flex gap-3">
                          <Share className="h-5 w-5 shrink-0 text-foreground" />
                          <p>Open this page in Safari, tap Share, then choose Add to Home Screen.</p>
                        </div>
                        <div className="flex gap-3">
                          <PlusSquare className="h-5 w-5 shrink-0 text-foreground" />
                          <p>Confirm the name and tap Add. FLOW will open like a normal app from your home screen.</p>
                        </div>
                      </>
                    ) : (
                      <p>Use your browser menu and choose Install app or Add to Home screen.</p>
                    )}
                  </div>
                </DialogContent>
                </Dialog>
              </>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email Username
                </Label>
                <div className="flex">
                  <Input 
                    id="email" 
                    type="text" 
                    placeholder="john.doe" 
                    {...register('email')} 
                    className="h-12 bg-secondary/50 border-border focus:border-accent focus:ring-accent/20 rounded-r-none" 
                    disabled={isLoading} 
                    onFocus={() => setIsTyping(true)} 
                    onBlur={() => setIsTyping(false)} 
                  />
                  <div className="flex items-center px-3 h-12 border border-l-0 border-input bg-muted rounded-r-md text-sm text-muted-foreground">
                    @stratonally.com
                  </div>
                </div>
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password
                  </Label>
                  <Link to="/forgot-password" className="text-sm font-medium text-accent hover:text-accent/80">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" {...register('password')} className="h-12 bg-secondary/50 border-border focus:border-accent focus:ring-accent/20 pr-10" disabled={isLoading} onFocus={() => setIsTyping(true)} onBlur={() => setIsTyping(false)} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
              </div>

              <Button type="submit" size="xl" className="w-full" disabled={isLoading}>
                {isLoading ? <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Signing in...
                  </> : <>
                    Sign in
                    <ArrowRight className="h-5 w-5" />
                  </>}
              </Button>
            </form>

            <p className="text-sm text-center text-muted-foreground">
              Access is restricted to STRATON ALLY employees only.
              <br />
              Contact your administrator for account issues.
            </p>
          </div>
        </div>
      </div>
    </div>;
}
