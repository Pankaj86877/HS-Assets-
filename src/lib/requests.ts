"use server";

import { CreativeRequest, RequestStatus, RequestHistoryEntry } from './types';
import { getSession } from './auth';
import { kv } from '@vercel/kv';

export async function fetchRequests(): Promise<CreativeRequest[]> {
  try {
    const ids = await kv.smembers('requests:index');
    if (ids && ids.length > 0) {
      const requests = await Promise.all(ids.map(id => kv.get<CreativeRequest>(`request:${id}`)));
      return requests.filter(Boolean) as CreativeRequest[];
    }
    
    return [];
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

// saveRequests is no longer used for array storage
// We keep this to avoid breaking code that relies on it locally, but it won't be used in production
// It will be removed entirely in the next step when we clean up local fallback.

export async function createRequest(data: Omit<CreativeRequest, "id" | "status" | "createdAt" | "updatedAt" | "history">): Promise<{success: boolean, data?: CreativeRequest, error?: string}> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Unauthorized" };

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

    await kv.set(`request:${newRequest.id}`, newRequest);
    await kv.sadd('requests:index', newRequest.id);
    
    return { success: true, data: newRequest };
  } catch (error: any) {
    return { success: false, error: error.message || String(error) };
  }
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

  await kv.set(`request:${req.id}`, req);
  return req;
}

export async function deleteRequest(id: string) {
  const session = await getSession();
  if (!session || session.role !== "Admin") {
    throw new Error("Only Admin can delete requests");
  }

  const requests = await fetchRequests();
  await kv.del(`request:${id}`);
  await kv.srem('requests:index', id);
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

  await kv.set(`request:${req.id}`, req);
  return req;
}
