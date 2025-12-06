import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle, 
  CardFooter 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { 
  LogOut, 
  Key, 
  User, 
  Shield, 
  Camera, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Loader2,
  Bell,
  Palette,
  Eye,
  EyeOff,
  Monitor,
  Download,
  Trash2,
  Activity,
  Settings,
  Save
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Profile update form schema
const profileFormSchema = z.object({
  fullName: z.string().min(2, {
    message: "Full name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  avatarImage: z.instanceof(FileList).optional().transform(fileList => fileList && fileList.length > 0 ? fileList[0] : undefined),
});

// Notification preferences schema
const notificationPrefsSchema = z.object({
  taskNotifications: z.boolean().default(true),
  messageNotifications: z.boolean().default(true),
  jobNotifications: z.boolean().default(true),
  emailNotifications: z.boolean().default(true),
});

// Password change form schema
const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, {
    message: "Current password is required.",
  }),
  newPassword: z.string().min(8, {
    message: "Password must be at least 8 characters.",
  }).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: "Password must contain at least one uppercase letter, one lowercase letter, and one number.",
  }),
  confirmPassword: z.string().min(8, {
    message: "Please confirm your password.",
  }),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;
type PasswordFormValues = z.infer<typeof passwordFormSchema>;
type NotificationPreferencesValues = z.infer<typeof notificationPrefsSchema>;

