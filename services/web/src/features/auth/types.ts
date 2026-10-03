export type AuthUser = {
  id: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
};

export type AuthResponse = {
  user: AuthUser;
};

export type Credentials = {
  email: string;
  password: string;
};
