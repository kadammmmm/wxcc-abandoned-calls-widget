import { LitElement, html, css } from 'lit';
import { Desktop } from '@wxcc-desktop/sdk';

/**
 * Abandoned Call Callback Widget for Webex Contact Center
 *
 * Polls the WxCC Search API directly — no backend server required.
 * Cross-references outbound calls to detect already-handled abandons.
 */
class CallbackWidget extends LitElement {
  static properties = {
    callbacks:           { type: Array },
    loading:             { type: Boolean },
    error:               { type: String },
    agentId:             { type: String },
    agentState:          { type: String },
    dialingId:           { type: String },
    showCalledBack:      { type: Boolean },
    // Layout-configurable
    datacenter:          { type: String },                                        // us1 | eu1 | eu2 | anz1 | ca1 | jp1 | sg1
    lookbackMinutes:     { type: Number, attribute: 'lookback-minutes' },         // default 480 (8h)
    pollIntervalSeconds: { type: Number, attribute: 'poll-interval-seconds' },    // default 30
    accessToken:         { type: String, attribute: 'access-token' },
    outdialEp:           { type: String, attribute: 'outdial-ep' },
    outdialAni:          { type: String, attribute: 'outdial-ani' },
    outdialAniList:      { type: Array,  attribute: 'outdial-ani-list' },
    selectedAni:         { type: String },
    showAniSelector:     { type: Boolean },
    searchQuery:         { type: String },
    priorityWarningMins: { type: Number, attribute: 'priority-warning-mins' },
    priorityCriticalMins:{ type: Number, attribute: 'priority-critical-mins' }
  };

