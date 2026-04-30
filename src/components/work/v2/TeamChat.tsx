import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  fetchChatRooms,
  fetchChatMessages,
  sendChatMessage,
  deleteChatMessage,
  type WorkChatRoom,
  type WorkChatMessage,
} from '@/lib/work';
import { cn } from '@/lib/utils';
import { Hash, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';

export function TeamChat() {
  const { teamId, roomId } = useParams();
  const { user } = useAuth();
  const [rooms, setRooms] = useState<WorkChatRoom[]>([]);
  const [messages, setMessages] = useState<WorkChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (teamId) {
      loadRooms();
    }
  }, [teamId]);

  useEffect(() => {
    if (roomId) {
      loadMessages();
    }
  }, [roomId]);

  const loadRooms = async () => {
    if (!teamId) return;
    try {
      const data = await fetchChatRooms(teamId);
      setRooms(data);
    } catch (error) {
      console.error('Failed to load rooms:', error);
    }
  };

  const loadMessages = async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const data = await fetchChatMessages(roomId);
      setMessages(data.reverse());
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !roomId || !user) return;
    setSending(true);
    try {
      await sendChatMessage({
        room_id: roomId,
        user_id: user.id,
        content: newMessage.trim(),
      });
      setNewMessage('');
      loadMessages();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      await deleteChatMessage(messageId);
      loadMessages();
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  if (!roomId) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="p-3 border-b">
          <h3 className="font-semibold">Team Chat</h3>
        </div>
        <div className="flex-1 p-4">
          {rooms.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Hash className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No chat rooms yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent cursor-pointer"
                >
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span>{room.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Hash className="h-4 w-4" />
          {rooms.find((r) => r.id === roomId)?.name}
        </h3>
      </div>

      <ScrollArea className="flex-1 p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>No messages yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="flex gap-3">
                <Avatar className="h-8 w-8">
                  {message.user?.avatar_url ? (
                    <AvatarImage src={message.user.avatar_url} />
                  ) : (
                    <AvatarFallback>
                      {message.user?.full_name?.slice(0, 2).toUpperCase() || 'U'}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-sm">
                      {message.user?.full_name || 'Unknown'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                    </span>
                    {message.is_edited && (
                      <span className="text-xs text-muted-foreground">(edited)</span>
                    )}
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{message.content}</p>
                </div>
                {message.user_id === user?.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={() => handleDelete(message.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-3 border-t">
        <div className="flex gap-2">
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          />
          <Button onClick={handleSend} disabled={sending || !newMessage.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default TeamChat;