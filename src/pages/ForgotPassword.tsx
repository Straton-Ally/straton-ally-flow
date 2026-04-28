import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { requestPasswordReset } from '@/lib/auth';

const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email username is required').regex(/^[a-zA-Z0-9._-]+$/, 'Invalid email username format'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [resendSecondsRemaining, setResendSecondsRemaining] = useState(0);
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  useEffect(() => {
    if (resendSecondsRemaining <= 0) return;

    const timerId = window.setTimeout(() => {
      setResendSecondsRemaining((seconds) => Math.max(seconds - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [resendSecondsRemaining]);

  const onSubmit = async (data: ForgotPasswordFormData) => {
    if (isSubmitted && resendSecondsRemaining > 0) return;

    setIsLoading(true);

    try {
      const fullEmail = `${data.email}@stratonally.com`;
      const { error } = await requestPasswordReset(fullEmail);

      if (error) {
        toast({
          title: 'Reset email failed',
          description: error,
          variant: 'destructive',
        });
        return;
      }

      setIsSubmitted(true);
      setResendSecondsRemaining(RESEND_COOLDOWN_SECONDS);
      toast({
        title: 'Check your inbox',
        description: `We sent a password reset link to ${fullEmail}.`,
      });
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

  const requestedEmail = getValues('email') ? `${getValues('email')}@stratonally.com` : 'your STRATON ALLY email';

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
            <Mail className="h-16 w-16 text-accent mb-8" />
            <h2 className="text-4xl font-display font-bold text-foreground">Reset access securely</h2>
            <p className="text-lg text-muted-foreground mt-4">
              A verified reset link will be sent to your company inbox.
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
              <h2 className="text-3xl font-display font-bold text-foreground">
                {isSubmitted ? 'Email sent' : 'Forgot password?'}
              </h2>
              <p className="text-muted-foreground mt-2">
                {isSubmitted
                  ? `Open the reset link sent to ${requestedEmail}.`
                  : 'Enter your email username and we will send you a reset link.'}
              </p>
            </div>

            {!isSubmitted ? (
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
                    />
                    <div className="flex items-center px-3 h-12 border border-l-0 border-input bg-muted rounded-r-md text-sm text-muted-foreground">
                      @stratonally.com
                    </div>
                  </div>
                  {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
                </div>

                <Button type="submit" size="xl" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Sending link...
                    </>
                  ) : (
                    <>
                      Send reset link
                      <Mail className="h-5 w-5" />
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <Button
                  type="button"
                  size="xl"
                  className="w-full"
                  onClick={handleSubmit(onSubmit)}
                  disabled={isLoading || resendSecondsRemaining > 0}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Sending link...
                    </>
                  ) : resendSecondsRemaining > 0 ? (
                    `Resend in ${resendSecondsRemaining}s`
                  ) : (
                    'Resend reset link'
                  )}
                </Button>
                <p className="text-sm text-center text-muted-foreground">
                  If you do not see it, check spam or ask an administrator to confirm your account email.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
