"use server";

import crypto from 'crypto';
import { User, UserRole } from './types';
import { cookies } from 'next/headers';
import { getKV } from './kv';

export async function getUsers(): Promise<User[]> {
  const getDefaultUsers = async (): Promise<User[]> => {
    const defaultPassword = await hashPassword("Highspring365");
    return [
      { id: "user-001", username: "Admin", name: "System Admin", role: "Admin", passwordHash: defaultPassword, isActive: true },
      { id: "user-002", username: "Marketing", name: "Marketing Team", role: "Marketing", passwordHash: defaultPassword, isActive: true },
      { id: "user-003", username: "Requester", name: "Standard Requester", role: "Requester", passwordHash: defaultPassword, isActive: true }
    ];
  };

  try {
    const kv = getKV();
    let loadedUsers: User[] = [];
    
    if (kv) {
      const ids = await kv.smembers('users:index');
      if (ids && ids.length > 0) {
        const users = await Promise.all(ids.map(id => kv.get<User>(`user:${id}`)));
        loadedUsers = users.filter(Boolean) as User[];
      }
    } else {
      console.warn("KV store is not configured. Falling back to default memory users.");
    }
    
    if (loadedUsers.length === 0) {
      // Database is empty or KV is missing! Auto-seed default users so we can log in.
      const defaultUsers = await getDefaultUsers();
      
      if (kv) {
        for (const u of defaultUsers) {
          await kv.set(`user:${u.id}`, u);
          await kv.sadd('users:index', u.id);
        }
      }
      
      return defaultUsers;
    }
    
    return loadedUsers;
  } catch (error) {
    console.error("Failed to load users:", error);
    // Absolute fallback: if Redis is completely down, allow login anyway
    return await getDefaultUsers();
  }
}

export async function hashPassword(password: string): Promise<string> {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export async function authenticate(username: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
  const users = await getUsers();
  const user = users.find(u => u.username === username);
  
  if (!user || !user.isActive) {
    return { success: false, error: "Invalid username or password." };
  }

  const hashed = await hashPassword(password);
  if (user.passwordHash !== hashed) {
    return { success: false, error: "Invalid username or password." };
  }

  // Create session token (simplified JWT-like object)
  const sessionData = {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name
  };
  
  const sessionString = Buffer.from(JSON.stringify(sessionData)).toString('base64');
  
  const cookieStore = await cookies();
  cookieStore.set('auth_session', sessionString, {
    path: '/',
    maxAge: 86400,
    sameSite: 'strict'
  });

  return { success: true, user };
}

export async function getSession(): Promise<User | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get('auth_session');
  if (!session) return null;
  
  try {
    const decoded = Buffer.from(session.value, 'base64').toString('utf8');
    return JSON.parse(decoded) as User;
  } catch {
    return null;
  }
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete('auth_session');
}
