import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Building2, Plus, Users, Loader2, Search, MoreVertical, Pencil, Trash2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { WorkTeam, WorkTeamMember } from '@/lib/work-types';
import { useToast } from '@/hooks/use-toast';

export default function TeamsList() {
  const navigate = useNavigate();
  const { teamId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [teams, setTeams] = useState<WorkTeam[]>([]);
  const [members, setMembers] = useState<Record<string, WorkTeamMember[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    if (teams.length > 0) {
      teams.forEach(team => fetchTeamMembers(team.id));
    }
  }, [teams]);

  const fetchTeams = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('work_teams')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) {
      toast({ title: 'Error fetching teams', description: error.message, variant: 'destructive' });
    } else {
      setTeams(data || []);
    }
    setLoading(false);
  };

  const fetchTeamMembers = async (teamId: string) => {
    const { data } = await supabase
      .from('work_team_members')
      .select('*, profile:user_id(full_name, email, avatar_url)')
      .eq('team_id', teamId);
    
    if (data) {
      setMembers(prev => ({ ...prev, [teamId]: data }));
    }
  };

  const createTeam = async () => {
    if (!newTeam.name.trim() || !user) return;
    
    setCreating(true);
    try {
      const { data: team, error } = await supabase
        .from('work_teams')
        .insert({ name: newTeam.name, description: newTeam.description, created_by: user.id })
        .select()
        .single();
      
      if (error) throw error;
      
      if (team) {
        await supabase
          .from('work_team_members')
          .insert({ team_id: team.id, user_id: user.id, role: 'owner' });
        
        toast({ title: 'Team created successfully' });
        setNewTeam({ name: '', description: '' });
        setCreateDialogOpen(false);
        fetchTeams();
      }
    } catch (err: any) {
      toast({ title: 'Error creating team', description: err.message, variant: 'destructive' });
    }
    setCreating(false);
  };

  const deleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team?')) return;
    
    const { error } = await supabase
      .from('work_teams')
      .update({ is_active: false })
      .eq('id', teamId);
    
    if (error) {
      toast({ title: 'Error deleting team', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Team deleted' });
      fetchTeams();
    }
  };

  const filteredTeams = teams.filter(team => 
    team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    team.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Teams</h1>
          <p className="text-muted-foreground">Manage your teams and projects</p>
        </div>
        
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label htmlFor="name">Team Name</Label>
                <Input
                  id="name"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  placeholder="Enter team name"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newTeam.description}
                  onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              <Button onClick={createTeam} disabled={creating || !newTeam.name.trim()} className="w-full">
                {creating ? 'Creating...' : 'Create Team'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {filteredTeams.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
          <p className="text-muted-foreground mb-4">Create your first team to get started</p>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Team
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((team) => (
            <div
              key={team.id}
              className="border rounded-lg p-4 hover:bg-accent/50 cursor-pointer transition-colors"
              onClick={() => navigate(`/teams/${team.id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    {team.avatar_url ? (
                      <img src={team.avatar_url} alt={team.name} className="w-8 h-8 rounded-lg object-cover" />
                    ) : (
                      <Building2 className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold">{team.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {members[team.id]?.length || 0} members
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/teams/${team.id}`);
                  }}
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
              
              {team.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {team.description}
                </p>
              )}
              
              <div className="flex items-center gap-2">
                {members[team.id]?.slice(0, 3).map((member, idx) => (
                  <div
                    key={member.id}
                    className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs"
                    style={{ marginLeft: idx > 0 ? '-8px' : 0 }}
                  >
                    {member.profile?.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                ))}
                {(members[team.id]?.length || 0) > 3 && (
                  <span className="text-xs text-muted-foreground ml-2">
                    +{(members[team.id]?.length || 0) - 3}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}