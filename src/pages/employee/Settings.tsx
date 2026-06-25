import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ImageUp, RotateCcw, ZoomIn } from 'lucide-react';

const profileSchema = z.object({
  phone: z.string().optional(),
  address: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

type CropOffset = {
  x: number;
  y: number;
};

const AVATAR_CROP_SIZE = 320;
const AVATAR_OUTPUT_SIZE = 512;

export default function EmployeeSettings() {
  const { toast } = useToast();
  const { user, refetch } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState<CropOffset>({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropImageRef = useRef<HTMLImageElement | null>(null);
  const dragStartRef = useRef<{ pointerId: number; x: number; y: number; offset: CropOffset } | null>(null);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { phone: '', address: '' },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const initials = useMemo(() => {
    const name = user?.fullName?.trim() || 'User';
    return name.charAt(0).toUpperCase();
  }, [user?.fullName]);

  useEffect(() => {
    const load = async () => {
      try {
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;
        if (!authUser) throw new Error('Not signed in');

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', authUser.id)
          .maybeSingle();

        if (profileError) throw profileError;
        setAvatarUrl(profile?.avatar_url || null);

        const { data: employee, error: employeeError } = await supabase
          .from('employees')
          .select('id, phone, address')
          .eq('user_id', authUser.id)
          .maybeSingle();

        if (employeeError) throw employeeError;

        setEmployeeId(employee?.id || null);
        profileForm.reset({
          phone: employee?.phone || '',
          address: employee?.address || '',
        });
      } catch (error: unknown) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to load settings',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [profileForm, toast]);

  const clampCropOffset = useCallback((offset: CropOffset, zoom = cropZoom) => {
    if (!imageSize.width || !imageSize.height) return offset;

    const scale = Math.max(AVATAR_CROP_SIZE / imageSize.width, AVATAR_CROP_SIZE / imageSize.height) * zoom;
    const drawnWidth = imageSize.width * scale;
    const drawnHeight = imageSize.height * scale;
    const maxX = Math.max(0, (drawnWidth - AVATAR_CROP_SIZE) / 2);
    const maxY = Math.max(0, (drawnHeight - AVATAR_CROP_SIZE) / 2);

    return {
      x: Math.min(maxX, Math.max(-maxX, offset.x)),
      y: Math.min(maxY, Math.max(-maxY, offset.y)),
    };
  }, [cropZoom, imageSize.height, imageSize.width]);

  const drawImageToCanvas = useCallback((canvas: HTMLCanvasElement, size: number) => {
    const image = cropImageRef.current;
    if (!image || !imageSize.width || !imageSize.height) return false;

    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    const outputScale = size / AVATAR_CROP_SIZE;
    const baseScale = Math.max(AVATAR_CROP_SIZE / imageSize.width, AVATAR_CROP_SIZE / imageSize.height);
    const scale = baseScale * cropZoom;
    const drawnWidth = imageSize.width * scale;
    const drawnHeight = imageSize.height * scale;
    const dx = (AVATAR_CROP_SIZE - drawnWidth) / 2 + cropOffset.x;
    const dy = (AVATAR_CROP_SIZE - drawnHeight) / 2 + cropOffset.y;

    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(image, dx * outputScale, dy * outputScale, drawnWidth * outputScale, drawnHeight * outputScale);

    return true;
  }, [cropOffset.x, cropOffset.y, cropZoom, imageSize.height, imageSize.width]);

  const drawCropPreview = useCallback(() => {
    const canvas = cropCanvasRef.current;
    if (!canvas) return;

    drawImageToCanvas(canvas, AVATAR_CROP_SIZE);
  }, [drawImageToCanvas]);

  useEffect(() => {
    if (!cropImageUrl) return undefined;

    return () => URL.revokeObjectURL(cropImageUrl);
  }, [cropImageUrl]);

  useEffect(() => {
    drawCropPreview();
  }, [drawCropPreview]);

  const resetCrop = () => {
    setCropZoom(1);
    setCropOffset({ x: 0, y: 0 });
  };

  const saveProfile = async (data: ProfileFormData) => {
    if (!employeeId) {
      toast({
        title: 'Error',
        description: 'Employee record not found',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          phone: data.phone?.trim() || null,
          address: data.address?.trim() || null,
        })
        .eq('id', employeeId);

      if (error) throw error;

      toast({ title: 'Success', description: 'Profile updated' });
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const changePassword = async (data: PasswordFormData) => {
    setIsChangingPassword(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user?.email) throw new Error('Missing user email');

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: userData.user.email,
        password: data.currentPassword,
      });

      if (reauthError) throw new Error('Current password is incorrect');

      const { error: updateError } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (updateError) throw updateError;

      passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast({ title: 'Success', description: 'Password updated' });
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update password',
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const openCropDialog = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please select an image file.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedAvatarFile(file);
    setCropImageUrl(URL.createObjectURL(file));
    setCropZoom(1);
    setCropOffset({ x: 0, y: 0 });
    setImageSize({ width: 0, height: 0 });
    setIsCropDialogOpen(true);
  };

  const closeCropDialog = () => {
    setIsCropDialogOpen(false);
    setSelectedAvatarFile(null);
    setCropImageUrl(null);
    setImageSize({ width: 0, height: 0 });
    dragStartRef.current = null;
  };

  const createCroppedAvatarFile = async () => {
    const canvas = document.createElement('canvas');
    const didDraw = drawImageToCanvas(canvas, AVATAR_OUTPUT_SIZE);
    if (!didDraw) throw new Error('Unable to prepare cropped photo');

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((nextBlob) => {
        if (nextBlob) resolve(nextBlob);
        else reject(new Error('Unable to prepare cropped photo'));
      }, 'image/jpeg', 0.92);
    });

    const baseName = selectedAvatarFile?.name.replace(/\.[^/.]+$/, '') || 'profile-photo';
    return new File([blob], `${baseName}-cropped.jpg`, { type: 'image/jpeg' });
  };

  const confirmAvatarCrop = async () => {
    try {
      const croppedFile = await createCroppedAvatarFile();
      closeCropDialog();
      await uploadAvatar(croppedFile);
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to crop photo',
        variant: 'destructive',
      });
    }
  };

  const uploadAvatar = async (file: File) => {
    setIsUploadingAvatar(true);
    try {
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authUser) throw new Error('Not signed in');

      const fileName = `${Date.now()}.jpg`;
      const objectPath = `${authUser.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(objectPath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(objectPath);
      const nextUrl = publicUrlData.publicUrl;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: nextUrl })
        .eq('id', authUser.id);

      if (profileError) throw profileError;

      setAvatarUrl(nextUrl);
      await refetch();
      toast({ title: 'Success', description: 'Profile photo updated' });
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to upload photo',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  if (isLoading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your profile and security</p>
      </div>

      <Card className="card-elevated">
        <CardHeader>
          <CardTitle>Profile Photo</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="bg-success text-success-foreground font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{user?.fullName || 'User'}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) openCropDialog(file);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={isUploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageUp className="mr-2 h-4 w-4" />
              {isUploadingAvatar ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isCropDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeCropDialog();
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crop Profile Photo</DialogTitle>
            <DialogDescription>Drag the photo and adjust zoom to frame your avatar.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="mx-auto flex w-full justify-center">
              <div className="relative h-80 w-80 max-w-full overflow-hidden rounded-md bg-muted">
                <canvas
                  ref={cropCanvasRef}
                  className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
                  width={AVATAR_CROP_SIZE}
                  height={AVATAR_CROP_SIZE}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    dragStartRef.current = {
                      pointerId: event.pointerId,
                      x: event.clientX,
                      y: event.clientY,
                      offset: cropOffset,
                    };
                  }}
                  onPointerMove={(event) => {
                    const dragStart = dragStartRef.current;
                    if (!dragStart || dragStart.pointerId !== event.pointerId) return;

                    setCropOffset(
                      clampCropOffset({
                        x: dragStart.offset.x + event.clientX - dragStart.x,
                        y: dragStart.offset.y + event.clientY - dragStart.y,
                      }),
                    );
                  }}
                  onPointerUp={(event) => {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                    dragStartRef.current = null;
                  }}
                  onPointerCancel={() => {
                    dragStartRef.current = null;
                  }}
                />
                <div className="pointer-events-none absolute inset-8 rounded-full border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.38)]" />
                <div className="pointer-events-none absolute inset-8 rounded-full ring-1 ring-black/20" />
              </div>
            </div>

            {cropImageUrl && (
              <img
                ref={cropImageRef}
                src={cropImageUrl}
                alt=""
                className="hidden"
                onLoad={(event) => {
                  setImageSize({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  });
                }}
              />
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="avatar-zoom" className="flex items-center gap-2">
                  <ZoomIn className="h-4 w-4" />
                  Zoom
                </Label>
                <Button type="button" variant="ghost" size="sm" onClick={resetCrop}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>
              <Slider
                id="avatar-zoom"
                min={1}
                max={3}
                step={0.05}
                value={[cropZoom]}
                onValueChange={([value]) => {
                  const nextZoom = value || 1;
                  setCropZoom(nextZoom);
                  setCropOffset((current) => clampCropOffset(current, nextZoom));
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeCropDialog}>
              Cancel
            </Button>
            <Button type="button" disabled={!imageSize.width || isUploadingAvatar} onClick={confirmAvatarCrop}>
              {isUploadingAvatar ? 'Uploading...' : 'Save Photo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="card-elevated">
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={profileForm.handleSubmit(saveProfile)} className="space-y-4">
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input {...profileForm.register('phone')} placeholder="Enter phone number" />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea {...profileForm.register('address')} placeholder="Enter address" rows={4} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSavingProfile}>
                {isSavingProfile ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="card-elevated">
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={passwordForm.handleSubmit(changePassword)} className="space-y-4">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input type="password" {...passwordForm.register('currentPassword')} />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.currentPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" {...passwordForm.register('newPassword')} />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input type="password" {...passwordForm.register('confirmPassword')} />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isChangingPassword}>
                {isChangingPassword ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
