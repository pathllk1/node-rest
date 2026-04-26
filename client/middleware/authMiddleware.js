import { authManager } from '../utils/auth.js';

export async function requireAuth(router) {
  const isAuthenticated = await authManager.checkAuth();
  
  if (!isAuthenticated) {
    router.navigate('/login');
    return false;
  }
  
  return true;
}

export async function guestOnly(router) {
  const isAuthenticated = await authManager.checkAuth();
  
  if (isAuthenticated) {
    router.navigate('/dashboard');
    return false;
  }
  
  return true;
}
