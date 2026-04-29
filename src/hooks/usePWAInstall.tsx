import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  const checkInstalled = () => {
    const isStandaloneDisplay = window.matchMedia('(display-mode: standalone)').matches;
    const isFullscreenDisplay = window.matchMedia('(display-mode: fullscreen)').matches;
    const isAppleStandalone = 'standalone' in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    setIsInstalled(isStandaloneDisplay || isFullscreenDisplay || isAppleStandalone);
  };

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const platform = window.navigator.platform?.toLowerCase() ?? '';
    const isAppleTouchDevice = /iphone|ipad|ipod/.test(userAgent) || (platform === 'macintel' && window.navigator.maxTouchPoints > 1);
    setIsIOS(isAppleTouchDevice);

    checkInstalled();

    const standaloneMedia = window.matchMedia('(display-mode: standalone)');
    const fullscreenMedia = window.matchMedia('(display-mode: fullscreen)');
    standaloneMedia.addEventListener('change', checkInstalled);
    fullscreenMedia.addEventListener('change', checkInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      standaloneMedia.removeEventListener('change', checkInstalled);
      fullscreenMedia.removeEventListener('change', checkInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      setDeferredPrompt(null);
      setIsInstallable(false);
      
      return outcome === 'accepted';
    } catch (error) {
      console.error('Error during PWA installation:', error);
      return false;
    }
  };

  return {
    isInstallable,
    isInstalled,
    isIOS,
    canShowInstall: !isInstalled && (isInstallable || isIOS),
    install
  };
};
