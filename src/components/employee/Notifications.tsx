import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, AtSign, MessageSquare, Trash2, Loader2, ArrowUpRight, Clock, AlarmClock, Timer, ShieldCheck, ShieldX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type WorkNotificationType =
  | 'mention'
  | 'message'
  | 'attendance_checkout_reminder'
  | 'attendance_auto_checkout'
  | 'overtime_request'
  | 'overtime_approved'
  | 'overtime_declined'
  | 'early_checkout_request'
  | 'early_checkout_response';

interface WorkNotification {
  id: string;
  user_id: string;
  actor_id: string | null;
  office_id: string | null;
  channel_id: string | null;
  message_id: string | null;
  type: WorkNotificationType;
  title: string;
  body: string | null;
  action_url: string | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

interface ProfileLite {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface ChannelLite {
  id: string;
  name: string;
}

const notificationTypes: WorkNotificationType[] = [
  'mention',
  'message',
  'attendance_checkout_reminder',
  'attendance_auto_checkout',
  'overtime_request',
  'overtime_approved',
  'overtime_declined',
  'early_checkout_request',
  'early_checkout_response',
];

const normalizeNotificationType = (type: string): WorkNotificationType =>
  notificationTypes.includes(type as WorkNotificationType) ? (type as WorkNotificationType) : 'message';

const notificationTypeLabels: Record<WorkNotificationType, string> = {
  mention: 'Mention',
  message: 'Message',
  attendance_checkout_reminder: 'Checkout reminder',
  attendance_auto_checkout: 'Auto checkout',
  overtime_request: 'Overtime request',
  overtime_approved: 'Overtime approved',
  overtime_declined: 'Overtime declined',
  early_checkout_request: 'Early checkout request',
  early_checkout_response: 'Early checkout',
};

export function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<WorkNotification[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileLite>>({});
  const [channelsById, setChannelsById] = useState<Record<string, ChannelLite>>({});
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | WorkNotificationType>('all');
  const [filterRead, setFilterRead] = useState<'all' | 'read' | 'unread'>('all');
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<'unsupported' | 'default' | 'denied' | 'granted'>('unsupported');
  const [overtimeSubmittingFor, setOvertimeSubmittingFor] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<'unsupported' | 'disabled' | 'enabled'>('unsupported');
  const [pushConfigAvailable, setPushConfigAvailable] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getPushPublicKey = () => import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY as string | undefined;

  const decodeBase64Url = (value: string) => {
    const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
    const binary = window.atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  };

  const upsertPushSubscription = async (subscription: PushSubscription) => {
    const json = subscription.toJSON();
    const endpoint = json.endpoint;
    if (!endpoint) throw new Error('Push subscription endpoint missing.');

    const client = supabase as unknown as {
      from: (table: string) => {
        upsert: (values: Record<string, unknown>, options?: Record<string, unknown>) => Promise<{ error: Error | null }>;
        delete: () => { eq: (column: string, value: string) => Promise<{ error: Error | null }> };
      };
    };

    const { error } = await client.from('notification_push_subscriptions').upsert(
      {
        user_id: user?.id,
        endpoint,
        subscription: json,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    );

    if (error) throw error;
  };

  const syncPushStatus = async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported');
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    setPushStatus(subscription ? 'enabled' : 'disabled');
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof Notification === 'undefined') {
      setNotificationPermission('unsupported');
      return;
    }
    setNotificationPermission(Notification.permission);
  }, []);

  useEffect(() => {
    const publicKey = getPushPublicKey();
    setPushConfigAvailable(Boolean(publicKey));
    void syncPushStatus();
  }, []);