  static styles = css`
    :host {
      display: block;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: #0f172a;
      height: 100%;

      /* Primary palette — matches Call Selector */
      --primary-color:  #1a4b7a;
      --primary-hover:  #143a61;

      /* Urgency */
      --success-color:  #16a34a;
      --warning-color:  #d97706;
      --danger-color:   #e31937;

      /* Surfaces */
      --bg-root:        #f0f4f8;
      --bg-color:       #ffffff;
      --bg-secondary:   #f0f4f8;
      --bg-hover:       #f0f4f8;

      /* Borders & text */
      --border-color:   #dde3ea;
      --text-color:     #0f172a;
      --text-muted:     #94a3b8;
      --text-secondary: #475569;

      /* Misc */
      --radius:         8px;
      --shadow-sm:      0 1px 2px rgba(0,0,0,0.05);
      --shadow:         0 4px 14px rgba(0,0,0,0.08);
      --transition:     150ms ease;
    }

    :host([darkmode="true"]) {
      --primary-color:  #1e3a5f;
      --primary-hover:  #162d4a;
      --bg-root:        #0f1923;
      --bg-color:       #1a2535;
      --bg-secondary:   #0f1923;
      --bg-hover:       #1f2f42;
      --border-color:   #2a3a4e;
      --text-color:     #e8edf3;
      --text-muted:     #4d6a85;
      --text-secondary: #8fa5be;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    .panel-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--bg-root);
    }

    /* Header — navy bar, matches Call Selector */
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: var(--primary-color);
      flex-shrink: 0;
    }

    .header-left {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .header-title {
      font-size: 15px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.3px;
      line-height: 1.2;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .live-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
      color: rgba(255,255,255,0.85);
      letter-spacing: 0.5px;
    }

    .live-dot {
      width: 8px;
      height: 8px;
      background: var(--success-color);
      border-radius: 50%;
      animation: pulse-live 2s ease-in-out infinite;
    }

    @keyframes pulse-live {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(0.85); }
    }

    /* Stats bar */
    .stats-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: var(--bg-color);
      border-bottom: 1px solid var(--border-color);
      flex-wrap: wrap;
      flex-shrink: 0;
    }

    .stat-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      border: none;
      cursor: default;
    }

    .stat-pill.pending  { background: rgba(22,163,74,0.12);  color: var(--success-color); }
    .stat-pill.claimed  { background: rgba(26,75,122,0.12);  color: var(--primary-color); }
    .stat-pill.warning  { background: rgba(217,119,6,0.12);  color: var(--warning-color); }
    .stat-pill.critical { background: rgba(227,25,55,0.10);  color: var(--danger-color); }
    .stat-pill.neutral  { background: var(--bg-secondary);   color: var(--text-muted); }

    .stat-pill-count {
      background: rgba(0,0,0,0.1);
      padding: 0 5px;
      border-radius: 8px;
      font-size: 10px;
      font-weight: 700;
    }

    /* Version footer */
    .panel-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 7px 14px;
      border-top: 1px solid var(--border-color);
      font-size: 10px;
      color: var(--text-muted);
      background: var(--bg-color);
      flex-shrink: 0;
    }

    .refresh-info {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .refresh-info svg { width: 12px; height: 12px; }

    .header-icon, .header-actions { display: none; }

    /* Callback list */
    .callback-list {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    /* Callback card — left-border priority pattern, matches Call Selector */
    .callback-card {
      background: var(--bg-color);
      border: 1px solid var(--border-color);
      border-left: 4px solid var(--border-color);
      border-radius: var(--radius);
      padding: 14px;
      box-shadow: var(--shadow-sm);
      transition: box-shadow var(--transition);
    }

    .callback-card:hover { box-shadow: var(--shadow); }

    .callback-card.priority-normal  { border-left-color: var(--success-color); }
    .callback-card.priority-warning { border-left-color: var(--warning-color); }
    .callback-card.priority-critical {
      border-left-color: var(--danger-color);
      animation: pulse-border 2s ease-in-out infinite;
    }

    @keyframes pulse-border {
      0%, 100% { border-left-color: var(--danger-color); }
      50%       { border-left-color: rgba(227,25,55,0.35); }
    }

    .callback-card.called-back       { opacity: 0.55; border-left-color: var(--text-muted) !important; }
    .card-status.called-back         { background: var(--bg-secondary); color: var(--text-muted); }

    .toggle-called-back-btn {
      font-size: 11px; padding: 3px 10px; border-radius: 10px;
      border: 1px solid var(--border-color); background: transparent;
      color: var(--text-muted); cursor: pointer; margin-left: auto;
      transition: background 0.15s, color 0.15s; white-space: nowrap;
    }
    .toggle-called-back-btn.active {
      background: rgba(22,163,74,0.12); color: var(--success-color);
      border-color: var(--success-color);
    }

    .card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 10px;
    }

    .caller-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .caller-avatar {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--primary-color);
      border-radius: 50%;
      color: white;
      flex-shrink: 0;
    }

    .caller-avatar svg { width: 20px; height: 20px; }

    .caller-details { display: flex; flex-direction: column; gap: 4px; }

    .caller-ani {
      font-size: 15px;
      font-weight: 700;
      color: var(--text-color);
      letter-spacing: 0.2px;
    }

    .caller-meta { display: flex; flex-wrap: wrap; gap: 6px; }

    .meta-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 7px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      color: var(--text-secondary);
    }

    .meta-tag.queue { background: rgba(26,75,122,0.08); color: var(--primary-color); border-color: rgba(26,75,122,0.15); }
    .meta-tag.time  { background: rgba(217,119,6,0.08);  color: var(--warning-color);  border-color: rgba(217,119,6,0.15); }
    .meta-tag svg   { width: 11px; height: 11px; }

    .card-status {
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      flex-shrink: 0;
    }

    .card-status.pending { background: rgba(22,163,74,0.12);  color: var(--success-color); }
    .card-status.claimed { background: rgba(26,75,122,0.12);  color: var(--primary-color); }
    .card-status.other   { background: var(--bg-secondary);   color: var(--text-muted); }

    .card-context {
      padding: 8px 10px;
      background: var(--bg-secondary);
      border-radius: 6px;
      font-size: 12px;
      color: var(--text-secondary);
      line-height: 1.5;
      margin-bottom: 10px;
      border-left: 3px solid var(--border-color);
    }

    .card-context-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .card-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-top: 10px;
      border-top: 1px solid var(--border-color);
    }

    .action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background var(--transition);
      letter-spacing: 0.2px;
    }

    .action-btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .action-btn svg { width: 14px; height: 14px; }

    .action-btn.primary { background: var(--primary-color); color: white; }
    .action-btn.primary:hover:not(:disabled) { background: var(--primary-hover); }

    .action-btn.success { background: var(--success-color); color: white; }
    .action-btn.success:hover:not(:disabled) { background: #15803d; }

    .action-btn.secondary {
      background: var(--bg-secondary);
      color: var(--text-secondary);
      border: 1px solid var(--border-color);
    }
    .action-btn.secondary:hover:not(:disabled) { background: var(--border-color); }

    .action-btn.danger {
      background: rgba(227,25,55,0.08);
      color: var(--danger-color);
      border: 1px solid rgba(227,25,55,0.2);
    }
    .action-btn.danger:hover:not(:disabled) { background: rgba(227,25,55,0.15); }

    .action-spacer { flex: 1; }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 20px;
      text-align: center;
      flex: 1;
      color: var(--text-muted);
      gap: 8px;
    }

    .empty-icon  { width: 64px; height: 64px; color: var(--border-color); margin-bottom: 8px; }
    .empty-title { font-size: 14px; font-weight: 600; color: var(--text-secondary); }
    .empty-text  { font-size: 12px; max-width: 260px; line-height: 1.5; }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      background: rgba(227,25,55,0.06);
      border-bottom: 1px solid rgba(227,25,55,0.2);
      color: var(--danger-color);
      font-size: 12px;
      flex-shrink: 0;
    }

    .error-banner svg { width: 16px; height: 16px; flex-shrink: 0; }

    .error-dismiss {
      margin-left: auto;
      padding: 4px;
      background: none;
      border: none;
      color: var(--danger-color);
      cursor: pointer;
      opacity: 0.7;
    }
    .error-dismiss:hover { opacity: 1; }

    .callback-list::-webkit-scrollbar { width: 6px; }
    .callback-list::-webkit-scrollbar-track { background: transparent; }
    .callback-list::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }
    .callback-list::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: var(--bg-color);
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.2);
      width: 90%;
      max-width: 380px;
      max-height: 80vh;
      overflow: hidden;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      border-bottom: 1px solid var(--border-color);
    }

    .modal-header h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: var(--text-color);
    }

    .modal-close {
      background: none;
      border: none;
      padding: 4px;
      cursor: pointer;
      color: var(--text-muted);
      border-radius: 4px;
    }
    .modal-close:hover { background: var(--bg-hover); color: var(--text-color); }

    .modal-body { padding: 16px 18px; }

    .modal-footer {
      padding: 12px 18px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: flex-end;
    }

    .ani-options { display: flex; flex-direction: column; gap: 8px; }

    .ani-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      background: var(--bg-color);
      border: 2px solid var(--border-color);
      border-radius: var(--radius);
      cursor: pointer;
      transition: all var(--transition);
      font-size: 14px;
      font-weight: 500;
      color: var(--text-color);
    }

    .ani-option:hover   { border-color: var(--primary-color); background: rgba(26,75,122,0.04); }
    .ani-option.selected { border-color: var(--primary-color); background: rgba(26,75,122,0.08); }
    .ani-option svg { color: var(--primary-color); }

    .btn-secondary {
      padding: 8px 16px;
      background: var(--bg-color);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      color: var(--text-secondary);
      transition: background var(--transition);
    }
    .btn-secondary:hover { background: var(--bg-hover); }

    .search-bar {
      padding: 10px 12px;
      background: var(--bg-color);
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
    }

    .search-input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-input-wrapper svg {
      position: absolute;
      left: 10px;
      width: 14px;
      height: 14px;
      color: var(--text-muted);
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      padding: 8px 10px 8px 32px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      font-size: 12px;
      font-family: inherit;
      background: var(--bg-secondary);
      color: var(--text-color);
      transition: border-color var(--transition), box-shadow var(--transition);
    }

    .search-input:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px rgba(26,75,122,0.1);
      background: var(--bg-color);
    }

    .search-input::placeholder { color: var(--text-muted); }

    .search-clear {
      position: absolute;
      right: 6px;
      background: none;
      border: none;
      padding: 3px;
      cursor: pointer;
      color: var(--text-muted);
      border-radius: 3px;
      display: flex;
      align-items: center;
    }
    .search-clear:hover { background: var(--bg-hover); color: var(--text-color); }

    .wait-time {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 6px;
      font-variant-numeric: tabular-nums;
    }
    .wait-time.normal   { background: rgba(22,163,74,0.1);  color: var(--success-color); }
    .wait-time.warning  { background: rgba(217,119,6,0.1);  color: var(--warning-color); }
    .wait-time.critical { background: rgba(227,25,55,0.1);  color: var(--danger-color); }

    .no-results {
      padding: 32px 16px;
      text-align: center;
      color: var(--text-muted);
      font-size: 12px;
    }

    .no-results svg {
      width: 40px;
      height: 40px;
      margin-bottom: 10px;
      opacity: 0.4;
      display: block;
      margin-inline: auto;
    }

    .custom-fields {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 8px 10px;
      border-top: 1px solid var(--border-color);
      background: var(--bg-secondary);
      border-radius: 0 0 calc(var(--radius) - 1px) calc(var(--radius) - 1px);
    }

    .custom-field {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 100px;
      flex: 1;
      max-width: 50%;
    }

    .custom-field-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
    }

    .custom-field-value {
      font-size: 12px;
      color: var(--text-color);
      word-break: break-word;
    }
  `;

