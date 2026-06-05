# Abandoned Calls Widget for Webex Contact Center

A widget for the WxCC Agent Desktop that surfaces abandoned calls and lets agents dial customers back in one click. **No backend server required** — the widget polls the WxCC Search API directly using the agent's existing session token.

**Built by Matt Kadas**

---

## How It Works

Every 30 seconds the widget:
1. Queries the WxCC Search API for abandoned inbound calls within a configurable lookback window (default: 8 hours)
2. Queries the same API for outbound calls in the same window
3. Cross-references them — if an outbound call to a number was placed **after** the abandon time, that record is marked **Called Back** and hidden by default
4. Agent clicks **Dial** directly on any card to initiate the callback via the Desktop SDK

---

## Prerequisites

- Webex Contact Center tenant with agent desktop access
- Admin access to WxCC Control Hub (for Desktop Layout configuration)
- Outdial Entry Point and ANI configured in WxCC
- GitHub account (for hosting the widget via GitHub Pages)

---

## Deployment

### Step 1 — Host the widget

The widget is a single JavaScript file served from GitHub Pages.

1. Fork [github.com/kadammmmm/wxcc-abandoned-calls-widget](https://github.com/kadammmmm/wxcc-abandoned-calls-widget)
2. Go to your fork's **Settings → Pages**
3. Set Source to **Deploy from a branch**, branch `main`, folder `/ (root)` → Save
4. Your widget URL will be: `https://<your-username>.github.io/wxcc-abandoned-calls-widget/index.js`

Pages goes live within ~2 minutes of enabling it.

### Step 2 — Add the widget to your Desktop Layout

In **Control Hub → Contact Center → Desktop Experience → Layouts**, edit your layout JSON and add the widget to the `navigation` array.

#### Minimal layout snippet (nav panel)

```json
{
  "nav": {
    "label": "Abandoned Calls",
    "icon": "icon-missed-call",
    "iconType": "momentum",
    "navigateTo": "abandoned-calls",
    "align": "top"
  },
  "page": {
    "id": "abandoned-calls",
    "widgets": {
      "comp1": {
        "comp": "bs-callback-widget",
        "script": "https://<your-username>.github.io/wxcc-abandoned-calls-widget/index.js",
        "attributes": {
          "darkmode": "$STORE.app.darkMode"
        },
        "properties": {
          "accessToken":  "$STORE.auth.accessToken",
          "outdialEp":    "$STORE.agent.outDialEp",
          "outdialAni":   "+18005551234"
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

---

## Configuration Reference

All properties are set in the Desktop Layout JSON `properties` block.

| Property | Required | Default | Description |
|---|---|---|---|
| `accessToken` | Yes | — | Set to `"$STORE.auth.accessToken"` |
| `outdialEp` | Yes | — | Outdial Entry Point ID. Use `"$STORE.agent.outDialEp"` to auto-resolve |
| `outdialAni` | Yes* | — | Single outbound caller ID shown to customer (e.g. `"+18005551234"`) |
| `outdialAniList` | Yes* | — | Comma-separated list of ANIs — shows a selector modal when >1 |
| `datacenter` | No | auto | WxCC datacenter: `us1` `eu1` `eu2` `anz1` `ca1` `jp1` `sg1` |
| `lookbackMinutes` | No | `480` | How far back to search for abandoned calls (8 hours) |
| `pollIntervalSeconds` | No | `30` | How often the widget refreshes |
| `priorityWarningMins` | No | `60` | Minutes before card border turns yellow |
| `priorityCriticalMins` | No | `120` | Minutes before card border turns red (pulsing) |

*Either `outdialAni` or `outdialAniList` is required.

### Multi-ANI example

```json
"properties": {
  "accessToken":          "$STORE.auth.accessToken",
  "outdialEp":            "$STORE.agent.outDialEp",
  "outdialAniList":       "+18005551234,+18005559999",
  "datacenter":           "us1",
  "lookbackMinutes":      480,
  "priorityWarningMins":  30,
  "priorityCriticalMins": 60
}
```

When `outdialAniList` contains more than one number, the agent sees a picker before the call is placed.

---

## Features

- **Abandoned call list** — pulls directly from WxCC Search API, no IVR flow changes needed
- **Already-called-back detection** — outbound calls are cross-referenced; handled records are hidden by default
- **Show/Hide Handled toggle** — appears in the stats bar whenever handled records exist; reveals them greyed out
- **Priority indicators** — green / yellow / red left border based on wait time, with configurable thresholds
- **One-click Dial** — launches outbound call via Desktop SDK; card is immediately marked Handled
- **Multi-ANI support** — picker modal when multiple caller IDs are configured
- **Search/filter** — filters by phone number or queue name in real time

---

## Troubleshooting

**"Search API 401"** — Token is missing or expired. Confirm `"accessToken": "$STORE.auth.accessToken"` is in properties.

**"Search API 404"** — Wrong datacenter. Set `datacenter` explicitly (e.g. `"eu1"`).

**"GraphQL query error"** — Verify the agent profile has the `cjp:config_read` scope (standard for all WxCC agents).

**No calls appearing** — Confirm there are actual abandoned calls in the window by checking WxCC Analyzer. Try increasing `lookbackMinutes`.

**Calls incorrectly marked as Called Back** — The outbound cross-reference checks both `ani` and `dnis` fields on outdial records. Open the browser console and look for `[CallbackWidget] Search API polled` to inspect the raw counts. If needed, open an issue with a sanitized sample of the task record.

**Dial button not working** — Check that `outdialEp` resolves to a value (`$STORE.agent.outDialEp` should auto-fill from the agent's profile). Verify the agent has Outdial permissions in Control Hub.

### Console debug snippet

Paste this in the browser console on Agent Desktop to inspect the live widget:

```javascript
function findWidget(root = document) {
  let w = root.querySelector('bs-callback-widget');
  if (w) return w;
  for (const el of root.querySelectorAll('*')) {
    if (el.shadowRoot) { w = findWidget(el.shadowRoot); if (w) return w; }
  }
}
const w = findWidget();
console.log('Datacenter:', w?.datacenter || w?._getDatacenter?.());
console.log('Outdial EP:', w?.outdialEp);
console.log('Agent ID:', w?.agentId);
console.log('Callbacks:', w?.callbacks);
```

---

## Development

```bash
# Install dependencies
npm install

# Build widget to dist/callback-widget.js
npm run build

# Copy build to index.js (for GitHub Pages)
cp dist/callback-widget.js index.js
```

### Project structure

```
wxcc-abandoned-calls-widget/
├── src/
│   └── callback-widget.js      # LitElement widget source
├── dist/
│   └── callback-widget.js      # Built bundle
├── index.js                    # GitHub Pages entry point (copy of dist)
├── docs/
│   └── DEPLOYMENT-POLLING.md   # Extended deployment reference
├── package.json
└── webpack.config.cjs
```

---

## License

MIT — Matt Kadas
