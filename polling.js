/**
 * HTTPPolling - Vanilla JavaScript polling manager with multi-tab coordination
 *
 * Features:
 * - Safe polling with no memory leaks
 * - Multi-tab coordination (only one tab polls at a time)
 * - Automatic leader election
 * - AbortController support
 * - Event-based callbacks
 * - Graceful cleanup
 *
 * @version 1.0.0
 */

class HTTPPolling {
  constructor(options = {}) {
    // Configuration
    this.url = options.url || '';
    this.interval = options.interval || 5000;
    this.fetchOptions = options.fetchOptions || {};
    this.tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.leaderKey = options.leaderKey || 'polling_leader';
    this.dataKey = options.dataKey || 'polling_data';
    this.stateKey = options.stateKey || 'polling_state';
    this.heartbeatInterval = options.heartbeatInterval || 2000;
    this.leaderTimeout = options.leaderTimeout || 5000;

    // State
    this.isPolling = false;
    this.isLeaderTab = false;
    this.currentAbortController = null;
    this.pollingTimeoutId = null;
    this.heartbeatIntervalId = null;
    this.leaderCheckIntervalId = null;
    this.isRequestInProgress = false;

    // Callbacks
    this.dataCallbacks = [];
    this.errorCallbacks = [];
    this.leaderChangeCallbacks = [];

    // Multi-tab communication
    this.broadcastChannel = null;
    this.boundStorageHandler = null;
    this.boundBeforeUnloadHandler = null;
    this.boundVisibilityChangeHandler = null;

    // Initialize multi-tab support
    this._initMultiTabSupport();
  }

