// Authentication module
// This module handles user authentication and session management

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthConfig {
  tokenExpiry: number;
  refreshEnabled: boolean;
}

export const auth = {
  isLoggedIn: false,
  currentUser: null as User | null,
};

export function login(email: string, password: string): Promise<User> {
  // TODO: Implement login logic
  return Promise.resolve({ id: "1", email, name: "Test User" });
}

export function logout(): void {
  auth.isLoggedIn = false;
  auth.currentUser = null;
}
