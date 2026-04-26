export const getPublicData = (req, res) => {
  res.json({
    success: true,
    message: 'Public data accessible to everyone',
    data: {
      title: 'Welcome to our SPA',
      description: 'This is a public endpoint that anyone can access',
      features: [
        'Dual token authentication',
        'Auto token refresh',
        'Secure cookie storage',
        'CSP and XSS protection'
      ]
    }
  });
};

export const getProtectedData = (req, res) => {
  res.json({
    success: true,
    message: 'Protected data for authenticated users',
    user: req.user,
    data: {
      secretInfo: 'This data is only visible to authenticated users',
      userRole: req.user.role,
      stats: {
        totalUsers: 150,
        activeNow: 23,
        lastLogin: new Date().toISOString()
      }
    }
  });
};

export const getDashboardData = (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user,
      stats: {
        pageViews: 1234,
        activeUsers: 45,
        revenue: 9876.54,
        growth: '+12.5%'
      },
      recentActivity: [
        { action: 'Login', time: '2 minutes ago' },
        { action: 'Profile updated', time: '1 hour ago' },
        { action: 'Settings changed', time: '3 hours ago' }
      ]
    }
  });
};

export const getProfileData = (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user,
      preferences: {
        theme: 'light',
        notifications: true,
        language: 'en'
      },
      accountInfo: {
        memberSince: '2024-01-15',
        lastPasswordChange: '2024-11-20',
        twoFactorEnabled: false
      }
    }
  });
};