  constructor() {
    super();
    this.callbacks = [];
    this.loading = false;
    this.error = null;
    this.agentId = null;
    this.agentState = 'Unknown';
    this.dialingId = null;
    this.showCalledBack = false;
    this.datacenter = null;
    this.lookbackMinutes = 480;
    this.pollIntervalSeconds = 30;
    this.accessToken = null;
    this.outdialEp = null;
    this.outdialAni = null;
    this.outdialAniList = null;
    this.selectedAni = null;
    this.showAniSelector = false;
    this._pendingDialCallback = null;
    this._sdkLogger = null;
    this._pollInterval = null;
    this.searchQuery = '';
    this.priorityWarningMins = 60;
    this.priorityCriticalMins = 120;
  }

  async connectedCallback() {
    super.connectedCallback();
    if (!document.querySelector('#mk-inter-font')) {
      const link = document.createElement('link');
      link.id = 'mk-inter-font';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
      document.head.appendChild(link);
    }
    await this._initSDK();
    this._startPolling();
    this._fetchCallbacks(); // fetch immediately on load, don't wait for first interval
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopPolling();
  }

  async _initSDK() {
    try {
      Desktop.config.init();
      window.myAgentService = Desktop.agentContact?.SERVICE;

      if (Desktop.agentContact?.SERVICE?.webex) {
        try {
          const agentDetails = await Desktop.agentContact.SERVICE.webex.fetchPersonData("me");
          this.agentId = agentDetails?.id || agentDetails?.emails?.[0] || null;
        } catch (err) {
          console.warn('[CallbackWidget] fetchPersonData failed:', err);
        }
      }

      if (!this.agentId && Desktop.agentStateInfo?.latestData) {
        const agentInfo = Desktop.agentStateInfo.latestData;
        this.agentId = agentInfo?.agentId || agentInfo?.id || agentInfo?.agentSessionId || null;
        this.agentState = agentInfo?.subStatus || agentInfo?.status || 'Available';
      }

      if (!this.outdialAni) {
        try {
          const agentData = Desktop.agentStateInfo?.latestData;
          this.outdialAni = agentData?.outDialAni ||
                           agentData?.outdialAni ||
                           agentData?.dialAni ||
                           agentData?.ani ||
                           null;
          if (!this.outdialAni && Desktop.dialer?.defaultAni) {
            this.outdialAni = Desktop.dialer.defaultAni;
          }
        } catch (err) {
          console.warn('[CallbackWidget] Could not get outdialAni:', err);
        }
      }

      if (Desktop.logger) {
        try {
          this._sdkLogger = Desktop.logger.createLogger('mk-callback-widget');
        } catch (e) {
          console.warn('[CallbackWidget] Logger creation failed:', e);
        }
      }

      if (Desktop.agentStateInfo?.addEventListener) {
        Desktop.agentStateInfo.addEventListener('updated', (event) => {
          if (Array.isArray(event)) {
            const stateChange = event.find(item => item.name === 'subStatus');
            if (stateChange) this.agentState = stateChange.value;
          }
        });
      }

      await this._fetchCallbacks();

    } catch (err) {
      console.error('[CallbackWidget] SDK init failed:', err);
      this.error = 'Failed to initialize SDK: ' + err.message;
      await this._fetchCallbacks();
    }
  }

