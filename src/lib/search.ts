"use server";

import fs from 'fs/promises';
import path from 'path';
import Fuse from "fuse.js";
import { SearchResource } from "./types";
import { kv } from '@vercel/kv';

const fuseOptions = {
  keys: [
    { name: 'title', weight: 0.4 },
    { name: 'keywords', weight: 0.3 },
    { name: 'description', weight: 0.1 },
    { name: 'tags', weight: 0.1 },
    { name: 'category', weight: 0.1 }
  ],
  includeMatches: true,
  threshold: 0.4, 
  ignoreLocation: true, 
  useExtendedSearch: true,
};

const dataPath = path.join(process.cwd(), 'src/data/resources.json');
const docsDataPath = path.join(process.cwd(), 'src/data/documents.json');
const addressDataPath = path.join(process.cwd(), 'src/data/addresses.json');
const linksDataPath = path.join(process.cwd(), 'src/data/links.json');
const employeesDataPath = path.join(process.cwd(), 'src/data/employees.json');

// --- GOOGLE DRIVE FOLDERS ---
export async function fetchResources(): Promise<SearchResource[]> {
  try {
    const kvData = await kv.get<SearchResource[]>('resources:data');
    if (kvData) {
      return kvData.map(r => ({ ...r, type: r.type || "google-drive" }));
    }
    const data = await fs.readFile(dataPath, 'utf-8');
    const parsed = JSON.parse(data) as SearchResource[];
    return parsed.map(r => ({ ...r, type: r.type || "google-drive" }));
  } catch (error) {
    console.error("Error fetching resources:", error);
    return [];
  }
}

async function saveResources(resources: SearchResource[]) {
  try {
    await kv.set('resources:data', resources);
  } catch (e) {
    // If kv fails, attempt fs (for local dev without KV)
    await fs.writeFile(dataPath, JSON.stringify(resources, null, 2), 'utf-8');
  }
}

export async function addResource(resource: SearchResource) {
  const allResources = await fetchResources();
  const duplicate = allResources.find(
    (r) => r.title.toLowerCase() === resource.title.toLowerCase() || 
           (r.googleDriveLink && r.googleDriveLink === resource.googleDriveLink)
  );
  if (duplicate) throw new Error("This Google Drive folder already exists.");
  
  resource.type = "google-drive";
  allResources.push(resource);
  await saveResources(allResources);
}

export async function updateResource(id: string, updates: Partial<SearchResource>) {
  const allResources = await fetchResources();
  const index = allResources.findIndex((r) => r.id === id);
  if (index === -1) throw new Error("Resource not found");
  
  allResources[index] = { ...allResources[index], ...updates, updatedAt: new Date().toISOString() };
  await saveResources(allResources);
}

export async function deleteResource(id: string) {
  const allResources = await fetchResources();
  const filtered = allResources.filter((r) => r.id !== id);
  await saveResources(filtered);
}


// --- DOCUMENTS ---
export async function fetchDocuments(): Promise<SearchResource[]> {
  try {
    const data = await fs.readFile(docsDataPath, 'utf-8');
    const parsed = JSON.parse(data) as SearchResource[];
    // Patch existing records that might be missing the type
    return parsed.map(r => ({ ...r, type: r.type || "document" }));
  } catch (error) {
    console.error("Error reading documents.json:", error);
    return [];
  }
}

async function saveDocuments(docs: SearchResource[]) {
  await fs.writeFile(docsDataPath, JSON.stringify(docs, null, 2), 'utf-8');
}

export async function addDocument(doc: SearchResource) {
  const allDocs = await fetchDocuments();
  const duplicate = allDocs.find(
    (d) => d.title.toLowerCase() === doc.title.toLowerCase() || 
           (d.documentLink && d.documentLink === doc.documentLink)
  );
  if (duplicate) throw new Error("This document already exists.");
  
  doc.type = "document";
  allDocs.push(doc);
  await saveDocuments(allDocs);
}

export async function updateDocument(id: string, updates: Partial<SearchResource>) {
  const allDocs = await fetchDocuments();
  const index = allDocs.findIndex((d) => d.id === id);
  if (index === -1) throw new Error("Document not found");
  
  allDocs[index] = { ...allDocs[index], ...updates, updatedAt: new Date().toISOString() };
  await saveDocuments(allDocs);
}

export async function deleteDocument(id: string) {
  const allDocs = await fetchDocuments();
  const filtered = allDocs.filter((d) => d.id !== id);
  await saveDocuments(filtered);
}


// --- ADDRESSES ---
export async function fetchAddresses(): Promise<SearchResource[]> {
  try {
    const data = await fs.readFile(addressDataPath, 'utf-8');
    const parsed = JSON.parse(data) as SearchResource[];
    return parsed.map(r => ({ ...r, type: "address" }));
  } catch (error) {
    console.error("Error reading addresses.json:", error);
    return [];
  }
}

async function saveAddresses(addresses: SearchResource[]) {
  await fs.writeFile(addressDataPath, JSON.stringify(addresses, null, 2), 'utf-8');
}

