import React, { useState, useEffect } from 'react';
import api from '../api';
import { CheckCircle2, Hourglass, Ticket, Clock, Trash2, XCircle, FileText, Hand, Bell, X } from 'lucide-react';

export default function NotificationsPanel({ onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/student/notifications');
      setNotifications(data.notifications);
    } catch (e) {} finally { setLoading(false); }
  };

  const markRead = async (id) => {
    try {
      await api.put(`/student/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch (e) {}
  };

  const markAllRead = async () => {
    try {
      await api.put('/student/notifications/all/read');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (e) {}
  };

  const getIcon = (type) => {
    switch (type) {
      case 'enrolled': return <CheckCircle2 size={18} color="var(--accent-emerald)" />;
      case 'waitlisted': return <Hourglass size={18} color="var(--accent-amber)" />;
      case 'waitlist_seat_reserved': return <Ticket size={18} color="var(--accent-indigo)" />;
      case 'waitlist_expired': return <Clock size={18} color="var(--accent-rose)" />;
      case 'dropped': return <Trash2 size={18} color="var(--accent-rose)" />;
      case 'request_approved': return <CheckCircle2 size={18} color="var(--accent-emerald)" />;
      case 'request_denied': return <XCircle size={18} color="var(--accent-rose)" />;
      case 'special_request': return <FileText size={18} color="var(--accent-cyan)" />;
      case 'welcome': return <Hand size={18} color="var(--accent-orange)" />;
      default: return <Bell size={18} color="var(--accent-primary)" />;
    }
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="notif-panel">
      <div className="notif-panel-header">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Notifications</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-xs" onClick={markAllRead}>Mark all read</button>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner"></div></div>
      ) : notifications.length === 0 ? (
        <div className="empty-state">
          <div className="icon"><Bell size={48} strokeWidth={1.5} /></div>
          <p>No notifications yet</p>
        </div>
      ) : (
        notifications.map(n => (
          <div
            key={n.id}
            className={`notif-item ${n.is_read ? '' : 'unread'}`}
            onClick={() => !n.is_read && markRead(n.id)}
          >
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.1rem' }}>{getIcon(n.type)}</span>
              <div>
                <div className="notif-msg">{n.message}</div>
                <div className="notif-time">{timeAgo(n.created_at)}</div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
