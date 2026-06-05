# Abandoned Calls Widget for Webex Contact Center

A widget for the WxCC Agent Desktop that surfaces abandoned calls and lets agents dial customers back in one click. **No backend server required** — the widget polls the WxCC Search API directly using the agent's existing session token.

**Built by Matt Kadas**

---

## How It Works

Every 30 seconds the widget:
1. Queries the WxCC Search API for abandoned inbound calls within a configurable lookback window (default: 8 hours)
2. Queries the same API for outbound calls in the same window
3. Cross-references them — if an outbound call to a number was placed **after** the abandon time, that record is marked **Called Back**
4. Agent clicks **Dial** to initiate a callback via the Desktop SDK; the card is immediately marked as handled

---

## What to Host

The entire widget is a single pre-built JavaScript file: **`index.js`**

You do not need to run a server or install anything. Just host `index.js` somewhere publicly accessible over HTTPS and point your Desktop Layout at it.

### Option A — GitHub Pages (recommended for testing)

1. Fork [github.com/kadammmmm/wxcc-abandoned-calls-widget](https://github.com/kadammmmm/wxcc-abandoned-calls-widget)
2. Go to your fork's **Settings → Pages**
3. Source: **Deploy from a branch**, branch `main`, folder `/ (root)` → Save
4. Your widget URL: `https://<your-username>.github.io/wxcc-abandoned-calls-widget/index.js`

Pages goes live within ~2 minutes of enabling it.

### Option B — CDN or static host (recommended for production)

Upload `index.js` to any static host (S3 + CloudFront, Azure Blob, nginx, etc.) and note the public HTTPS URL. No special headers required other than CORS being open to `*.cisco.com`.

---

## Adding the Widget to Your Desktop Layout

In **Webex Control Hub → Contact Center → Desktop Experience → Layouts**, edit your layout JSON.

The widget works in two placements. Choose the one that fits your use case.

### Placement 1 — Dedicated navigation page (full-screen)

Adds the widget as its own page in the left navigation bar. Best when agents primarily work abandoned callbacks.

```json
{
  "nav": {
    "label": "Abandoned Calls",
    "icon": "call-log",
    "iconType": "momentum",
    "navigateTo": "abandoned-calls",
    "align": "top"
  },
  "page": {
    "id": "abandoned-calls",
    "widgets": {
      "comp1": {
        "comp": "bs-callback-widget",
        "script": "https://<your-host>/index.js",
        "attributes": {
          "darkmode": "$STORE.app.darkMode"
        },
        "properties": {
          "accessToken":  "$STORE.auth.accessToken",
          "outdialEp":    "$STORE.agent.outDialEp",
          "outdialAni":   "+61298765432"
        }
      }
    },
    "layout": {
      "areas": [["comp1"]],
      "size": { "cols": [1], "rows": [1] }
    }
  }
}
```

Add this object to the `navigation` array in your layout JSON.

### Placement 2 — Side panel tab

Adds the widget as a tab in the right-hand agent panel, alongside Contact History. Best when agents handle callbacks in between normal inbound calls.

```json
{
  "comp": "md-tab",
  "attributes": { "slot": "tab", "aria-label": "Abandoned Calls" },
  "children": [
    { "comp": "md-icon", "attributes": { "name": "icon-call-log_16" } },
    { "comp": "span", "textContent": "Abandoned" }
  ]
},
{
  "comp": "md-tab-panel",
  "attributes": { "slot": "panel", "class": "widget-pane" },
  "children": [
    {
      "comp": "bs-callback-widget",
      "script": "https://<your-host>/index.js",
      "properties": {
        "accessToken": "$STORE.auth.accessToken",
        "outdialEp":   "$STORE.agent.outDialEp",
        "outdialAni":  "+61298765432"
      }
    }
  ]
}
```

Add these two elements as children of the `md-tabs` component in the `panel` section of your layout.

---

## Configuration Reference

All properties are set in the `properties` block of the Desktop Layout JSON.

| Property | Required | Default | Description |
|---|---|---|---|
| `accessToken` | Yes | — | Always set to `"$STORE.auth.accessToken"` |
| `outdialEp` | Yes | — | Outdial Entry Point ID. Use `"$STORE.agent.outDialEp"` to auto-resolve from agent profile |
| `outdialAni` | Yes* | — | Outbound caller ID shown to the customer (e.g. `"+61298765432"`). Must be registered in WxCC provisioning |
| `outdialAniList` | Yes* | — | Comma-separated list of ANIs — shows a picker modal when more than one is configured |
| `datacenter` | No | auto | WxCC datacenter: `us1` `eu1` `eu2` `anz1` `ca1` `jp1` `sg1`. Set explicitly if auto-detection fails |
| `lookbackMinutes` | No | `480` | How far back to search for abandoned calls (default: 8 hours) |
| `pollIntervalSeconds` | No | `30` | How often the widget refreshes |
| `maxResults` | No | `100` | Maximum abandoned call records to fetch per poll. A yellow warning appears if results are truncated |
| `priorityWarningMins` | No | `60` | Minutes before a card's left border turns yellow |
| `priorityCriticalMins` | No | `120` | Minutes before a card's left border turns red (pulsing) |
| `queueIds` | No | auto | Comma-separated queue IDs to show (e.g. `"abc-123,def-456"`). Auto-detected from the Desktop SDK if not set; falls back to showing all org-wide calls |
| `customFields` | No | — | JSON array of extra fields to show on each card. See [Custom Fields](#custom-fields) below |

*Either `outdialAni` or `outdialAniList` is required for dialing.

### Full properties example

```json
"properties": {
  "accessToken":          "$STORE.auth.accessToken",
  "outdialEp":            "$STORE.agent.outDialEp",
  "outdialAni":           "+61298765432",
  "datacenter":           "anz1",
  "lookbackMinutes":      120,
  "pollIntervalSeconds":  30,
  "maxResults":           200,
  "priorityWarningMins":  30,
  "priorityCriticalMins": 60
}
```

### Custom Fields

The `customFields` property lets you surface additional data from the WxCC task record directly on each callback card — no code changes required, just a layout update.

Set it to a JSON array of `{ "key": "...", "label": "..." }` objects. Each entry adds a labelled field to the bottom of the card. Fields with no value for a given call are hidden automatically.

**Available keys**

| Key | Description |
|---|---|
| `destination` | The number the customer dialled (DNIS) |
| `contactTag` | Tags applied to the contact |
| `businessOutcome` | Business outcome / disposition code |

**Example — show DNIS and disposition:**

```json
"customFields": "[{\"key\":\"destination\",\"label\":\"Called Number\"},{\"key\":\"businessOutcome\",\"label\":\"Outcome\"}]"
```

**Example — all three fields:**

```json
"customFields": "[{\"key\":\"destination\",\"label\":\"DNIS\"},{\"key\":\"contactTag\",\"label\":\"Tags\"},{\"key\":\"businessOutcome\",\"label\":\"Outcome\"}]"
```

**Full layout example with custom fields:**

```json
"properties": {
  "accessToken":   "$STORE.auth.accessToken",
  "outdialEp":     "$STORE.agent.outDialEp",
  "outdialAni":    "+61298765432",
  "customFields":  "[{\"key\":\"destination\",\"label\":\"Called Number\"},{\"key\":\"businessOutcome\",\"label\":\"Outcome\"}]"
}
```

Custom field values appear in a shaded section at the bottom of each card, displayed as two columns of label/value pairs.

**Note:** `destination`, `contactTag`, and `businessOutcome` are standard WxCC task fields. Their availability depends on your WxCC configuration — if a field returns empty for all calls, it simply won't appear on any card.

---

### Finding your Outdial ANI

Go to **Control Hub → Contact Center → Provisioning → Outdial ANI** and copy the number exactly as shown (E.164 format, e.g. `+61298765432`). Using a number not registered here will cause a 400 error when dialling.

### Finding your Datacenter

If you don't set `datacenter`, the widget tries to detect it from the Desktop SDK config. If detection fails (you'll see a 404 from the Search API), find your datacenter in **Control Hub → Contact Center → Settings** or identify it from your Agent Desktop URL (e.g. `desktop.wxcc-us1.cisco.com` → `us1`).

---

## Features

- **Abandoned call list** — polls WxCC Search API directly, no IVR flow changes required
- **Called Back detection** — outbound calls are cross-referenced; handled records are hidden by default
- **Show/Hide Handled toggle** — appears when called-back records exist; reveals them greyed out with the agent who called back
- **Priority indicators** — yellow / red left border based on wait time since abandon, with configurable thresholds
- **One-click Dial** — launches outbound call via Desktop SDK; card is immediately marked as handled
- **Multi-ANI picker** — selector modal when multiple caller IDs are configured
- **Search/filter** — filters by phone number or queue name in real time
- **Result cap** — configurable `maxResults` with a visible warning if the window contains more records than the cap

---

## Troubleshooting

**"Search API 401"** — Token missing or expired. Confirm `"accessToken": "$STORE.auth.accessToken"` is in the layout `properties` block (not `attributes`).

**"Search API 404"** — Wrong datacenter. Set `datacenter` explicitly (e.g. `"anz1"`).

**"GraphQL query error"** — Check that the agent's profile includes the `cjp:config_read` scope (standard for all WxCC agents). Also check the browser console for the full error body.

**"Invalid outdial ani"** — The ANI is not registered in WxCC provisioning. See [Finding your Outdial ANI](#finding-your-outdial-ani) above.

**No calls appearing** — Confirm there are actual abandoned calls in the lookback window by checking WxCC Analyzer. Try increasing `lookbackMinutes`.

**Yellow truncation banner** — More abandoned records exist than `maxResults` allows. Reduce `lookbackMinutes` or increase `maxResults`.

**Calls not marked as Called Back** — Search API results lag ~1–2 minutes after an outbound call is placed. The widget optimistically marks cards as handled immediately on Dial click, then confirms on the next poll.

**Dial button missing after toggle** — Hard refresh the desktop (Ctrl+Shift+R) to pick up the latest widget build.

### Console debug snippet

Paste this in the browser console on Agent Desktop to inspect the live widget state:

```javascript
function findWidget(root = document) {
  let w = root.querySelector('bs-callback-widget');
  if (w) return w;
  for (const el of root.querySelectorAll('*')) {
    if (el.shadowRoot) { w = findWidget(el.shadowRoot); if (w) return w; }
  }
}
const w = findWidget();
console.log('Datacenter:',   w?.datacenter);
console.log('Outdial EP:',   w?.outdialEp);
console.log('Max results:',  w?.maxResults);
console.log('Callbacks:',    w?.callbacks?.length, w?.callbacks);
console.log('Truncated:',    w?.truncated);
console.log('Queue filter:', w?._resolvedQueueIds ? [...w._resolvedQueueIds] : 'all queues');

// Verify what the SDK returns for this agent's assigned queues
const queues = await Desktop?.agentContact?.SERVICE?.webex?.cc?.getQueues?.();
console.log('getQueues():', queues);
```

---

## Building from Source

```bash
# Install dependencies
npm install

# Build widget to dist/callback-widget.js and copy to index.js
npm run deploy
```

### Project structure

```
wxcc-abandoned-calls-widget/
├── src/
│   └── callback-widget.js   # LitElement widget source
├── index.js                 # Built bundle — the only file you need to host
├── package.json
└── webpack.config.cjs
```

---

## License

MIT — Matt Kadas
