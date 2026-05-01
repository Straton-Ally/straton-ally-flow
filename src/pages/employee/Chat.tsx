import { WorkspaceModule } from '@/components/work/WorkspaceModule';

export default function ChatPage() {
  return <WorkspaceModule mode="employee" initialTab="chat" chatOnly />;
}
