(() => {
  const NOTIFICATION_POLL_INTERVAL = 5000;
  let notifications = [];
  let unreadCount = 0;
  let socket = null;

  function initializeSocket() {
    socket = io();

    socket.on('connect', () => {
      console.log('[Notifications] Connected to server');
      loadNotifications();
    });

    socket.on('new_notification', (notification) => {
      console.log('[Notifications] New notification received:', notification);
      if (notification) {
        notifications.unshift(notification);
        unreadCount++;
        updateNotificationUI();
        console.log('[Notifications] UI updated. Total notifications:', notifications.length);
      } else {
        console.error('[Notifications] Received null notification');
      }
    });

    socket.on('disconnect', () => {
      console.log('[Notifications] Disconnected from server');
    });
    
    socket.on('connect_error', (error) => {
      console.error('[Notifications] Connection error:', error);
    });
  }

  function loadNotifications() {
    console.log('[Notifications] Loading notifications from server...');
    fetch('/notifications')
      .then(res => res.json())
      .then(data => {
        notifications = data || [];
        unreadCount = notifications.filter(n => !n.is_read).length;
        console.log('[Notifications] Loaded', notifications.length, 'notifications. Unread count:', unreadCount);
        updateNotificationUI();
      })
      .catch(err => console.error('[Notifications] Error loading notifications:', err));
  }

  function updateNotificationUI() {
    console.log('[Notifications] Updating UI. Total notifications:', notifications.length, 'Unread:', unreadCount);
    
    const badgeEl = document.getElementById('notification-badge');
    const listEl = document.getElementById('notification-list');
    const footerEl = document.getElementById('notification-footer');

    if (badgeEl) {
      if (unreadCount > 0) {
        badgeEl.classList.remove('hidden');
        badgeEl.textContent = unreadCount > 99 ? '99+' : unreadCount;
        console.log('[Notifications] Badge updated to:', badgeEl.textContent);
      } else {
        badgeEl.classList.add('hidden');
      }
    }

    if (listEl) {
      if (notifications.length === 0) {
        console.log('[Notifications] No notifications to display');
        listEl.innerHTML = '<div class="notification-empty">No notifications yet</div>';
        if (footerEl) footerEl.style.display = 'none';
      } else {
        console.log('[Notifications] Rendering', notifications.length, 'notifications');
        listEl.innerHTML = notifications
          .map(notification => `
            <div class="notification-item ${notification.is_read ? '' : 'unread'}" data-id="${notification.notification_id}">
              <div class="notification-item-content">
                <div class="notification-item-message">${escapeHtml(notification.message)}</div>
                <div class="notification-item-time">${formatTime(notification.created_at)}</div>
              </div>
            </div>
          `)
          .join('');

        if (footerEl && unreadCount > 0) {
          footerEl.style.display = 'block';
        }

        addNotificationItemListeners();
      }
    }
  }

  function formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString();
  }

  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  function addNotificationItemListeners() {
    const items = document.querySelectorAll('.notification-item');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        markAsRead(id);
      });
    });
  }

  function markAsRead(notificationId) {
    fetch(`/notifications/${notificationId}/read`, { method: 'PUT' })
      .then(() => {
        const notification = notifications.find(n => n.notification_id == notificationId);
        if (notification && !notification.is_read) {
          notification.is_read = 1;
          unreadCount--;
          updateNotificationUI();
        }
      })
      .catch(err => console.error('Error marking notification as read:', err));
  }

  function markAllAsRead() {
    const unreadNotifications = notifications.filter(n => !n.is_read);
    if (unreadNotifications.length === 0) return;

    Promise.all(unreadNotifications.map(n => 
      fetch(`/notifications/${n.notification_id}/read`, { method: 'PUT' })
    ))
      .then(() => {
        notifications.forEach(n => n.is_read = 1);
        unreadCount = 0;
        updateNotificationUI();
      })
      .catch(err => console.error('Error marking all as read:', err));
  }

  function setupEventListeners() {
    const markAllReadBtn = document.getElementById('mark-all-read');

    if (markAllReadBtn) {
      markAllReadBtn.addEventListener('click', markAllAsRead);
    }
  }

  function init() {
    console.log('[Notifications] Initializing notification system...');
    setupEventListeners();
    initializeSocket();
    console.log('[Notifications] Starting polling interval every', NOTIFICATION_POLL_INTERVAL, 'ms');

    setInterval(loadNotifications, NOTIFICATION_POLL_INTERVAL);
  }

  if (document.readyState === 'loading') {
    console.log('[Notifications] DOM still loading, waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', init);
  } else {
    console.log('[Notifications] DOM already loaded, initializing immediately');
    init();
  }
})();