  const enablePushNotifications = async () => {
    if (typeof window === 'undefined') return;
    const publicKey = getPushPublicKey();

    if (!publicKey) {
      toast({
        title: 'Push not configured',
        description: 'Set VITE_WEB_PUSH_PUBLIC_KEY to enable true push notifications.',
        variant: 'destructive',
      });
      return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast({
        title: 'Push not supported',
        description: 'This browser does not support push subscriptions.',
        variant: 'destructive',
      });
      return;
    }

    setPushBusy(true);
    try {
      const permission =
        typeof Notification === 'undefined' ? 'denied' : await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission !== 'granted') {
        throw new Error('Notification permission was not granted.');
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeBase64Url(publicKey),
        }));

      await upsertPushSubscription(subscription);
      setPushStatus('enabled');
      toast({ title: 'Push notifications enabled' });
    } catch (error) {
      toast({
        title: 'Push setup failed',
        description: error instanceof Error ? error.message : 'Failed to enable push notifications.',
        variant: 'destructive',
      });
    } finally {
      setPushBusy(false);
    }
  };

  const disablePushNotifications = async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

    setPushBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        const client = supabase as unknown as {
          from: (table: string) => {
            delete: () => { eq: (column: string, value: string) => Promise<{ error: Error | null }> };
          };
        };
        await client.from('notification_push_subscriptions').delete().eq('endpoint', endpoint);
      }

      setPushStatus('disabled');
      toast({ title: 'Push notifications disabled' });
    } catch (error) {
      toast({
        title: 'Push disable failed',
        description: error instanceof Error ? error.message : 'Failed to disable push notifications.',
        variant: 'destructive',
      });
    } finally {
      setPushBusy(false);
    }
  };

  const requestDesktopPermission = async () => {
    if (typeof window === 'undefined') return;
    if (typeof Notification === 'undefined') {
      toast({ title: 'Desktop notifications not supported' });
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === 'granted') {
      toast({ title: 'Desktop notifications enabled' });
    } else if (permission === 'denied') {
      toast({ title: 'Desktop notifications blocked', description: 'Enable them in your browser settings.' });
    }
  };

  const getNotificationIcon = (type: WorkNotificationType) => {
    switch (type) {
      case 'mention':
        return <AtSign className="h-4 w-4 text-blue-600" />;
      case 'message':
        return <MessageSquare className="h-4 w-4 text-green-600" />;
      case 'attendance_checkout_reminder':
        return <AlarmClock className="h-4 w-4 text-amber-600" />;
      case 'attendance_auto_checkout':
        return <Clock className="h-4 w-4 text-red-600" />;
      case 'overtime_request':
        return <Timer className="h-4 w-4 text-purple-600" />;
      case 'overtime_approved':
        return <ShieldCheck className="h-4 w-4 text-green-600" />;
      case 'overtime_declined':
        return <ShieldX className="h-4 w-4 text-red-600" />;
      case 'early_checkout_request':
        return <Clock className="h-4 w-4 text-amber-600" />;
      case 'early_checkout_response':
        return <LogOutIconCompat />;
    }
  };

  const LogOutIconCompat = () => <Clock className="h-4 w-4 text-blue-600" />;

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      const matchesType = filterType === 'all' || notification.type === filterType;
      const matchesRead =
        filterRead === 'all' ||
        (filterRead === 'read' && notification.is_read) ||
        (filterRead === 'unread' && !notification.is_read);

      return matchesType && matchesRead;
    });
  }, [filterRead, filterType, notifications]);

  useEffect(() => {
    if (!user?.id) return;

    const hydrateRelated = async (rows: WorkNotification[]) => {
      const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter((v): v is string => typeof v === 'string')));
      const channelIds = Array.from(new Set(rows.map((r) => r.channel_id).filter((v): v is string => typeof v === 'string')));

      if (actorIds.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id,full_name,avatar_url')
          .in('id', actorIds);
        if (data) {
          setProfilesById((prev) => {
            const next = { ...prev };
            for (const p of data as ProfileLite[]) next[p.id] = p;
            return next;
          });
        }
      }

      if (channelIds.length > 0) {
        const { data } = await supabase
          .from('work_channels')
          .select('id,name')
          .in('id', channelIds);
        if (data) {
          setChannelsById((prev) => {
            const next = { ...prev };
            for (const c of data as ChannelLite[]) next[c.id] = c;
            return next;
          });
        }
      }
    };

    const fetchNotifications = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('work_notifications')
        .select('id,user_id,actor_id,office_id,channel_id,message_id,type,title,body,action_url,metadata,is_read,created_at')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      const rows = ((data || []) as unknown as WorkNotification[]).map((r) => ({
        ...r,
        type: normalizeNotificationType(r.type),
        metadata: r.metadata ?? {},
      }));

      setNotifications(rows);
      await hydrateRelated(rows);
      setLoading(false);
    };

    fetchNotifications();

    const realtime = supabase
      .channel(`work_notifications:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'work_notifications', filter: `user_id=eq.${user.id}` },
        async (payload) => {
          const row = payload.new as unknown as WorkNotification;
          const normalized: WorkNotification = {
            ...row,
            type: normalizeNotificationType(row.type),
            metadata: row.metadata ?? {},
          };
          setNotifications((prev) => [normalized, ...prev]);
          await hydrateRelated([normalized]);
        }
      )
      .subscribe();

    return () => {
      realtime.unsubscribe();
    };
  }, [user?.id]);

  const handleMarkAsRead = async (notificationId: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)));
    await supabase
      .from('work_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase
      .from('work_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_read', false);
    toast({ title: 'All marked as read' });
  };

  const handleDeleteNotification = async (notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    setSelectedNotifications((prev) => prev.filter((id) => id !== notificationId));
    await supabase.from('work_notifications').delete().eq('id', notificationId);
  };

  const submitOvertimeRequest = async (notification: WorkNotification) => {
    const attendanceId =
      typeof notification.metadata?.attendance_id === 'string' ? notification.metadata.attendance_id : null;

    if (!attendanceId) {
      toast({
        title: 'Attendance record missing',
        description: 'This reminder is not linked to an attendance record.',
        variant: 'destructive',
      });
      return;
    }

    setOvertimeSubmittingFor(notification.id);
    try {
      const { error } = await (supabase as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: Error | null }>;
      }).rpc('submit_overtime_request', {
        _attendance_id: attendanceId,
        _reason: 'Working overtime',
      });

      if (error) throw error;

      await handleMarkAsRead(notification.id);
      toast({
        title: 'OT request submitted',
        description: 'OT request submitted to Team Lead/Supervisor.',
      });
    } catch (error) {
      toast({
        title: 'Overtime request failed',
        description: error instanceof Error ? error.message : 'Failed to submit overtime request.',
        variant: 'destructive',
      });
    } finally {
      setOvertimeSubmittingFor(null);
    }
  };

  const getNotificationTarget = (notification: WorkNotification) => {
    if (notification.action_url) return notification.action_url;
    if (notification.office_id && notification.channel_id) {
      return `/teams`;
    }
    if (
      notification.type === 'attendance_checkout_reminder' ||
      notification.type === 'attendance_auto_checkout' ||
      notification.type === 'overtime_approved' ||
      notification.type === 'overtime_declined' ||
      notification.type === 'early_checkout_response'
    ) {
      return user?.role === 'admin' ? '/admin/attendance' : '/employee/attendance';
    }
    if (notification.type === 'overtime_request') {
      return '/admin/attendance';
    }
    if (notification.type === 'early_checkout_request') {
      return '/admin/attendance';
    }
    return '/teams';
  };

  const handleBulkDelete = async () => {
    const ids = selectedNotifications;
    if (ids.length === 0) return;
    setNotifications((prev) => prev.filter((n) => !ids.includes(n.id)));
    setSelectedNotifications([]);
    await supabase.from('work_notifications').delete().in('id', ids);
    toast({ title: 'Deleted notifications', description: `${ids.length} deleted.` });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedNotifications(filteredNotifications.map(n => n.id));
    } else {
      setSelectedNotifications([]);
    }
  };

  const handleSelectNotification = (notificationId: string, checked: boolean) => {
    if (checked) {
      setSelectedNotifications([...selectedNotifications, notificationId]);
    } else {
      setSelectedNotifications(selectedNotifications.filter(id => id !== notificationId));
    }
  };

  const openNotification = async (notification: WorkNotification) => {
    if (!notification.is_read) await handleMarkAsRead(notification.id);
    navigate(getNotificationTarget(notification));
  };

  const NotificationCard = ({ notification }: { notification: WorkNotification }) => {
    const actor = notification.actor_id ? profilesById[notification.actor_id] : undefined;
    const channel = notification.channel_id ? channelsById[notification.channel_id] : undefined;
    const byline = [
      actor?.full_name ? `From ${actor.full_name}` : null,
      channel?.name ? `in #${channel.name}` : null,
    ]
      .filter(Boolean)
      .join(' ');

    return (
    <Card className={`border ${!notification.is_read ? 'shadow-sm' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selectedNotifications.includes(notification.id)}
            onCheckedChange={(checked) => handleSelectNotification(notification.id, checked as boolean)}
          />
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {getNotificationIcon(notification.type)}
              <h4 className={`font-medium ${!notification.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                {notification.title}
              </h4>
              {!notification.is_read && (
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
              )}
              <Badge variant="secondary">{notificationTypeLabels[notification.type]}</Badge>
            </div>
            
            <p className="text-sm text-muted-foreground mb-2">
              {notification.body || 'New activity'}
            </p>

            {byline ? <div className="text-xs text-muted-foreground mb-2">{byline}</div> : null}
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
              </span>
              
              <div className="flex items-center gap-2">
                {notification.type === 'attendance_checkout_reminder' ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={overtimeSubmittingFor === notification.id}
                      onClick={() => submitOvertimeRequest(notification)}
                    >
                      <Timer className="h-3 w-3 mr-1" />
                      I am working overtime
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleMarkAsRead(notification.id)}>
                      Dismiss
                    </Button>
                  </>
                ) : null}

                <Button variant="outline" size="sm" onClick={() => openNotification(notification)}>
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  {notification.type === 'overtime_request' ? 'Review' : 'Open'}
                </Button>

                {!notification.is_read ? (
                  <Button variant="ghost" size="sm" onClick={() => handleMarkAsRead(notification.id)}>
                    <Check className="h-3 w-3 mr-1" />
                    Mark Read
                  </Button>
                ) : null}
                
                <Button variant="ghost" size="sm" onClick={() => handleDeleteNotification(notification.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Badge className="bg-red-500 text-white">
              {unreadCount} unread
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
              <Check className="h-4 w-4 mr-1" />
              Mark All Read
            </Button>
          )}
          
          {selectedNotifications.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleBulkDelete}>
              Delete Selected ({selectedNotifications.length})
            </Button>
          )}
        </div>
      </div>

      {notificationPermission === 'default' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Desktop notifications</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Enable desktop popups for new messages and mentions.
            </div>
            <Button onClick={requestDesktopPermission}>Enable</Button>
          </CardContent>
        </Card>
      ) : notificationPermission === 'denied' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Desktop notifications blocked</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Enable notifications for this site in your browser settings.
          </CardContent>
        </Card>
      ) : null}

      {pushStatus !== 'unsupported' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Push notifications</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              {pushConfigAvailable
                ? 'Receive attendance and overtime alerts even when the app is in the background.'
                : 'Push infrastructure is not configured yet for this environment.'}
            </div>
            {pushStatus === 'enabled' ? (
              <Button variant="outline" onClick={disablePushNotifications} disabled={pushBusy}>
                Disable Push
              </Button>
            ) : (
              <Button onClick={enablePushNotifications} disabled={pushBusy || !pushConfigAvailable}>
                Enable Push
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selectedNotifications.length === filteredNotifications.length && filteredNotifications.length > 0}
            onCheckedChange={handleSelectAll}
          />
          <span className="text-sm">Select All</span>
        </div>
        
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="mention">Mentions</SelectItem>
            <SelectItem value="message">Messages</SelectItem>
            <SelectItem value="attendance_checkout_reminder">Checkout reminders</SelectItem>
            <SelectItem value="attendance_auto_checkout">Auto checkout</SelectItem>
            <SelectItem value="overtime_request">Overtime requests</SelectItem>
            <SelectItem value="overtime_approved">Overtime approved</SelectItem>
            <SelectItem value="overtime_declined">Overtime declined</SelectItem>
            <SelectItem value="early_checkout_request">Early checkout requests</SelectItem>
            <SelectItem value="early_checkout_response">Early checkout</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={filterRead} onValueChange={setFilterRead}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Notifications</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="read">Read</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {loading ? (
          <Card>
            <CardContent className="p-8 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading notifications
            </CardContent>
          </Card>
        ) : filteredNotifications.length > 0 ? (
          filteredNotifications.map(notification => (
            <NotificationCard key={notification.id} notification={notification} />
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No notifications</h3>
              <p className="text-muted-foreground">
                {filterType !== 'all' || filterRead !== 'all' 
                  ? 'No notifications match your current filters.'
                  : 'You\'re all caught up! No new notifications.'
                }
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
