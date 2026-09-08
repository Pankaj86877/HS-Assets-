"use server";

import fs from 'fs/promises';
import path from 'path';
import { User } from './types';
import { getSession, hashPassword, getUsers } from './auth';
import { getKV } from './kv';

const usersFilePath = path.join(process.cwd(), 'src/data/users.json');

async function saveUsers(users: User[]) {
  const kv = getKV();
  if (kv) {
    await kv.set('users', users);
  } else {
    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf8');
  }
}

export async function fetchUsers(): Promise<User[]> {
  const session = await getSession();
  if (!session || session.role !== "Admin") throw new Error("Unauthorized");
  
  try {
    const users = await getUsers();
    return users.map(u => {
      const { passwordHash, ...rest } = u;
      return rest as User;
    });
  } catch (error) {
    return [];
  }
}

export async function createUser(data: Partial<User> & { password?: string }) {
  const session = await getSession();
  if (!session || session.role !== "Admin") throw new Error("Unauthorized");

  const users = await getUsers();

  if (users.find(u => u.username === data.username)) {
    throw new Error("Username already exists");
  }

  const newId = `user-${String(users.length + 1).padStart(3, '0')}`;
  
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

  users.push(newUser);
  await saveUsers(users);
  
  const { passwordHash, ...rest } = newUser;
  return rest as User;
}

export async function updateUser(id: string, data: Partial<User> & { password?: string }) {
  const session = await getSession();
  if (!session || session.role !== "Admin") throw new Error("Unauthorized");

  const users = await getUsers();
  
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) throw new Error("User not found");

  if (data.username && data.username !== users[idx].username) {
    if (users.find(u => u.username === data.username)) {
      throw new Error("Username already exists");
    }
  }

  if (data.password) {
    users[idx].passwordHash = await hashPassword(data.password);
  }

  if (data.username) users[idx].username = data.username;
  if (data.role) users[idx].role = data.role as User["role"];
  if (data.name) users[idx].name = data.name;
  if (data.isActive !== undefined) users[idx].isActive = data.isActive;

  await saveUsers(users);
  
  const { passwordHash, ...rest } = users[idx];
  return rest as User;
}

export async function deleteUser(id: string) {
  const session = await getSession();
  if (!session || session.role !== "Admin") throw new Error("Unauthorized");

  let users = await getUsers();
  
  users = users.filter(u => u.id !== id);
  
  await saveUsers(users);
}