  /**
   * Initialize multi-tab coordination
   */
  _initMultiTabSupport() {
    // Try BroadcastChannel first (modern browsers)
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel('http_polling_channel');
        this.broadcastChannel.onmessage = (event) => this._handleBroadcastMessage(event);
      } catch (e) {
        console.warn('BroadcastChannel not available, falling back to localStorage');
        this.broadcastChannel = null;
      }
    }

    // localStorage fallback for cross-tab communication
    this.boundStorageHandler = (event) => this._handleStorageEvent(event);
    window.addEventListener('storage', this.boundStorageHandler);

    // Cleanup on tab close
    this.boundBeforeUnloadHandler = () => this._handleBeforeUnload();
    window.addEventListener('beforeunload', this.boundBeforeUnloadHandler);

    // Handle visibility change
    this.boundVisibilityChangeHandler = () => this._handleVisibilityChange();
    document.addEventListener('visibilitychange', this.boundVisibilityChangeHandler);

    // Sync initial polling state from localStorage
    const pollingState = this._getPollingState();
    if (pollingState && pollingState.isPolling) {
      this.isPolling = true;
    }

    // Start leader election
    this._startLeaderElection();
  }

  /**
   * Start leader election process
   */
  _startLeaderElection() {
    // Try to become leader
    this._tryBecomeLeader();

    // Periodically check if we should become leader
    this.leaderCheckIntervalId = setInterval(() => {
      if (!this.isLeaderTab) {
        this._checkLeaderHealth();
      }
    }, this.heartbeatInterval);
  }

  /**
   * Try to become the leader tab
   */
  _tryBecomeLeader() {
    const now = Date.now();
    const currentLeader = this._getLeaderInfo();

    // If no leader or leader is stale, become leader
    if (!currentLeader || (now - currentLeader.timestamp) > this.leaderTimeout) {
      this._becomeLeader();
      return true;
    }

    return false;
  }

  /**
   * Become the leader tab
   */
  _becomeLeader() {
    const wasLeader = this.isLeaderTab;
    this.isLeaderTab = true;

    // Write leader info to localStorage
    this._setLeaderInfo({
      tabId: this.tabId,
      timestamp: Date.now()
    });

    // Broadcast leadership
    this._broadcast({
      type: 'leader_elected',
      tabId: this.tabId,
      timestamp: Date.now()
    });

    // Start heartbeat
    this._startHeartbeat();

    // Notify callbacks if leadership changed
    if (!wasLeader) {
      this._notifyLeaderChange(true);

      // Start polling if it was enabled
      if (this.isPolling) {
        this._startPollingLoop();
      }
    }
  }

  /**
   * Resign from being leader
   */
  _resignLeadership() {
    const wasLeader = this.isLeaderTab;
    this.isLeaderTab = false;

    // Stop heartbeat
    this._stopHeartbeat();

    // Stop polling loop
    this._stopPollingLoop();

    // Clear leader info if we're the current leader
    const currentLeader = this._getLeaderInfo();
    if (currentLeader && currentLeader.tabId === this.tabId) {
      localStorage.removeItem(this.leaderKey);
    }

    // Broadcast resignation
    this._broadcast({
      type: 'leader_resigned',
      tabId: this.tabId,
      timestamp: Date.now()
    });

    // Notify callbacks if leadership changed
    if (wasLeader) {
      this._notifyLeaderChange(false);
    }
  }

  /**
   * Start sending heartbeat signals
   */
  _startHeartbeat() {
    this._stopHeartbeat();

    this.heartbeatIntervalId = setInterval(() => {
      if (this.isLeaderTab) {
        this._setLeaderInfo({
          tabId: this.tabId,
          timestamp: Date.now()
        });

        this._broadcast({
          type: 'heartbeat',
          tabId: this.tabId,
          timestamp: Date.now()
        });
      }
    }, this.heartbeatInterval);
  }

  /**
   * Stop sending heartbeat signals
   */
  _stopHeartbeat() {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  /**
   * Check if current leader is still alive
   */
  _checkLeaderHealth() {
    const currentLeader = this._getLeaderInfo();
    const now = Date.now();

    // If leader is stale, try to become leader
    if (!currentLeader || (now - currentLeader.timestamp) > this.leaderTimeout) {
      this._tryBecomeLeader();
    }
  }

  /**
   * Get current leader info from localStorage
   */
  _getLeaderInfo() {
    try {
      const data = localStorage.getItem(this.leaderKey);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Set leader info to localStorage
   */
  _setLeaderInfo(info) {
    try {
      localStorage.setItem(this.leaderKey, JSON.stringify(info));
    } catch (e) {
      console.error('Failed to set leader info:', e);
    }
  }

  /**
   * Get polling state from localStorage
   */
  _getPollingState() {
    try {
      const data = localStorage.getItem(this.stateKey);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Set polling state to localStorage
   */
  _setPollingState(state) {
    try {
      localStorage.setItem(this.stateKey, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to set polling state:', e);
    }
  }

  /**
   * Broadcast message to other tabs
   */
  _broadcast(message) {
    // Use BroadcastChannel if available
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(message);
      } catch (e) {
        console.error('Failed to broadcast message:', e);
      }
    }

    // Also use localStorage as fallback
    try {
      const key = `broadcast_${Date.now()}_${Math.random()}`;
      localStorage.setItem(key, JSON.stringify(message));
      // Clean up immediately
      setTimeout(() => localStorage.removeItem(key), 100);
    } catch (e) {
      console.error('Failed to broadcast via localStorage:', e);
    }
  }

  /**
   * Handle BroadcastChannel messages
   */
  _handleBroadcastMessage(event) {
    const message = event.data;
    this._processBroadcastMessage(message);
  }

  /**
   * Handle localStorage storage events
   */
  _handleStorageEvent(event) {
    // Ignore non-broadcast keys
    if (!event.key || !event.key.startsWith('broadcast_')) {
      // Check if leader info changed
      if (event.key === this.leaderKey) {
        this._checkLeaderHealth();
      }
      // Check if data was shared
      if (event.key === this.dataKey && event.newValue) {
        try {
          const data = JSON.parse(event.newValue);
          this._notifyData(data);
        } catch (e) {
          console.error('Failed to parse shared data:', e);
        }
      }
      return;
    }

    // Parse broadcast message
    try {
      const message = JSON.parse(event.newValue);
      this._processBroadcastMessage(message);
    } catch (e) {
      console.error('Failed to parse broadcast message:', e);
    }
  }

  /**
   * Process broadcast messages
   */
  _processBroadcastMessage(message) {
    if (!message || message.tabId === this.tabId) {
      return; // Ignore our own messages
    }

    switch (message.type) {
      case 'leader_elected':
        // Another tab became leader
        if (this.isLeaderTab && message.timestamp > Date.now() - 1000) {
          // Resign if another tab just became leader
          this._resignLeadership();
        }
        break;

      case 'heartbeat':
        // Leader is alive, update timestamp
        if (!this.isLeaderTab) {
          this._setLeaderInfo({
            tabId: message.tabId,
            timestamp: message.timestamp
          });
        }
        break;

      case 'data':
        // Received data from leader
        if (!this.isLeaderTab) {
          this._notifyData(message.data);
        }
        break;

      case 'error':
        // Received error from leader
        if (!this.isLeaderTab) {
          this._notifyError(message.error);
        }
        break;

      case 'leader_resigned':
        // Leader resigned, try to become leader
        if (!this.isLeaderTab) {
          setTimeout(() => this._tryBecomeLeader(), 100);
        }
        break;

      case 'start_polling':
        // Another tab started polling, sync state
        if (!this.isPolling) {
          this.isPolling = true;
          // If we're the leader, start polling loop
          if (this.isLeaderTab) {
            this._startPollingLoop();
          }
        }
        break;

      case 'stop_polling':
        // Another tab stopped polling, sync state
        if (this.isPolling) {
          this.isPolling = false;
          this._stopPollingLoop();
        }
        break;
    }
  }

  /**
   * Handle tab close
   */
  _handleBeforeUnload() {
    if (this.isLeaderTab) {
      this._resignLeadership();
    }
    this.destroy();
  }

  /**
   * Handle visibility change
   */
  _handleVisibilityChange() {
    if (document.hidden) {
      // Tab is hidden
      if (this.isLeaderTab && this.isPolling) {
        // Continue polling but maybe reduce frequency
        // For now, keep same behavior
      }
    } else {
      // Tab is visible
      if (!this.isLeaderTab) {
        // Check if we should become leader
        this._checkLeaderHealth();
      }
    }
  }

  /**
   * Start the polling loop
   */
  _startPollingLoop() {
    this._stopPollingLoop();

    const poll = async () => {
      // Only leader should poll
      if (!this.isLeaderTab || !this.isPolling) {
        return;
      }

      // Don't start new request if one is in progress
      if (this.isRequestInProgress) {
        // Schedule next poll
        this.pollingTimeoutId = setTimeout(poll, this.interval);
        return;
      }

      try {
        this.isRequestInProgress = true;

        // Create abort controller
        this.currentAbortController = new AbortController();

        // Make request
        const response = await fetch(this.url, {
          ...this.fetchOptions,
          signal: this.currentAbortController.signal
        });

        // Check if still leader
        if (!this.isLeaderTab || !this.isPolling) {
          return;
        }

        // Parse response
        let data;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }

        // Notify all tabs
        this._notifyData(data);

        // Broadcast to other tabs
        this._broadcast({
          type: 'data',
          data: data,
          timestamp: Date.now()
        });

        // Share via localStorage for persistent storage
        try {
          localStorage.setItem(this.dataKey, JSON.stringify(data));
        } catch (e) {
          // Ignore localStorage errors
        }

      } catch (error) {
        // Check if error is due to abort
        if (error.name === 'AbortError') {
          // Request was aborted, this is expected
          return;
        }

        // Notify about error
        this._notifyError(error);

        // Broadcast error to other tabs
        this._broadcast({
          type: 'error',
          error: {
            message: error.message,
            name: error.name
          },
          timestamp: Date.now()
        });

      } finally {
        this.isRequestInProgress = false;
        this.currentAbortController = null;

        // Schedule next poll
        if (this.isLeaderTab && this.isPolling) {
          this.pollingTimeoutId = setTimeout(poll, this.interval);
        }
      }
    };

    // Start first poll immediately
    poll();
  }

  /**
   * Stop the polling loop
   */
  _stopPollingLoop() {
    // Clear timeout
    if (this.pollingTimeoutId) {
      clearTimeout(this.pollingTimeoutId);
      this.pollingTimeoutId = null;
    }

    // Abort current request
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }

    this.isRequestInProgress = false;
  }

  /**
   * Notify data callbacks
   */
  _notifyData(data) {
    this.dataCallbacks.forEach(callback => {
      try {
        callback(data);
      } catch (e) {
        console.error('Error in data callback:', e);
      }
    });
  }

  /**
   * Notify error callbacks
   */
  _notifyError(error) {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (e) {
        console.error('Error in error callback:', e);
      }
    });
  }

  /**
   * Notify leader change callbacks
   */
  _notifyLeaderChange(isLeader) {
    this.leaderChangeCallbacks.forEach(callback => {
      try {
        callback(isLeader);
      } catch (e) {
        console.error('Error in leader change callback:', e);
      }
    });
  }

  /**
   * PUBLIC API
   */

  /**
   * Start polling
   */
  startPolling() {
    if (this.isPolling) {
      return;
    }

    if (!this.url) {
      throw new Error('URL is required to start polling');
    }

    this.isPolling = true;

    // Save state to localStorage
    this._setPollingState({ isPolling: true });

    // Broadcast to other tabs
    this._broadcast({
      type: 'start_polling',
      tabId: this.tabId,
      timestamp: Date.now()
    });

    // If we're the leader, start polling immediately
    if (this.isLeaderTab) {
      this._startPollingLoop();
    }
  }

  /**
   * Stop polling
   */
  stopPolling() {
    this.isPolling = false;
    this._stopPollingLoop();

    // Save state to localStorage
    this._setPollingState({ isPolling: false });

    // Broadcast to other tabs
    this._broadcast({
      type: 'stop_polling',
      tabId: this.tabId,
      timestamp: Date.now()
    });
  }

  /**
   * Check if this tab is the leader
   */
  isLeader() {
    return this.isLeaderTab;
  }

  /**
   * Register data callback
   */
  onData(callback) {
    if (typeof callback === 'function') {
      this.dataCallbacks.push(callback);
    }

    // Return unsubscribe function
    return () => {
      const index = this.dataCallbacks.indexOf(callback);
      if (index > -1) {
        this.dataCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Register error callback
   */
  onError(callback) {
    if (typeof callback === 'function') {
      this.errorCallbacks.push(callback);
    }

    // Return unsubscribe function
    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index > -1) {
        this.errorCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Register leader change callback
   */
  onLeaderChange(callback) {
    if (typeof callback === 'function') {
      this.leaderChangeCallbacks.push(callback);
    }

    // Return unsubscribe function
    return () => {
      const index = this.leaderChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.leaderChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Update polling configuration
   */
  configure(options = {}) {
    if (options.url !== undefined) {
      this.url = options.url;
    }
    if (options.interval !== undefined) {
      this.interval = options.interval;
      // Restart polling if active
      if (this.isPolling && this.isLeaderTab) {
        this._stopPollingLoop();
        this._startPollingLoop();
      }
    }
    if (options.fetchOptions !== undefined) {
      this.fetchOptions = options.fetchOptions;
    }
  }

  /**
   * Get last data from localStorage
   */
  getLastData() {
    try {
      const data = localStorage.getItem(this.dataKey);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Clean up and destroy instance
   */
  destroy() {
    // Stop polling
    this.stopPolling();

    // Resign leadership
    if (this.isLeaderTab) {
      this._resignLeadership();
    }

    // Clear all intervals
    if (this.leaderCheckIntervalId) {
      clearInterval(this.leaderCheckIntervalId);
      this.leaderCheckIntervalId = null;
    }

    this._stopHeartbeat();

    // Close broadcast channel
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }

    // Remove event listeners
    if (this.boundStorageHandler) {
      window.removeEventListener('storage', this.boundStorageHandler);
      this.boundStorageHandler = null;
    }

    if (this.boundBeforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.boundBeforeUnloadHandler);
      this.boundBeforeUnloadHandler = null;
    }

    if (this.boundVisibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.boundVisibilityChangeHandler);
      this.boundVisibilityChangeHandler = null;
    }

    // Clear callbacks
    this.dataCallbacks = [];
    this.errorCallbacks = [];
    this.leaderChangeCallbacks = [];
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HTTPPolling;
}

if (typeof window !== 'undefined') {
  window.HTTPPolling = HTTPPolling;
}
