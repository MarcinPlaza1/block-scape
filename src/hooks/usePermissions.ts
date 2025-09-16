import { useMemo } from 'react';
import { useAuthStore } from '@/lib/store';

export const usePermissions = () => {
  const { user, token } = useAuthStore();

  return useMemo(() => {
    const isLoggedIn = Boolean(user && token);
    const isAdmin = user?.role === 'ADMIN';
    const isModerator = user?.role === 'MODERATOR';
    const isUser = user?.role === 'USER';

    return {
      // Authentication status
      isLoggedIn,
      isGuest: !isLoggedIn,
      
      // Roles
      isAdmin,
      isUser,
      
      // Feature permissions
      canCreateProjects: isLoggedIn,
      canEditProfile: isLoggedIn,
      canAccessMarketplace: isLoggedIn,
      canManageUsers: isAdmin,
      canModerateContent: isAdmin || isModerator,
      canOpenOthersInEditor: isAdmin || isModerator,
      canPublishGames: isLoggedIn,
      canDeleteGames: isLoggedIn,
      canLikeGames: isLoggedIn,
      canSubmitScores: isLoggedIn,
      
      // Navigation permissions
      canAccessGames: isLoggedIn,
      canAccessProfile: isLoggedIn,
      canAccessEditor: isLoggedIn,
      
      // Public features (available for everyone)
      canViewPublicGames: true,
      canReadNews: true,
      canPlayGames: true,
      
      // User data
      user,
      userId: user?.id,
      userName: user?.name,
      userEmail: user?.email,
    };
  }, [user, token]);
};
