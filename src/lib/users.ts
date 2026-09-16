"use server";

import { User } from './types';
import { getSession, hashPassword } from './auth';
import { kv } from '@vercel/kv';

export async function fetchUsers(): Promise<User[]> {
  try {
    if (process.env.KV_REST_API_URL) {
      const ids = await kv.smembers('users:index');
      if (ids && ids.length > 0) {
        const users = await Promise.all(ids.map(id => kv.get<User>(`user:${id}`)));
        return users.filter(Boolean).map(u => {
          const { passwordHash, ...rest } = u!;
          return rest;
        }) as User[];
      }
    }
    return [];
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return [];
  }
}

export async function createUser(data: Partial<User> & { password?: string }) {
  const session = await getSession();
  if (!session || session.role !== "Admin") throw new Error("Unauthorized");

  let allUsers: User[] = [];
  if (process.env.KV_REST_API_URL) {
    const ids = await kv.smembers('users:index');
    allUsers = await Promise.all(ids.map(id => kv.get<User>(`user:${id}`))) as User[];
  }

  if (allUsers.find(u => u?.username === data.username)) {
    throw new Error("Username already exists");
  }

  const newId = `user-${String(allUsers.length + 1).padStart(3, '0')}`;
  
  let hashed = "";
  if (data.password) {
    hashed = await hashPassword(data.password);
  } else {
    hashed = await hashPassword("Highspring365"); // Default password
  }

  const newUser: User = {
    id: newId,
    username: data.username!,
    passwordHash: hashed,
    role: data.role as User["role"],
    name: data.name!,
    isActive: data.isActive ?? true
  };

  if (process.env.KV_REST_API_URL) {
    await kv.set(`user:${newUser.id}`, newUser);
    await kv.sadd('users:index', newUser.id);
  }
  
  const { passwordHash, ...rest } = newUser;
  return rest as User;
}

export async function updateUser(id: string, data: Partial<User> & { password?: string }) {
  const session = await getSession();
  if (!session || session.role !== "Admin") throw new Error("Unauthorized");

  let user: User | null = null;
  let allUsers: User[] = [];
  
  if (process.env.KV_REST_API_URL) {
    user = await kv.get<User>(`user:${id}`);
    const ids = await kv.smembers('users:index');
    allUsers = await Promise.all(ids.map(id => kv.get<User>(`user:${id}`))) as User[];
  }
  
  if (!user) throw new Error("User not found");

  if (data.username && data.username !== user.username) {
    if (allUsers.find(u => u?.username === data.username)) {
      throw new Error("Username already exists");
    }
  }

  if (data.password) {
    user.passwordHash = await hashPassword(data.password);
  }

  if (data.username) user.username = data.username;
  if (data.role) user.role = data.role as User["role"];
  if (data.name) user.name = data.name;
  if (data.isActive !== undefined) user.isActive = data.isActive;

  if (process.env.KV_REST_API_URL) {
    await kv.set(`user:${user.id}`, user);
  }
  
  const { passwordHash, ...rest } = user;
  return rest as User;
}

export async function deleteUser(id: string) {
  const session = await getSession();
  if (!session || session.role !== "Admin") throw new Error("Unauthorized");
  
  if (process.env.KV_REST_API_URL) {
    await kv.del(`user:${id}`);
    await kv.srem('users:index', id);
  }
}