export default function AccountPage() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  
  // Dialog states
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [accountPreferencesOpen, setAccountPreferencesOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Avatar preview state
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  
  // Loading states
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false);
  
  // Fetch user activity
  const { data: allActivities } = useQuery({
    queryKey: ['/api/activities'],
    enabled: !!user?.id,
  });
  
  // Filter activities for current user
  const userActivities = React.useMemo(() => {
    if (!allActivities || !user?.id) return [];
    const activitiesArray = Array.isArray(allActivities) ? allActivities : [];
    return activitiesArray
      .filter((activity: any) => activity.userId === user.id)
      .slice(0, 10);
  }, [allActivities, user?.id]);
  
  // Profile form
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: user?.fullName || '',
      email: user?.email || '',
    },
  });
  
  // Password form
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });
  
  // Notification preferences form
  const notificationPrefsForm = useForm<NotificationPreferencesValues>({
    resolver: zodResolver(notificationPrefsSchema),
    defaultValues: {
      taskNotifications: user?.taskNotifications !== undefined ? user.taskNotifications : true,
      messageNotifications: user?.messageNotifications !== undefined ? user.messageNotifications : true,
      jobNotifications: user?.jobNotifications !== undefined ? user.jobNotifications : true,
      emailNotifications: true,
    },
  });
  
  // Update form values when user data loads
  React.useEffect(() => {
    if (user) {
      profileForm.reset({
        fullName: user.fullName || '',
        email: user.email || '',
      });
      
      notificationPrefsForm.reset({
        taskNotifications: user.taskNotifications !== undefined ? user.taskNotifications : true,
        messageNotifications: user.messageNotifications !== undefined ? user.messageNotifications : true,
        jobNotifications: user.jobNotifications !== undefined ? user.jobNotifications : true,
        emailNotifications: true,
      });
    }
    
    // Set avatar preview
    if (user?.avatarUrl) {
      setAvatarPreview(user.avatarUrl);
    }
  }, [user, profileForm, notificationPrefsForm]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      if (response.ok) {
        queryClient.clear();
        toast({
          title: "Logged out successfully",
          description: "You have been logged out of your account",
        });
        window.location.href = '/login';
      } else {
        throw new Error('Logout failed');
      }
    } catch (error) {
      toast({
        title: "Logout failed",
        description: "There was an error logging out. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle profile update
  const onProfileSubmit = async (values: ProfileFormValues) => {
    setIsUpdatingProfile(true);
    try {
      const formData = new FormData();
      formData.append('fullName', values.fullName);
      formData.append('email', values.email);
      
      if (values.avatarImage) {
        formData.append('avatarImage', values.avatarImage);
      }
      
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update profile');
      }
      
      queryClient.invalidateQueries({queryKey: ['/api/auth/me']});
      
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
      
      setEditProfileOpen(false);
      setAvatarPreview(null);
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message || "There was an error updating your profile.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };
  
  // Handle password change
  const onPasswordSubmit = async (values: PasswordFormValues) => {
    setIsChangingPassword(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to change password');
      }
      
      passwordForm.reset({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      
      toast({
        title: "Password changed",
        description: "Your password has been changed successfully.",
      });
      
      setChangePasswordOpen(false);
    } catch (error: any) {
      toast({
        title: "Password change failed",
        description: error.message || "There was an error changing your password.",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handle notification preferences update
  const onNotificationPrefsSubmit = async (values: NotificationPreferencesValues) => {
    setIsUpdatingNotifications(true);
    try {
      const response = await fetch('/api/auth/notification-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskNotifications: values.taskNotifications,
          messageNotifications: values.messageNotifications,
          jobNotifications: values.jobNotifications,
        }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update notification preferences');
      }
      
      queryClient.invalidateQueries({queryKey: ['/api/auth/me']});
      
      toast({
        title: "Preferences updated",
        description: "Your notification preferences have been updated successfully.",
      });
      
      setAccountPreferencesOpen(false);
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message || "There was an error updating your notification preferences.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingNotifications(false);
    }
  };

  // Handle avatar file change
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Format role for display
  const formatRole = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };
  
  // Format date
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.fullName) return user?.username?.[0]?.toUpperCase() || 'U';
    return user.fullName
      .split(' ')
      .map(name => name[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get last login from activities
  const lastLogin = userActivities?.find((activity: any) => 
    activity.activityType === 'user_login'
  );

  return (
    <div className="container py-8 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
            <p className="text-muted-foreground mt-1">
              Manage your account settings and preferences
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="border-red-200 text-red-600 hover:bg-red-50"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Preferences</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Activity</span>
            </TabsTrigger>
          </TabsList>
          
          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6 mt-6">
            {/* Profile Overview Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>
                  Your personal information and profile picture
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-8">
                  {/* Avatar Section */}
                  <div className="flex flex-col items-center sm:items-start">
                    <div className="relative">
                      <Avatar className="h-32 w-32 border-4 border-background shadow-lg">
                        <AvatarImage src={avatarPreview || user?.avatarUrl || undefined} alt={user?.fullName || 'User'} />
                        <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                          {getUserInitials()}
                        </AvatarFallback>
                      </Avatar>
                      {user?.avatarUrl && (
                        <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1.5 border-4 border-background">
                          <CheckCircle className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-4 text-center sm:text-left">
                      Profile picture
                    </p>
                  </div>

                  {/* Profile Information */}
                  <div className="flex-1 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">Full Name</Label>
                        <p className="text-base font-medium flex items-center gap-2">
                          {user?.fullName || 'Not provided'}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">Username</Label>
                        <p className="text-base font-medium">{user?.username}</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">Email Address</Label>
                        <div className="flex items-center gap-2">
                          <p className="text-base font-medium">{user?.email || 'Not provided'}</p>
                          {user?.email && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                      </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">Role</Label>
                        <div className="flex items-center">
                          <Badge variant="outline" className="bg-primary/10 hover:bg-primary/10 text-primary border-primary/20">
                            {user?.role ? formatRole(user.role) : 'User'}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">Account Status</Label>
                        <div className="flex items-center">
                          <Badge 
                            variant={user?.isActive ? "default" : "destructive"}
                            className={user?.isActive ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
                          >
                            {user?.isActive ? (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Active
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Inactive
                              </>
                            )}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">Member Since</Label>
                        <p className="text-base font-medium flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {formatDate(user?.createdAt)}
                        </p>
                      </div>
                      </div>
                    </div>
                  </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button onClick={() => setEditProfileOpen(true)} variant="outline">
                  <User className="mr-2 h-4 w-4" />
                  Edit Profile
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6 mt-6">
            {/* Password Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Password & Security
                </CardTitle>
                <CardDescription>
                  Manage your password and security settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Key className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-base font-medium">Password</h3>
                        <p className="text-sm text-muted-foreground">
                          Last changed: {user?.updatedAt ? formatDate(user.updatedAt) : 'Never'}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => setChangePasswordOpen(true)}>
                      Change Password
                    </Button>
                  </div>
                  
                  <Separator />
                  
                  {/* Security Features */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Security Features</h3>
                    
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 rounded-full bg-primary/10">
                          <Shield className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-base font-medium">Two-Factor Authentication</h3>
                          <p className="text-sm text-muted-foreground">
                            Add an extra layer of security to your account
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                        Coming Soon
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Account Activity Card */}
            {lastLogin && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription>
                    Your recent account activity
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 rounded-full bg-green-100">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="text-base font-medium">Last Login</h3>
                          <p className="text-sm text-muted-foreground">
                            {lastLogin.timestamp 
                              ? formatDistanceToNow(new Date(lastLogin.timestamp), { addSuffix: true })
                              : 'Never'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="space-y-6 mt-6">
            {/* Notifications Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>
                  Choose which notifications you want to receive
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...notificationPrefsForm}>
                  <form onSubmit={notificationPrefsForm.handleSubmit(onNotificationPrefsSubmit)} className="space-y-6">
                    <div className="space-y-4">
                      <FormField
                        control={notificationPrefsForm.control}
                        name="taskNotifications"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Task Notifications</FormLabel>
                              <FormDescription>
                                Receive notifications when tasks are assigned to you
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={notificationPrefsForm.control}
                        name="messageNotifications"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Message Notifications</FormLabel>
                              <FormDescription>
                                Receive notifications when you get new messages
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={notificationPrefsForm.control}
                        name="jobNotifications"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Job Notifications</FormLabel>
                              <FormDescription>
                                Receive notifications about workshop job status changes
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button type="submit" disabled={isUpdatingNotifications}>
                        {isUpdatingNotifications && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" />
                        Save Preferences
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Appearance Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Appearance
                </CardTitle>
                <CardDescription>
                  Customize the look and feel of your interface
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Monitor className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-base font-medium">Theme</h3>
                        <p className="text-sm text-muted-foreground">
                          Choose your preferred color theme
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                      Coming Soon
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Account Activity
                </CardTitle>
                <CardDescription>
                  View your recent account activity and login history
                </CardDescription>
              </CardHeader>
              <CardContent>
                {userActivities && userActivities.length > 0 ? (
                  <div className="space-y-4">
                    {userActivities.slice(0, 10).map((activity: any, index: number) => (
                      <div
                        key={activity.id || index}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card"
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`p-2 rounded-full ${
                            activity.activityType === 'user_login' 
                              ? 'bg-green-100' 
                              : 'bg-primary/10'
                          }`}>
                            {activity.activityType === 'user_login' ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <Activity className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div>
                            <h3 className="text-base font-medium">
                              {activity.description || 'Activity'}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {activity.timestamp 
                                ? formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })
                                : 'Unknown time'}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">
                          {activity.activityType?.replace('_', ' ') || 'Activity'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No recent activity found</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Account Actions */}
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription>
                  Irreversible and destructive actions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-red-200 bg-red-50/50">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 rounded-full bg-red-100">
                        <Download className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-medium">Export Account Data</h3>
                        <p className="text-sm text-muted-foreground">
                          Download a copy of your account data
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">
                      <Download className="mr-2 h-4 w-4" />
                      Export Data
                    </Button>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between p-4 rounded-lg border border-red-200 bg-red-50/50">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 rounded-full bg-red-100">
                        <Trash2 className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-medium">Delete Account</h3>
                        <p className="text-sm text-muted-foreground">
                          Permanently delete your account and all associated data
                        </p>
                      </div>
                    </div>
                    <AlertDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-100">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Account
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete your account
                            and remove all associated data from our servers.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              toast({
                                title: "Account deletion",
                                description: "This feature is not yet implemented.",
                                variant: "destructive",
                              });
                              setDeleteAccountOpen(false);
                            }}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete Account
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Edit Profile Dialog */}
      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update your personal information and profile picture
            </DialogDescription>
          </DialogHeader>
          
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
              {/* Avatar Preview */}
              {avatarPreview && (
                <div className="flex justify-center">
                  <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                    <AvatarImage src={avatarPreview} alt="Preview" />
                    <AvatarFallback className="text-xl">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
              
              <FormField
                control={profileForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Your full name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={profileForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="your.email@example.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={profileForm.control}
                name="avatarImage"
                render={({ field: { value, onChange, ...field } }) => (
                  <FormItem>
                    <FormLabel>Profile Picture</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-4">
                        <Label
                          htmlFor="avatar-upload"
                          className="cursor-pointer flex items-center justify-center gap-2 px-4 py-2 border rounded-md hover:bg-accent"
                        >
                          <Camera className="h-4 w-4" />
                          Choose File
                        </Label>
                      <Input 
                          id="avatar-upload"
                        type="file" 
                        accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            onChange(e.target.files);
                            handleAvatarChange(e);
                          }}
                        {...field}
                      />
                        {avatarPreview && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setAvatarPreview(null);
                              onChange(null);
                            }}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </FormControl>
                    <FormDescription>
                      Upload a profile picture (JPG, PNG or GIF, max 5MB)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => {
                  setEditProfileOpen(false);
                  setAvatarPreview(null);
                }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isUpdatingProfile}>
                  {isUpdatingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Change Password Dialog */}
      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Update your account password. Make sure it's strong and unique.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          {...field} 
                          type={showPassword ? "text" : "password"} 
                          placeholder="Your current password" 
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" placeholder="Your new password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" placeholder="Confirm your new password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-md border border-blue-200 dark:border-blue-800">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Password Requirements</p>
                    <ul className="text-xs text-blue-800 dark:text-blue-200 mt-1 list-disc list-inside space-y-1">
                      <li>At least 8 characters long</li>
                      <li>Include at least one uppercase letter</li>
                      <li>Include at least one lowercase letter</li>
                      <li>Include at least one number</li>
                      <li>Avoid reusing passwords from other websites</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setChangePasswordOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isChangingPassword}>
                  {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Change Password
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
