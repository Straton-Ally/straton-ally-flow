import { useState, useEffect } from 'react';
import { Users, MessageSquare, Calendar, Star, MapPin, Mail, Phone, Briefcase } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  avatar: string;
  status: 'online' | 'offline' | 'busy' | 'away';
  location: string;
  skills: string[];
  projects: string[];
  join_date: string;
}

interface TeamProject {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'on_hold';
  progress: number;
  team_members: string[];
  deadline: string;
  priority: 'low' | 'medium' | 'high';
}

interface TeamActivity {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  target: string;
  timestamp: string;
  type: 'task' | 'project' | 'comment' | 'meeting';
}

interface EmployeeSelectRow {
  id: string;
  user_id: string;
  department_id: string | null;
  designation: string | null;
  phone: string | null;
  joining_date: string;
  office_id: string | null;
  work_location: 'remote' | 'on_site' | null;
}

interface ProfileSelectRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface DepartmentSelectRow {
  id: string;
  name: string;
}

interface OfficeSelectRow {
  id: string;
  name: string;
}

interface TaskActivityRow {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  assignee_id: string | null;
}

export function TeamCollaboration() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [projects] = useState<TeamProject[]>([]);
  const [activities, setActivities] = useState<TeamActivity[]>([]);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messageRecipient, setMessageRecipient] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    const fetchTeamData = async () => {
      try {
        const { data: employeesData, error: employeesError } = await supabase
          .from('employees')
          .select('id,user_id,department_id,designation,phone,joining_date,office_id,work_location')
          .order('created_at', { ascending: false });

        if (employeesError) throw employeesError;

        const employees = (employeesData ?? []) as EmployeeSelectRow[];
        const userIds = employees.map((employee) => employee.user_id);
        const departmentIds = employees.map((employee) => employee.department_id).filter((id): id is string => Boolean(id));
        const officeIds = employees.map((employee) => employee.office_id).filter((id): id is string => Boolean(id));

        const [profilesResult, departmentsResult, officesResult] = await Promise.all([
          userIds.length ? supabase.from('profiles').select('id,full_name,email').in('id', userIds) : Promise.resolve({ data: [], error: null }),
          departmentIds.length ? supabase.from('departments').select('id,name').in('id', departmentIds) : Promise.resolve({ data: [], error: null }),
          officeIds.length ? supabase.from('offices').select('id,name').in('id', officeIds) : Promise.resolve({ data: [], error: null }),
        ]);

        if (profilesResult.error) throw profilesResult.error;
        if (departmentsResult.error) throw departmentsResult.error;
        if (officesResult.error) throw officesResult.error;

        const profilesById = new Map<string, ProfileSelectRow>();
        for (const profile of (profilesResult.data ?? []) as ProfileSelectRow[]) profilesById.set(profile.id, profile);

        const departmentsById = new Map<string, DepartmentSelectRow>();
        for (const department of (departmentsResult.data ?? []) as DepartmentSelectRow[]) departmentsById.set(department.id, department);

        const officesById = new Map<string, OfficeSelectRow>();
        for (const office of (officesResult.data ?? []) as OfficeSelectRow[]) officesById.set(office.id, office);

        const members = employees.map((employee) => {
          const profile = profilesById.get(employee.user_id);
          const fullName = profile?.full_name || 'Unknown employee';
          const initials = fullName
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

          return {
            id: employee.id,
            name: fullName,
            email: profile?.email || '',
            phone: employee.phone || '',
            designation: employee.designation || 'Employee',
            department: employee.department_id ? departmentsById.get(employee.department_id)?.name || 'Unassigned' : 'Unassigned',
            avatar: initials || 'U',
            status: 'offline' as const,
            location: employee.work_location === 'remote' ? 'Remote' : employee.office_id ? officesById.get(employee.office_id)?.name || 'Assigned office' : 'Unassigned',
            skills: [],
            projects: [],
            join_date: employee.joining_date,
          };
        });

        setTeamMembers(members);

        const { data: taskData, error: taskError } = await supabase
          .from('work_tasks')
          .select('id,title,status,updated_at,assignee_id')
          .order('updated_at', { ascending: false })
          .limit(10);

        if (taskError) throw taskError;

        const membersById = new Map(members.map((member) => [member.id, member]));
        setActivities(
          ((taskData ?? []) as TaskActivityRow[]).map((task) => ({
            id: task.id,
            user_id: task.assignee_id ?? '',
            user_name: task.assignee_id ? membersById.get(task.assignee_id)?.name || 'Unassigned' : 'Unassigned',
            action: task.status === 'complete' ? 'completed task' : 'updated task',
            target: task.title,
            timestamp: task.updated_at,
            type: 'task',
          })),
        );
      } catch (error) {
        toast({
          title: 'Unable to load team data',
          description: error instanceof Error ? error.message : 'Failed to fetch employees.',
          variant: 'destructive',
        });
      }
    };

    void fetchTeamData();
  }, [toast]);

  const getStatusColor = (status: TeamMember['status']) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'busy':
        return 'bg-red-500';
      case 'away':
        return 'bg-yellow-500';
      case 'offline':
        return 'bg-gray-400';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusText = (status: TeamMember['status']) => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'busy':
        return 'Busy';
      case 'away':
        return 'Away';
      case 'offline':
        return 'Offline';
      default:
        return 'Offline';
    }
  };

  const getProjectStatusColor = (status: TeamProject['status']) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'on_hold':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: TeamProject['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredMembers = teamMembers.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = filterDepartment === 'all' || member.department === filterDepartment;
    
    return matchesSearch && matchesDepartment;
  });

  const handleSendMessage = () => {
    if (!messageRecipient || !message.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select a recipient and enter a message.",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Open Work Chat",
      description: `Use the Work chat channel to message ${messageRecipient}.`,
    });

    setMessage('');
    setMessageRecipient('');
    setIsMessageDialogOpen(false);
  };

  const MemberCard = ({ member }: { member: TeamMember }) => (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="relative">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-accent text-accent-foreground">
                {member.avatar}
              </AvatarFallback>
            </Avatar>
            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${getStatusColor(member.status)}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium truncate">{member.name}</h4>
              <Badge variant="outline" className="text-xs">
                {getStatusText(member.status)}
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground">{member.designation}</p>
            <p className="text-xs text-muted-foreground mb-2">{member.department}</p>
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <MapPin className="h-3 w-3" />
              {member.location}
            </div>
            
            <div className="flex flex-wrap gap-1 mb-3">
              {member.skills.slice(0, 3).map(skill => (
                <Badge key={skill} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
              {member.skills.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{member.skills.length - 3}
                </Badge>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedMember(member)}
              >
                <Briefcase className="h-3 w-3 mr-1" />
                View
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setMessageRecipient(member.name);
                  setIsMessageDialogOpen(true);
                }}
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                Message
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Team Collaboration</h3>
        <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <MessageSquare className="h-4 w-4 mr-2" />
              Send Message
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Send Team Message</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="recipient">Recipient</Label>
                <Select value={messageRecipient} onValueChange={setMessageRecipient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map(member => (
                      <SelectItem key={member.id} value={member.name}>
                        {member.name} - {member.designation}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message here..."
                  rows={4}
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsMessageDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSendMessage}>
                  Send Message
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="team" className="space-y-4">
        <TabsList>
          <TabsTrigger value="team">Team Members</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="activity">Activity Feed</TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search team members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {Array.from(new Set(teamMembers.map((member) => member.department))).map((department) => (
                  <SelectItem key={department} value={department}>{department}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Team Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMembers.map(member => (
              <MemberCard key={member.id} member={member} />
            ))}
            {filteredMembers.length === 0 && (
              <Card className="md:col-span-2 lg:col-span-3">
                <CardContent className="py-10 text-center text-muted-foreground">No team members found</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <Card key={project.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    <Badge className={getProjectStatusColor(project.status)}>
                      {project.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {project.description}
                  </p>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>Progress</span>
                        <span>{project.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {project.team_members.length} members
                      </div>
                      <Badge className={getPriorityColor(project.priority)}>
                        {project.priority}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Due: {format(new Date(project.deadline), 'MMM d, yyyy')}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {projects.length === 0 && (
              <Card className="md:col-span-2 lg:col-span-3">
                <CardContent className="py-10 text-center text-muted-foreground">No projects found</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activities.map(activity => (
                  <div key={activity.id} className="flex items-start gap-3 pb-3 border-b last:border-b-0">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-accent text-accent-foreground text-sm">
                        {activity.user_name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{activity.user_name}</span>
                        <span className="text-muted-foreground"> {activity.action} </span>
                        <span className="font-medium">{activity.target}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(activity.timestamp), 'MMM d, yyyy at h:mm a')}
                      </p>
                    </div>
                    
                    <Badge variant="outline" className="text-xs">
                      {activity.type}
                    </Badge>
                  </div>
                ))}
                {activities.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">No recent activity</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Member Detail Dialog */}
      {selectedMember && (
        <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Team Member Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-accent text-accent-foreground text-xl">
                    {selectedMember.avatar}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{selectedMember.name}</h3>
                  <p className="text-muted-foreground">{selectedMember.designation}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(selectedMember.status)}`} />
                    <span className="text-sm">{getStatusText(selectedMember.status)}</span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Email</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Mail className="h-4 w-4" />
                    <span className="text-sm">{selectedMember.email}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Phone</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Phone className="h-4 w-4" />
                    <span className="text-sm">{selectedMember.phone}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Department</Label>
                  <p className="text-sm mt-1">{selectedMember.department}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Location</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm">{selectedMember.location}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <Label className="text-sm text-muted-foreground">Skills</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedMember.skills.map(skill => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <Label className="text-sm text-muted-foreground">Current Projects</Label>
                <div className="space-y-1 mt-1">
                  {selectedMember.projects.map(project => (
                    <div key={project} className="text-sm">
                      • {project}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button 
                  variant="outline"
                  onClick={() => {
                    setMessageRecipient(selectedMember.name);
                    setIsMessageDialogOpen(true);
                    setSelectedMember(null);
                  }}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