  _startPolling() {
    const ms = (this.pollIntervalSeconds || 30) * 1000;
    this._pollInterval = setInterval(() => {
      if (!this.loading) this._fetchCallbacks();
    }, ms);
  }

  _stopPolling() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }

  _log(message, data = {}, level = 'info') {
    const logData = { message, ...data, timestamp: new Date().toISOString() };
    
    if (this._sdkLogger) {
      this._sdkLogger[level]?.(JSON.stringify(logData));
    } else {
      console[level === 'error' ? 'error' : 'log']('[CallbackWidget]', message, data);
    }
  }

  async _fetchCallbacks() {
    this.loading = true;
    this.requestUpdate();

    const token = this._getToken();
    if (!token) {
      this.error = 'No access token. Set accessToken in the desktop layout or ensure the Desktop SDK is initialized.';
      this.loading = false;
      this.requestUpdate();
      return;
    }

    const datacenter = this.datacenter || this._getDatacenter();
    const endpoint = `https://api.wxcc-${datacenter}.cisco.com/search`;
    const now = Date.now();
    const from = now - ((this.lookbackMinutes || 480) * 60 * 1000);

    const abandonedQuery = `{
      task(
        from: ${from}
        to: ${now}
        timeComparator: createdTime
        filter: {
          and: [
            { terminationType: { equals: abandoned } }
            { direction: { equals: "inbound" } }
            { channelType: { equals: telephony } }
          ]
        }
      ) {
        tasks { id ani direction terminationType channelType createdTime queuedTime }
        pageInfo { hasNextPage endCursor }
      }
    }`;

    const outboundQuery = `{
      task(
        from: ${from}
        to: ${now}
        timeComparator: createdTime
        filter: {
          and: [
            { direction: { equals: "outdial" } }
            { channelType: { equals: telephony } }
          ]
        }
      ) {
        tasks { id ani direction createdTime queuedTime }
        pageInfo { hasNextPage endCursor }
      }
    }`;

    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      const [abandonedRes, outboundRes] = await Promise.all([
        fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query: abandonedQuery }) }),
        fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query: outboundQuery }) })
      ]);

      if (!abandonedRes.ok) {
        const errText = await abandonedRes.text().catch(() => '');
        throw new Error(`Search API ${abandonedRes.status}: ${errText}`);
      }

      const abandonedData = await abandonedRes.json();
      const outboundData = outboundRes.ok ? await outboundRes.json() : null;

      if (abandonedData.errors?.length) {
        throw new Error(abandonedData.errors[0]?.message || 'GraphQL query error');
      }

      const abandonedTasks = abandonedData?.data?.task?.tasks || [];
      const outboundTasks = outboundData?.data?.task?.tasks || [];

      this._log('Search API polled', { abandoned: abandonedTasks.length, outbound: outboundTasks.length });

      // Build map: normalized ANI -> array of outbound call times
      const outboundTimesByAni = new Map();
      for (const task of outboundTasks) {
        const key = this._normalizeAni(task.ani);
        if (!key) continue;
        const times = outboundTimesByAni.get(key) || [];
        times.push(task.createdTime || task.queuedTime || 0);
        outboundTimesByAni.set(key, times);
      }

      const prev = this.callbacks;

      this.callbacks = abandonedTasks.map(task => {
        const key = this._normalizeAni(task.ani);
        const abandonEndTime = task.createdTime || task.queuedTime || 0;
        const outTimes = outboundTimesByAni.get(key) || [];
        const apiCallbackMade = outTimes.some(t => t > abandonEndTime);
        // Preserve optimistic callbackMade set when agent clicked Dial (Search API lags ~1-2 min)
        const prevRecord = prev.find(c => c.id === task.id);
        const callbackMade = apiCallbackMade || (prevRecord?.callbackMade ?? false);

        return {
          id: task.id,
          ani: task.ani,
          queue: task.queueName || task.lastQueue?.name || 'Unknown Queue',
          abandonedAt: new Date(task.createdTime || task.queuedTime).toISOString(),
          callbackMade,
          status: callbackMade ? 'called-back' : 'pending'
        };
      }).sort((a, b) => new Date(a.abandonedAt) - new Date(b.abandonedAt));

      this.error = null;

    } catch (err) {
      this._log('Search API error', { error: err.message }, 'error');
      this.error = `Search API error: ${err.message}`;
    } finally {
      this.loading = false;
      this.requestUpdate();
    }
  }

  _getToken() {
    const webex = window.myAgentService?.webex
      || Desktop.agentContact?.SERVICE?.webex;

    if (webex) {
      const candidates = [
        webex.token?.access_token,
        webex.credentials?.supertoken?.access_token,
        webex.credentials?.access_token,
        webex.internal?.credentials?.supertoken?.access_token,
      ];
      for (const t of candidates) {
        if (t && typeof t === 'string' && t.length > 20) return t;
      }
    }

    // Fallback: token passed explicitly via layout property
    if (this.accessToken && this.accessToken.length > 20) return this.accessToken;

    return null;
  }

  _normalizeAni(ani) {
    if (!ani || typeof ani !== 'string') return null;
    const digits = ani.replace(/\D/g, '');
    return digits.length >= 7 ? digits : null;
  }

  async _dialCallback(callback) {
    this.dialingId = callback.id;
    this.requestUpdate();

    try {
      const token = this._getToken();
      if (!token) throw new Error('No access token available for outdial');

      const entryPointId = this.outdialEp || callback.entryPointId;
      if (!entryPointId) throw new Error('No Outdial Entry Point configured. Set outdialEp in the desktop layout.');

      const availableAnis = this._getAvailableAnis();
      if (availableAnis.length === 0) throw new Error('No Outdial ANI configured. Set outdialAni or outdialAniList in the desktop layout.');

      let originAni;

      if (availableAnis.length > 1 && !this.selectedAni) {
        this._pendingDialCallback = callback;
        this.showAniSelector = true;
        this.dialingId = null;
        return;
      }

      originAni = this.selectedAni || availableAnis[0];
      await this._executeOutdial(callback, entryPointId, originAni);

    } catch (err) {
      console.error('[CallbackWidget] Dial error:', err);
      this.error = err.message;
      this.dialingId = null;
      this.requestUpdate();
    }
  }

  /**
   * Get list of available ANIs from various sources
   */
  _getAvailableAnis() {
    const anis = [];

    // 1. Check outdialAniList (comma-separated or array)
    if (this.outdialAniList) {
      if (typeof this.outdialAniList === 'string') {
        // Comma-separated string
        const parsed = this.outdialAniList.split(',').map(a => a.trim()).filter(a => a.length > 5);
        anis.push(...parsed);
      } else if (Array.isArray(this.outdialAniList)) {
        anis.push(...this.outdialAniList.filter(a => typeof a === 'string' && a.length > 5));
      }
    }

    // 2. Check single outdialAni
    if (this.outdialAni && typeof this.outdialAni === 'string' && this.outdialAni.length > 5) {
      if (!anis.includes(this.outdialAni)) {
        anis.push(this.outdialAni);
      }
    }

    // 3. Try to extract from MobX proxy (if outdialAni is an object)
    if (this.outdialAni && typeof this.outdialAni === 'object') {
      try {
        let extracted = [];
        
        if (typeof this.outdialAni.slice === 'function') {
          extracted = this.outdialAni.slice();
        } else if (typeof this.outdialAni.toJSON === 'function') {
          extracted = this.outdialAni.toJSON();
        } else if (this.outdialAni.data && Array.isArray(this.outdialAni.data)) {
          extracted = this.outdialAni.data;
        }

        if (Array.isArray(extracted)) {
          extracted.forEach(item => {
            const ani = typeof item === 'string' ? item :
                       (item?.id || item?.name || item?.ani || item?.number || item?.value);
            if (ani && typeof ani === 'string' && ani.length > 5 && !anis.includes(ani)) {
              anis.push(ani);
            }
          });
        }
      } catch (e) {
        console.warn('[CallbackWidget] Could not extract ANIs from MobX proxy:', e);
      }
    }

    return anis;
  }

  /**
   * Handle ANI selection from modal
   */
  _selectAni(ani) {
    this.selectedAni = ani;
    this.showAniSelector = false;

    // If there's a pending dial, execute it
    if (this._pendingDialCallback) {
      const callback = this._pendingDialCallback;
      this._pendingDialCallback = null;
      this._dialCallback(callback);
    }
  }

  /**
   * Cancel ANI selection
   */
  _cancelAniSelection() {
    this.showAniSelector = false;
    this._pendingDialCallback = null;
    this.dialingId = null;
  }

  /**
   * Execute the actual outdial
   */
  async _executeOutdial(callback, entryPointId, originAni) {
    this.dialingId = callback.id;

    try {
      if (Desktop.dialer?.startOutdial) {
        await Desktop.dialer.startOutdial({
          data: {
            entryPointId,
            destination: callback.ani,
            direction: 'OUTBOUND',
            origin: originAni,
            mediaType: 'telephony',
            outboundType: 'OUTDIAL',
            attributes: {},
          }
        });
      } else if (Desktop.dialer?.dial) {
        console.warn('[CallbackWidget] startOutdial unavailable, falling back to dial');
        await Desktop.dialer.dial(callback.ani);
      } else {
        throw new Error('No outdial method available. Please dial manually: ' + callback.ani);
      }

      this._log('Outdial initiated', { callbackId: callback.id, ani: callback.ani });

      // Optimistically mark as called back; confirmed on next Search API poll (~1-2 min lag)
      this.callbacks = this.callbacks.map(c =>
        c.id === callback.id ? { ...c, callbackMade: true, status: 'called-back' } : c
      );
      this.selectedAni = null;

    } catch (err) {
      console.error('[CallbackWidget] Dial error:', err);
      const errorMsg = err.details?.msg?.errorMessage || err.message || String(err);
      this._log('Dial failed', { error: errorMsg }, 'error');
      this.error = 'Dial failed: ' + errorMsg;
    } finally {
      this.dialingId = null;
      this.requestUpdate();
    }
  }

  _getDatacenter() {
    // Try to get datacenter from various sources
    try {
      // From Desktop config
      if (Desktop.config?.datacenter) {
        return Desktop.config.datacenter.replace('prod', '');
      }
      // From window location
      const hostname = window.location.hostname;
      if (hostname.includes('wxcc-us1')) return 'us1';
      if (hostname.includes('wxcc-eu1')) return 'eu1';
      if (hostname.includes('wxcc-eu2')) return 'eu2';
      if (hostname.includes('wxcc-anz1')) return 'anz1';
      if (hostname.includes('wxcc-ca1')) return 'ca1';
      if (hostname.includes('wxcc-jp1')) return 'jp1';
      if (hostname.includes('wxcc-sg1')) return 'sg1';
    } catch (e) {
      console.warn('[CallbackWidget] Could not determine datacenter:', e);
    }
    return 'us1'; // Default
  }

  _dismissError() {
    this.error = null;
  }

  _handleSearch(e) {
    this.searchQuery = e.target.value;
  }

  _clearSearch() {
    this.searchQuery = '';
  }

  _getFilteredCallbacks() {
    let results = this.showCalledBack
      ? this.callbacks
      : this.callbacks.filter(c => !c.callbackMade);

    if (!this.searchQuery || !this.searchQuery.trim()) return results;

    const q = this.searchQuery.toLowerCase().trim();
    return results.filter(c =>
      (c.ani  || '').toLowerCase().includes(q) ||
      (c.queue|| '').toLowerCase().includes(q)
    );
  }

  _getWaitTimeMinutes(abandonedAt) {
    const now = new Date();
    const abandoned = new Date(abandonedAt);
    return Math.floor((now - abandoned) / 60000);
  }

  _getPriorityLevel(abandonedAt) {
    const waitMins = this._getWaitTimeMinutes(abandonedAt);
    
    if (waitMins >= this.priorityCriticalMins) {
      return 'critical';
    } else if (waitMins >= this.priorityWarningMins) {
      return 'warning';
    }
    return 'normal';
  }

  _formatWaitTime(abandonedAt) {
    const waitMins = this._getWaitTimeMinutes(abandonedAt);
    
    if (waitMins < 1) return 'Just now';
    if (waitMins < 60) return `${waitMins}m`;
    
    const hours = Math.floor(waitMins / 60);
    const mins = waitMins % 60;
    
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }

  _formatTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  _formatANI(ani) {
    const cleaned = ani?.replace(/\D/g, '') || '';
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return ani || 'Unknown';
  }

  _getStats() {
    const uncalled = this.callbacks.filter(c => !c.callbackMade);
    return {
      pending:   uncalled.length,
      calledBack: this.callbacks.length - uncalled.length
    };
  }

  _toggleShowCalledBack() {
    this.showCalledBack = !this.showCalledBack;
  }

  render() {
    const stats = this._getStats();
    const filtered = this._getFilteredCallbacks();
    const uncalled = this.callbacks.filter(c => !c.callbackMade);
    const criticalCount = uncalled.filter(c => this._getPriorityLevel(c.abandonedAt) === 'critical').length;
    const warningCount  = uncalled.filter(c => this._getPriorityLevel(c.abandonedAt) === 'warning').length;
    const allHandled = this.callbacks.length > 0 && stats.pending === 0 && !this.searchQuery;

    return html`
      <div class="panel-container">
        <div class="panel-header">
          <div class="header-left">
            <div class="header-title">Abandoned Calls</div>
          </div>
          <div class="header-right">
            <div class="live-indicator">
              <span class="live-dot"></span>
              LIVE
            </div>
          </div>
        </div>

        <div class="stats-bar">
          <span class="stat-pill pending">
            Uncalled <span class="stat-pill-count">${stats.pending}</span>
          </span>
          ${stats.calledBack > 0 ? html`
            <span class="stat-pill neutral">
              Handled <span class="stat-pill-count">${stats.calledBack}</span>
            </span>
          ` : ''}
          ${warningCount > 0 ? html`
            <span class="stat-pill warning">
              Warning <span class="stat-pill-count">${warningCount}</span>
            </span>
          ` : ''}
          ${criticalCount > 0 ? html`
            <span class="stat-pill critical">
              Critical <span class="stat-pill-count">${criticalCount}</span>
            </span>
          ` : ''}
          ${stats.calledBack > 0 ? html`
            <button
              class="toggle-called-back-btn ${this.showCalledBack ? 'active' : ''}"
              @click=${this._toggleShowCalledBack}
            >${this.showCalledBack ? 'Hide Handled' : 'Show Handled'}</button>
          ` : ''}
        </div>

        ${this.error ? html`
          <div class="error-banner">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            ${this.error}
            <button class="error-dismiss" @click=${this._dismissError}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        ` : ''}

        ${this.callbacks.length > 0 ? html`
          <div class="search-bar">
            <div class="search-input-wrapper">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                type="text"
                class="search-input"
                placeholder="Search by phone or queue..."
                .value=${this.searchQuery}
                @input=${this._handleSearch}
              />
              ${this.searchQuery ? html`
                <button class="search-clear" @click=${this._clearSearch}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              ` : ''}
            </div>
          </div>
        ` : ''}

        ${this.callbacks.length === 0 ? html`
          <div class="empty-state">
            <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="4" width="18" height="16" rx="2"/>
              <path d="M3 10h18"/>
            </svg>
            <div class="empty-title">No abandoned calls</div>
            <div class="empty-text">No abandoned calls found in the last ${this.lookbackMinutes || 480} minutes.</div>
          </div>
        ` : allHandled ? html`
          <div class="empty-state">
            <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <div class="empty-title">All caught up!</div>
            <div class="empty-text">All abandoned calls have been handled.</div>
            <button
              style="margin-top:12px; font-size:12px; padding:6px 14px; border-radius:8px; border:1px solid var(--border-color); background:transparent; color:var(--text-muted); cursor:pointer;"
              @click=${this._toggleShowCalledBack}
            >Show handled calls</button>
          </div>
        ` : filtered.length === 0 ? html`
          <div class="no-results">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            <div>No results for "${this.searchQuery}"</div>
          </div>
        ` : html`
          <div class="callback-list">
            ${filtered.map(callback => this._renderCallbackCard(callback))}
          </div>
        `}

        ${this.showAniSelector ? this._renderAniSelector() : ''}

        <div class="panel-footer">
          <div class="refresh-info">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            ${this.loading ? 'Refreshing...' : 'Just now'}
          </div>
          <div>v2.0.0</div>
        </div>
      </div>
    `;
  }

  _renderAniSelector() {
    const anis = this._getAvailableAnis();
    
    return html`
      <div class="modal-overlay" @click=${this._cancelAniSelection}>
        <div class="modal-content" @click=${(e) => e.stopPropagation()}>
          <div class="modal-header">
            <h3>Select Outbound Caller ID</h3>
            <button class="modal-close" @click=${this._cancelAniSelection}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <p style="margin-bottom: 12px; color: var(--text-muted);">
              Choose which number to display to the customer:
            </p>
            <div class="ani-options">
              ${anis.map(ani => html`
                <button 
                  class="ani-option ${this.selectedAni === ani ? 'selected' : ''}"
                  @click=${() => this._selectAni(ani)}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  <span>${this._formatANI(ani)}</span>
                </button>
              `)}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-secondary" @click=${this._cancelAniSelection}>Cancel</button>
          </div>
        </div>
      </div>
    `;
  }

  _renderCallbackCard(callback) {
    const isDialing = this.dialingId === callback.id;
    const priorityLevel = callback.callbackMade ? 'normal' : this._getPriorityLevel(callback.abandonedAt);
    const waitTime = this._formatWaitTime(callback.abandonedAt);

    return html`
      <div class="callback-card ${callback.callbackMade ? 'called-back' : ''} priority-${priorityLevel}">
        <div class="card-header">
          <div class="caller-info">
            <div class="caller-avatar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div class="caller-details">
              <div class="caller-ani">
                ${this._formatANI(callback.ani)}
                ${!callback.callbackMade ? html`<span class="wait-time ${priorityLevel}">${waitTime}</span>` : ''}
              </div>
              <div class="caller-meta">
                <span class="meta-tag queue">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  ${callback.queue}
                </span>
                <span class="meta-tag time">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  ${this._formatTime(callback.abandonedAt)}
                </span>
              </div>
            </div>
          </div>
          <span class="card-status ${callback.callbackMade ? 'called-back' : 'pending'}">
            ${callback.callbackMade ? 'Called Back' : 'Pending'}
          </span>
        </div>

        <div class="card-actions">
          ${callback.callbackMade ? html`
            <span style="color:var(--text-muted);font-size:12px;display:flex;align-items:center;gap:6px;">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Outbound call placed
            </span>
          ` : html`
            <button
              class="action-btn success"
              @click=${() => this._dialCallback(callback)}
              ?disabled=${isDialing}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              ${isDialing ? 'Dialing...' : 'Dial'}
            </button>
          `}
        </div>
      </div>
    `;
  }
}

customElements.define('bs-callback-widget', CallbackWidget);
