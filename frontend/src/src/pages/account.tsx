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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { 
  UserCog, 
  LogOut, 
  Key, 
  User, 
  Shield, 
  Mail, 
  Camera, 
  Upload, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Loader2 
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

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
});

// Password change form schema
const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, {
    message: "Current password is required.",
  }),
  newPassword: z.string().min(8, {
    message: "Password must be at least 8 characters.",
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
  
  // Loading states
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false);
  
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
      });
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
      // Make a POST request to the logout endpoint
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      if (response.ok) {
        // Clear the cache
        queryClient.clear();
        
        // Show success message
        toast({
          title: "Logged out successfully",
          description: "You have been logged out of your account",
        });
        
        // Redirect to login page
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
      // Create FormData for file upload
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
      
      const data = await response.json();
      
      // Update the cache
      queryClient.invalidateQueries({queryKey: ['/api/auth/me']});
      
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
      
      setEditProfileOpen(false);
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
        body: JSON.stringify(values),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update notification preferences');
      }
      
      // Update the cache
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

  // Format role for display
  const formatRole = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };
  
  // Format date
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="container py-10 max-w-4xl">
      <div className="flex flex-col space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">Account</h1>
          <Button 
            variant="destructive" 
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Profile Information</CardTitle>
                <CardDescription>
                  View and update your personal information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex flex-col items-center gap-4">
                    <Avatar className="h-32 w-32 border-4 border-primary/10">
                      <AvatarImage src={user?.avatarUrl || ''} alt={user?.fullName || 'User'} />
                      <AvatarFallback className="text-3xl bg-primary/10 text-primary">
                        {user?.fullName?.split(' ').map(name => name[0]).join('') || user?.username?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => setEditProfileOpen(true)}>
                      <Camera className="h-4 w-4 mr-2" />
                      Change Photo
                    </Button>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <h3 className="text-sm font-medium text-gray-500">Full Name</h3>
                        <p className="text-base font-medium">{user?.fullName || 'Not provided'}</p>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-medium text-gray-500">Username</h3>
                        <p className="text-base font-medium">{user?.username}</p>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-medium text-gray-500">Email</h3>
                        <p className="text-base font-medium flex items-center">
                          {user?.email || 'Not provided'}
                          {user?.email && (
                            <Badge className="ml-2 bg-green-100 text-green-800 hover:bg-green-100">
                              Verified
                            </Badge>
                          )}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-medium text-gray-500">Role</h3>
                        <div className="flex items-center">
                          <Badge variant="outline" className="bg-primary/10 hover:bg-primary/10 text-primary border-primary/20">
                            {user?.role ? formatRole(user.role) : 'User'}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-medium text-gray-500">Account Status</h3>
                        <div className="flex items-center">
                          <Badge 
                            variant={user?.isActive ? "default" : "destructive"}
                            className={user?.isActive ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
                          >
                            {user?.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-medium text-gray-500">Created At</h3>
                        <p className="text-base font-medium flex items-center">
                          {formatDate(user?.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button onClick={() => setEditProfileOpen(true)}>
                  <User className="mr-2 h-4 w-4" />
                  Edit Profile
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="security" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Account Security</CardTitle>
                <CardDescription>
                  Manage your account security and authentication settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Key className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-base font-medium">Password</h3>
                        <p className="text-sm text-gray-500">Last changed: {user?.updatedAt ? formatDate(user.updatedAt) : 'Never'}</p>
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => setChangePasswordOpen(true)}>Change Password</Button>
                  </div>
                  <Separator />
                  

                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Mail className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-base font-medium">Email Notifications</h3>
                        <p className="text-sm text-gray-500">Manage your email notification preferences</p>
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => setAccountPreferencesOpen(true)}>Configure</Button>
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
              Update your personal information
            </DialogDescription>
          </DialogHeader>
          
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
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
                      <Input 
                        type="file" 
                        accept="image/*"
                        onChange={(e) => onChange(e.target.files)}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Upload a profile picture (JPG, PNG or GIF)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setEditProfileOpen(false)}>
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
              Update your account password
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
                      <Input {...field} type="password" placeholder="Your current password" />
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
              
              <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Password Requirements</p>
                    <ul className="text-xs text-yellow-700 mt-1 list-disc list-inside">
                      <li>At least 8 characters long</li>
                      <li>Include a mix of letters, numbers, and symbols for stronger security</li>
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
      
      {/* Notification Preferences Dialog */}
      <Dialog open={accountPreferencesOpen} onOpenChange={setAccountPreferencesOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Email Notification Settings</DialogTitle>
            <DialogDescription>
              Choose which email notifications you want to receive.
            </DialogDescription>
          </DialogHeader>
          <Form {...notificationPrefsForm}>
            <form onSubmit={notificationPrefsForm.handleSubmit(onNotificationPrefsSubmit)} className="space-y-6">
              <FormField
                control={notificationPrefsForm.control}
                name="taskNotifications"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Task Notifications</FormLabel>
                      <FormDescription>
                        Receive emails when tasks are assigned to you
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
                        Receive emails when you get new messages
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
                        Receive emails about workshop job status changes
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
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setAccountPreferencesOpen(false)}
                  disabled={isUpdatingNotifications}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isUpdatingNotifications}>
                  {isUpdatingNotifications && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Preferences
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}