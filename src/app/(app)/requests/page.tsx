"use client";

import { useEffect, useState } from "react";
import { Plus, Clock, CheckCircle2, AlertCircle, PlayCircle, XCircle } from "lucide-react";
import { fetchRequests, updateRequestStatus, createRequest, deleteRequest, editRequest } from "@/lib/requests";
import { CreativeRequest, RequestStatus, User } from "@/lib/types";
import { getSession } from "@/lib/auth";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

function RequestsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [requests, setRequests] = useState<CreativeRequest[]>([]);
  const [session, setSession] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<CreativeRequest | null>(null);

  // Form states
  const [requestType, setRequestType] = useState("Mailer");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [content, setContent] = useState("");
  const [additionalInformation, setAdditionalInformation] = useState("");

  useEffect(() => {
    async function load() {
      const user = await getSession();
      setSession(user);
      
      const data = await fetchRequests();
      let filteredData = data;
      if (user?.role === "Requester") {
        filteredData = data.filter(r => r.requesterId === user.id);
      }
      
      const STATUS_PRIORITY: Record<string, number> = {
        "New": 1,
        "Accepted": 2,
        "In Progress": 3,
        "Need More Information": 4,
        "Under Review": 5,
        "Completed": 6,
        "Cancelled": 7
      };

      filteredData.sort((a, b) => {
        if (STATUS_PRIORITY[a.status] !== STATUS_PRIORITY[b.status]) {
          return STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setRequests(filteredData);
      setIsLoading(false);

      const idParam = searchParams.get("id");
      if (idParam) {
        const found = filteredData.find(r => r.id === idParam);
        if (found) {
          setSelectedRequest(found);
          setIsDetailsOpen(true);
        }
      }
    }
    load();
  }, [searchParams]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    try {
      if (isEditing && selectedRequest) {
        const updated = await editRequest(selectedRequest.id, {
          requestType, title, description, dueDate, content, additionalInformation
        });
        setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
        setSelectedRequest(updated);
      } else {
        const res = await createRequest({
          requesterId: session.id,
          requesterName: session.name,
          requestType,
          title,
          description,
          dueDate,
          content,
          additionalInformation
        });
        
        if (!res.success || !res.data) {
          alert(`Failed to save request. Details: ${res.error}`);
          return;
        }
        
        setRequests([...requests, res.data]);
      }

      setIsFormOpen(false);
      setIsEditing(false);
      resetForm();
      router.refresh();
    } catch (error: any) {
      console.error(error);
      alert("An unexpected error occurred. Details: " + (error.message || error));
    }
  };

  const resetForm = () => {
    setRequestType("Mailer");
    setTitle("");
    setDescription("");
    setDueDate("");
    setContent("");
    setAdditionalInformation("");
    setIsEditing(false);
  };

  const handleUpdateStatus = async (id: string, status: RequestStatus) => {
    try {
      const updated = await updateRequestStatus(id, status);
      
      setRequests(prev => {
        const next = prev.map(r => r.id === id ? updated : r);
        // Re-sort
        const STATUS_PRIORITY: Record<string, number> = {
          "New": 1, "Accepted": 2, "In Progress": 3,
          "Need More Information": 4, "Under Review": 5,
          "Completed": 6, "Cancelled": 7
        };
        return [...next].sort((a, b) => {
          if (STATUS_PRIORITY[a.status] !== STATUS_PRIORITY[b.status]) {
            return STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      });

      if (selectedRequest?.id === id) {
        setSelectedRequest(updated);
      }
      router.refresh();
    } catch (error: any) {
      console.error(error);
      alert("Failed to update status. If deployed to Vercel, please ensure Vercel KV Storage is properly connected! Details: " + (error.message || error));
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this request? This action cannot be undone.")) return;
    try {
      await deleteRequest(id);
      setRequests(prev => prev.filter(r => r.id !== id));
      if (selectedRequest?.id === id) {
        setIsDetailsOpen(false);
        setSelectedRequest(null);
      }
      router.refresh();
    } catch (error: any) {
      console.error(error);
      alert("Failed to delete request. If deployed to Vercel, please ensure Vercel KV Storage is properly connected! Details: " + (error.message || error));
    }
  };

  const handleEditClick = (req: CreativeRequest) => {
    setIsEditing(true);
    setSelectedRequest(req);
    setRequestType(req.requestType);
    setTitle(req.title);
    setDescription(req.description);
    setDueDate(req.dueDate);
    setContent(req.content);
    setAdditionalInformation(req.additionalInformation || "");
    setIsFormOpen(true);
    setIsDetailsOpen(false);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading requests...</div>;
  }

  return (
    <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {session?.role === "Requester" ? "My Requests" : "Creative Requests"}
          </h1>
          <p className="text-slate-500">Manage and track creative design requests.</p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" /> Create New Request
        </button>
      </div>

      {session?.role !== "Requester" && (
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex gap-6 overflow-x-auto">
          <div className="flex-shrink-0">
            <span className="text-sm text-slate-500 block mb-1">All Requests</span>
            <span className="text-xl font-bold text-slate-900 dark:text-white">{requests.length}</span>
          </div>
          <div className="w-px bg-slate-200 dark:bg-slate-800"></div>
          <div className="flex-shrink-0">
            <span className="text-sm text-slate-500 block mb-1">New</span>
            <span className="text-xl font-bold text-blue-600">{requests.filter(r => r.status === "New").length}</span>
          </div>
          <div className="flex-shrink-0">
            <span className="text-sm text-slate-500 block mb-1">Accepted</span>
            <span className="text-xl font-bold text-indigo-600">{requests.filter(r => r.status === "Accepted").length}</span>
          </div>
          <div className="flex-shrink-0">
            <span className="text-sm text-slate-500 block mb-1">In Progress</span>
            <span className="text-xl font-bold text-amber-600">{requests.filter(r => r.status === "In Progress").length}</span>
          </div>
          <div className="flex-shrink-0">
            <span className="text-sm text-slate-500 block mb-1">Completed</span>
            <span className="text-xl font-bold text-emerald-600">{requests.filter(r => r.status === "Completed").length}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {requests.map(request => (
          <div 
            key={request.id} 
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 hover:shadow-lg transition-all cursor-pointer"
            onClick={() => { setSelectedRequest(request); setIsDetailsOpen(true); }}
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-500/10 px-2 py-1 rounded-md">
                {request.id}
              </span>
              <span className={`text-xs font-semibold px-2 py-1 rounded-md border ${getStatusColor(request.status)}`}>
                {request.status}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{request.title}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-4">{request.description}</p>
            
            <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" /> Due: {new Date(request.dueDate).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-bold">R</span>
                Req By: {request.requesterName}
              </div>
            </div>
          </div>
        ))}
        
        {requests.length === 0 && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <p className="text-slate-500">No requests found.</p>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{isEditing ? "Edit Request" : "Create New Request"}</h2>
              <button onClick={() => { setIsFormOpen(false); resetForm(); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateRequest} className="p-6 overflow-y-auto space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Request Type</label>
                <select 
                  value={requestType} onChange={e => setRequestType(e.target.value)} required
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  {["Mailer", "Social Media Post", "Presentation", "One-Pager", "Brochure", "Infographic", "Banner", "Video", "Motion Graphic", "GIF", "Website Creative", "Event Creative", "Internal Communication", "Other"].map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Request Title</label>
                <input 
                  type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Christmas Mailer"
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
                <textarea 
                  value={description} onChange={e => setDescription(e.target.value)} required rows={3}
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Due Date</label>
                <input 
                  type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Content</label>
                <textarea 
                  value={content} onChange={e => setContent(e.target.value)} required rows={4} placeholder="Headlines, Body copy, CTA..."
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Additional Information (Optional)</label>
                <textarea 
                  value={additionalInformation} onChange={e => setAdditionalInformation(e.target.value)} rows={3} placeholder="Format, audience, references..."
                  className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                <button type="button" onClick={() => { setIsFormOpen(false); resetForm(); }} className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors">{isEditing ? "Save Changes" : "Submit Request"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {isDetailsOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-sm font-semibold text-blue-600">{selectedRequest.id}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${getStatusColor(selectedRequest.status)}`}>{selectedRequest.status}</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedRequest.title}</h2>
              </div>
              <div className="flex items-center gap-4">
                {session?.role === "Admin" && (
                  <button onClick={() => handleDeleteRequest(selectedRequest.id)} className="text-red-500 hover:text-red-700 transition-colors font-medium text-sm">
                    Delete Request
                  </button>
                )}
                {session?.role === "Requester" && selectedRequest.requesterId === session?.id && (
                  <button onClick={() => handleEditClick(selectedRequest)} className="text-blue-500 hover:text-blue-700 transition-colors font-medium text-sm">
                    Edit Request
                  </button>
                )}
                <button onClick={() => setIsDetailsOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors ml-2">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-8 flex-1">
              <div className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <p className="text-slate-500 mb-1">Requested By</p>
                  <p className="font-medium">{selectedRequest.requesterName}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Due Date</p>
                  <p className="font-medium">{new Date(selectedRequest.dueDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Request Type</p>
                  <p className="font-medium">{selectedRequest.requestType}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div>
                  <p className="text-slate-500 mb-1">Created On</p>
                  <p className="font-medium">
                    {new Date(selectedRequest.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}, {new Date(selectedRequest.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Last Updated</p>
                  <p className="font-medium">
                    {selectedRequest.updatedAt === selectedRequest.createdAt ? "Not updated yet" : 
                     `${new Date(selectedRequest.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}, ${new Date(selectedRequest.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                    }
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Description</h3>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                  {selectedRequest.description}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Content</h3>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                  {selectedRequest.content}
                </div>
              </div>

              {selectedRequest.additionalInformation && (
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Additional Information</h3>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                    {selectedRequest.additionalInformation}
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Request History</h3>
                <div className="space-y-4">
                  {selectedRequest.history.map((h, i) => (
                    <div key={i} className="flex gap-4 text-sm relative">
                      {i !== selectedRequest.history.length - 1 && (
                        <div className="absolute left-[11px] top-6 bottom-[-16px] w-[2px] bg-slate-200 dark:bg-slate-700"></div>
                      )}
                      <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0 z-10">
                        <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{h.action}</p>
                        <p className="text-slate-500 text-xs mt-0.5">by {h.changedBy} on {new Date(h.date).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Admin/Marketing Status Controls */}
            {session?.role !== "Requester" && (
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Update Status:</span>
                <select 
                  value={selectedRequest.status}
                  onChange={(e) => handleUpdateStatus(selectedRequest.id, e.target.value as RequestStatus)}
                  className="border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900 text-sm font-medium"
                >
                  <option value="New">New</option>
                  <option value="Accepted">Accepted</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Need More Information">Need More Information</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getStatusColor(status: RequestStatus) {
  switch (status) {
    case "New": return "bg-blue-50 text-blue-700 border-blue-200";
    case "Accepted": return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "In Progress": return "bg-amber-50 text-amber-700 border-amber-200";
    case "Need More Information": return "bg-orange-50 text-orange-700 border-orange-200";
    case "Under Review": return "bg-purple-50 text-purple-700 border-purple-200";
    case "Completed": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Cancelled": return "bg-red-50 text-red-700 border-red-200";
    default: return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

export default function RequestsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading requests...</div>}>
      <RequestsContent />
    </Suspense>
  );
}