export async function addAddress(address: SearchResource) {
  const allAddrs = await fetchAddresses();
  const duplicate = allAddrs.find(
    (a) => a.title.toLowerCase() === address.title.toLowerCase() || 
           a.gstin === address.gstin ||
           a.address?.toLowerCase() === address.address?.toLowerCase()
  );
  if (duplicate) throw new Error("This address already exists.");
  
  address.type = "address";
  allAddrs.push(address);
  await saveAddresses(allAddrs);
}

export async function updateAddress(id: string, updates: Partial<SearchResource>) {
  const allAddrs = await fetchAddresses();
  const index = allAddrs.findIndex((a) => a.id === id);
  if (index === -1) throw new Error("Address not found");
  
  allAddrs[index] = { ...allAddrs[index], ...updates, updatedAt: new Date().toISOString() };
  await saveAddresses(allAddrs);
}

export async function deleteAddress(id: string) {
  const allAddrs = await fetchAddresses();
  const filtered = allAddrs.filter((a) => a.id !== id);
  await saveAddresses(filtered);
}

// --- LINKS ---
export async function fetchLinks(): Promise<SearchResource[]> {
  try {
    const data = await fs.readFile(linksDataPath, 'utf-8');
    const parsed = JSON.parse(data) as SearchResource[];
    return parsed.map(r => ({ ...r, type: "link" }));
  } catch (error) {
    console.error("Error reading links.json:", error);
    return [];
  }
}

async function saveLinks(links: SearchResource[]) {
  await fs.writeFile(linksDataPath, JSON.stringify(links, null, 2), 'utf-8');
}

export async function addLink(link: SearchResource) {
  const allLinks = await fetchLinks();
  const duplicate = allLinks.find(
    (l) => l.title.toLowerCase() === link.title.toLowerCase() || 
           l.websiteLink === link.websiteLink
  );
  if (duplicate) throw new Error("This link already exists.");
  
  link.type = "link";
  allLinks.push(link);
  await saveLinks(allLinks);
}

export async function updateLink(id: string, updates: Partial<SearchResource>) {
  const allLinks = await fetchLinks();
  const index = allLinks.findIndex((l) => l.id === id);
  if (index === -1) throw new Error("Link not found");
  
  allLinks[index] = { ...allLinks[index], ...updates, updatedAt: new Date().toISOString() };
  await saveLinks(allLinks);
}

export async function deleteLink(id: string) {
  const allLinks = await fetchLinks();
  const filtered = allLinks.filter((l) => l.id !== id);
  await saveLinks(filtered);
}

// --- EMPLOYEES ---
export async function fetchEmployees(): Promise<SearchResource[]> {
  try {
    const data = await fs.readFile(employeesDataPath, 'utf-8');
    const parsed = JSON.parse(data) as SearchResource[];
    return parsed.map(r => ({ ...r, type: "employee" }));
  } catch (error) {
    console.error("Error reading employees.json:", error);
    return [];
  }
}

async function saveEmployees(employees: SearchResource[]) {
  await fs.writeFile(employeesDataPath, JSON.stringify(employees, null, 2), 'utf-8');
}

export async function addEmployee(employee: SearchResource) {
  const allEmps = await fetchEmployees();
  
  // Transform linkedin ID to URL if it doesn't start with http
  if (employee.linkedinUrl && !employee.linkedinUrl.startsWith("http")) {
    employee.linkedinUrl = `https://www.linkedin.com/in/${employee.linkedinUrl}`;
  }

  const duplicate = allEmps.find(
    (e) => e.title.toLowerCase() === employee.title.toLowerCase() || 
           (e.linkedinUrl && e.linkedinUrl === employee.linkedinUrl)
  );
  if (duplicate) throw new Error("This employee already exists.");
  
  employee.type = "employee";
  allEmps.push(employee);
  await saveEmployees(allEmps);
}

export async function updateEmployee(id: string, updates: Partial<SearchResource>) {
  const allEmps = await fetchEmployees();
  
  if (updates.linkedinUrl && !updates.linkedinUrl.startsWith("http")) {
    updates.linkedinUrl = `https://www.linkedin.com/in/${updates.linkedinUrl}`;
  }

  const index = allEmps.findIndex((e) => e.id === id);
  if (index === -1) throw new Error("Employee not found");
  
  allEmps[index] = { ...allEmps[index], ...updates, updatedAt: new Date().toISOString() };
  await saveEmployees(allEmps);
}

export async function deleteEmployee(id: string) {
  const allEmps = await fetchEmployees();
  const filtered = allEmps.filter((e) => e.id !== id);
  await saveEmployees(filtered);
}


// --- SEARCH SYSTEM ---
export async function searchResources(query: string, category: string = "Google Drive"): Promise<SearchResource[]> {
  let filtered: SearchResource[] = [];
  
  if (category === "Google Drive") {
    const data = await fetchResources();
    filtered = data.filter(r => r.type === "google-drive" || r.category === "Google Drive");
  } else if (category === "Documents") {
    const data = await fetchDocuments();
    filtered = data.filter(r => r.type === "document" || r.category === "Documents");
  } else if (category === "Address") {
    filtered = await fetchAddresses();
  } else if (category === "Links") {
    filtered = await fetchLinks();
  } else if (category === "Employee") {
    filtered = await fetchEmployees();
  }

  if (!query.trim()) {
    return filtered;
  }

  const fuse = new Fuse(filtered, fuseOptions);
  const results = fuse.search(query);
  return results.map(result => result.item);
}
