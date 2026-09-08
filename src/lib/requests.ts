"use server";

import fs from 'fs/promises';
import path from 'path';
import { CreativeRequest, RequestStatus, RequestHistoryEntry } from './types';
import { getSession } from './auth';
import { kv } from '@vercel/kv';

const requestsFilePath = path.join(process.cwd(), 'src/data/requests.json');

export async function fetchRequests(): Promise<CreativeRequest[]> {
  try {
    const useKV = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
    
    if (useKV) {
      let requests = await kv.get<CreativeRequest[]>('requests');
      
      if (!requests) {
        const data = await fs.readFile(requestsFilePath, 'utf8');
        requests = JSON.parse(data);
        if (requests && requests.length > 0) {
          await kv.set('requests', requests);
        }
      }
      
      return requests || [];
    } else {
      const data = await fs.readFile(requestsFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to fetch requests:", error);
    return [];
  }
}

export async function getNewRequestsCount(): Promise<number> {
  const requests = await fetchRequests();
  const session = await getSession();
  
  if (!session || session.role === "Requester") return 0;
  
  return requests.filter(r => r.status === "New").length;
}

async function saveRequests(requests: CreativeRequest[]): Promise<void> {
  const useKV = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
  if (useKV) {
    await kv.set('requests', requests);
  } else {
    await fs.writeFile(requestsFilePath, JSON.stringify(requests, null, 2), 'utf8');
  }
}

export async function createRequest(data: Omit<CreativeRequest, "id" | "status" | "createdAt" | "updatedAt" | "history">) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const requests = await fetchRequests();
  const newId = `REQ-${new Date().getFullYear()}-${String(requests.length + 1).padStart(5, '0')}`;
  
  const now = new Date().toISOString();
  
  const historyEntry: RequestHistoryEntry = {
    action: "Request submitted",
    changedBy: session.name,
    date: now
  };

  const newRequest: CreativeRequest = {
    ...data,
    id: newId,
    status: "New",
    createdAt: now,
    updatedAt: now,
    history: [historyEntry]
  };

  requests.push(newRequest);
  await saveRequests(requests);
  
  return newRequest;
}

export async function updateRequestStatus(id: string, newStatus: RequestStatus) {
  const session = await getSession();
  if (!session || session.role === "Requester") {
    throw new Error("Unauthorized to change status");
  }

  const requests = await fetchRequests();
  const requestIndex = requests.findIndex(r => r.id === id);
  if (requestIndex === -1) throw new Error("Request not found");

  const req = requests[requestIndex];
  
  const now = new Date().toISOString();
  req.history.push({
    action: `Status changed to ${newStatus}`,
    changedBy: session.name,
    date: now
  });

  req.status = newStatus;
  req.updatedAt = now;

  await saveRequests(requests);
  return req;
}

export async function deleteRequest(id: string) {
  const session = await getSession();
  if (!session || session.role !== "Admin") {
    throw new Error("Only Admin can delete requests");
  }

  const requests = await fetchRequests();
  const updated = requests.filter(r => r.id !== id);
  await saveRequests(updated);
}

export async function editRequest(id: string, updates: Partial<CreativeRequest>) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const requests = await fetchRequests();
  const requestIndex = requests.findIndex(r => r.id === id);
  if (requestIndex === -1) throw new Error("Request not found");

  const req = requests[requestIndex];

  if (session.role === "Requester" && req.requesterId !== session.id) {
    throw new Error("Unauthorized to edit this request");
  }

  const now = new Date().toISOString();
  req.history.push({
    action: `Request edited`,
    changedBy: session.name,
    date: now
  });

  req.requestType = updates.requestType ?? req.requestType;
  req.title = updates.title ?? req.title;
  req.description = updates.description ?? req.description;
  req.dueDate = updates.dueDate ?? req.dueDate;
  req.content = updates.content ?? req.content;
  req.additionalInformation = updates.additionalInformation ?? req.additionalInformation;
  
  req.updatedAt = now;

  await saveRequests(requests);
  return req;
}
