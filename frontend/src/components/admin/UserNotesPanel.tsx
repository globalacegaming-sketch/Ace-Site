import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getApiBaseUrl } from '../../utils/api';

interface UserNote {
  _id: string;
  userId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface UserNotesPanelProps {
  userId: string;
  userName: string;
  isOpen: boolean;
  onClose: () => void;
  /** Which panel is calling – determines auth header */
  authType: 'session' | 'jwt';
}

const UserNotesPanel: React.FC<UserNotesPanelProps> = ({
  userId,
  userName,
  isOpen,
  onClose,
  authType,
}) => {
  const API_BASE_URL = getApiBaseUrl();
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [currentAgentId, setCurrentAgentId] = useState('');

  const getAuthHeaders = useCallback((): Record<string, string> => {
    if (authType === 'jwt') {
      const session = localStorage.getItem('agent_session');
      if (session) {
        try {
          const parsed = JSON.parse(session);
          if (parsed.token) return { Authorization: `Bearer ${parsed.token}` };
        } catch { /* ignore */ }
      }
    } else {
      // Session-based auth (AceAgent panel) – also pass the Bearer token
      // because the session cookie alone may not reach the notes route
      const session = localStorage.getItem('admin_session');
      if (session) {
        try {
          const parsed = JSON.parse(session);
          if (parsed.token) return { Authorization: `Bearer ${parsed.token}` };
        } catch { /* ignore */ }
      }
    }
    return {};
  }, [authType]);

  // Determine current agent ID from localStorage
  useEffect(() => {
    try {
      if (authType === 'jwt') {
        const session = localStorage.getItem('agent_session');
        if (session) {
          const parsed = JSON.parse(session);
          setCurrentAgentId(parsed.agentId || parsed.userId || '');
        }
      } else {
        const session = localStorage.getItem('admin_session');
        if (session) {
          const parsed = JSON.parse(session);
          setCurrentAgentId(parsed.adminId || '');
        }
      }
    } catch { /* ignore */ }
  }, [authType]);

  const fetchNotes = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/admin/notes/${userId}`, {
        headers: getAuthHeaders(),
        withCredentials: true,
      });
      if (res.data.success) {
        setNotes(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, API_BASE_URL, getAuthHeaders]);

  useEffect(() => {
    if (isOpen && userId) {
      fetchNotes();
    }
  }, [isOpen, userId, fetchNotes]);

  const handleAddNote = async () => {
    if (!newNote.trim() || saving) return;
    setSaving(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/admin/notes/${userId}`,
        { content: newNote.trim() },
        { headers: getAuthHeaders(), withCredentials: true }
      );
      if (res.data.success) {
        setNotes(prev => [res.data.data, ...prev]);
        setNewNote('');
      }
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleEditNote = async (noteId: string) => {
    if (!editContent.trim() || saving) return;
    setSaving(true);
    try {
      const res = await axios.put(
        `${API_BASE_URL}/admin/notes/${noteId}`,
        { content: editContent.trim() },
        { headers: getAuthHeaders(), withCredentials: true }
      );
      if (res.data.success) {
        setNotes(prev => prev.map(n => n._id === noteId ? res.data.data : n));
        setEditingId(null);
        setEditContent('');
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        alert('You can only edit your own notes.');
      }
      console.error('Failed to edit note:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      const res = await axios.delete(
        `${API_BASE_URL}/admin/notes/${noteId}`,
        { headers: getAuthHeaders(), withCredentials: true }
      );
      if (res.data.success) {
        setNotes(prev => prev.filter(n => n._id !== noteId));
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        alert('You can only delete your own notes.');
      }
      console.error('Failed to delete note:', err);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0f0f23] border border-white/10 rounded-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div>
            <h3 className="text-sm font-semibold text-white">Notes</h3>
            <p className="text-xs text-gray-400 mt-0.5">{userName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Add note */}
        <div className="p-3 border-b border-white/10">
          <textarea
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            placeholder="Add a private note..."
            rows={2}
            maxLength={2000}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-gray-500">{newNote.length}/2000</span>
            <button
              onClick={handleAddNote}
              disabled={!newNote.trim() || saving}
              className="px-3 py-1 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Add Note'}
            </button>
          </div>
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="h-3 bg-white/5 rounded w-1/3 mb-2" />
                  <div className="h-10 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-10 h-10 mx-auto text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <p className="text-xs text-gray-500">No notes yet</p>
            </div>
          ) : (
            notes.map(note => (
              <div
                key={note._id}
                className="bg-white/[0.03] border border-white/5 rounded-lg p-3 group hover:border-white/10 transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-blue-400">{note.authorName}</span>
                    <span className="text-[10px] text-gray-600">{formatTime(note.createdAt)}</span>
                    {note.createdAt !== note.updatedAt && (
                      <span className="text-[10px] text-gray-600 italic">(edited)</span>
                    )}
                  </div>
                  {(note.authorId === currentAgentId || true) && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {note.authorId === currentAgentId && (
                        <button
                          onClick={() => { setEditingId(note._id); setEditContent(note.content); }}
                          className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors"
                          title="Edit"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteNote(note._id)}
                        className="p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {editingId === note._id ? (
                  <div>
                    <textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50 resize-none"
                      rows={3}
                      maxLength={2000}
                    />
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        onClick={() => handleEditNote(note._id)}
                        disabled={!editContent.trim() || saving}
                        className="px-2 py-0.5 text-[10px] font-medium rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditContent(''); }}
                        className="px-2 py-0.5 text-[10px] font-medium rounded bg-white/5 hover:bg-white/10 text-gray-400 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default UserNotesPanel;
