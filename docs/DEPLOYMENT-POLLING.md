# Deployment Guide — Polling Edition (v2.0)

This version requires **no backend server**. The widget polls the WxCC Search API directly using the agent's existing access token.

---

## How It Works

Every 30 seconds (configurable) the widget:
1. Queries the WxCC Search API for abandoned inbound calls within a lookback window (default 8 hours)
2. Queries the same API for outbound calls in the same window
3. Cross-references them: if an outbound call to a customer's number was placed **after** their abandon time, the record is marked "Called Back" and hidden by default
4. Agents click **Dial** directly — no claim/release step required

---

## Step 1 — Host the widget file

The widget is a single JavaScript file served from GitHub Pages (or any static host).

### Option A: GitHub Pages (recommended)

1. Fork or clone the [wxcc-abandoned-calls-widget](https://github.com/kadammmmm/wxcc-abandoned-calls-widget) repo
2. Go to **Settings → Pages**
3. Set Source to **Deploy from a branch**, branch `main`, folder `/ (root)`
4. Save — Pages will be live at `https://kadammmmm.github.io/wxcc-abandoned-calls-widget/`
5. Your widget URL is: `https://kadammmmm.github.io/wxcc-abandoned-calls-widget/index.js`

### Option B: Any static host (CDN, S3, nginx, etc.)

Upload `index.js` (the built widget) and note the public URL.

---

## Step 2 — Add the widget to your WxCC Desktop Layout

In **Webex Control Hub → Contact Center → Desktop Experience → Layouts**, edit your layout JSON.

### Minimal config (nav panel)

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
        "script": "https://kadammmmm.github.io/wxcc-abandoned-calls-widget/index.js",
        "properties": {
          "accessToken": "$STORE.auth.accessToken",
          "outdialEp":   "$STORE.agent.outDialEp",
          "outdialAni":  "+18005551234"
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

### Full config with all options

```json
"properties": {
  "accessToken":          "$STORE.auth.accessToken",
  "outdialEp":            "$STORE.agent.outDialEp",
  "outdialAni":           "+18005551234",
  "outdialAniList":       "+18005551234,+18005559999",
  "datacenter":           "us1",
  "lookbackMinutes":      480,
  "pollIntervalSeconds":  30,
  "priorityWarningMins":  60,
  "priorityCriticalMins": 120
}
```

---

## Configuration Reference

| Property | Required | Default | Description |
|---|---|---|---|
| `accessToken` | Yes | — | `$STORE.auth.accessToken` — agent's OAuth token |
| `outdialEp` | Yes | — | Outdial Entry Point ID. Use `$STORE.agent.outDialEp` to auto-resolve |
| `outdialAni` | Yes* | — | Single outbound caller ID shown to customer |
| `outdialAniList` | Yes* | — | Comma-separated list of ANIs (shows selector if >1) |
| `datacenter` | No | auto-detected | WxCC datacenter: `us1` `eu1` `eu2` `anz1` `ca1` `jp1` `sg1` |
| `lookbackMinutes` | No | `480` | How far back to search for abandoned calls (8 hours) |
| `pollIntervalSeconds` | No | `30` | How often to refresh |
| `priorityWarningMins` | No | `60` | Minutes before card turns yellow |
| `priorityCriticalMins` | No | `120` | Minutes before card turns red (pulsing) |

*Either `outdialAni` or `outdialAniList` is required for dialing.

### Datacenter auto-detection

If `datacenter` is not set, the widget tries to detect it from `Desktop.config.datacenter` or the page hostname. **Set it explicitly if auto-detection fails** (you'll see a 401/404 from the Search API).

---

## The "Show Handled" Toggle

When a record appears in the widget, the widget checks whether an outbound call was placed to that number **after** the abandon time. If yes, the card is hidden by default.

- **"Handled" count** in the stats bar shows how many have been called back
- **"Show Handled" button** appears whenever there are handled records — click to reveal them greyed out
- After an agent clicks **Dial**, the card is immediately marked as handled (before the API confirms it, since Search results lag ~1–2 minutes)

---

## Differences from v1 (backend edition)

| Feature | v1 (backend) | v2 (polling) |
|---|---|---|
| Backend server required | Yes | **No** |
| IVR Flow changes required | Yes (HTTP Request node) | **No** |
| IVR context / custom fields | Yes | No |
| Claim/release coordination | Yes | No |
| Historical lookback | No | **Yes** |
| Already-called-back detection | No | **Yes** |
| Deployment complexity | High | **Low** |

---

## Troubleshooting

**"Search API 401"** — Token missing or expired. Verify `accessToken: "$STORE.auth.accessToken"` is in the layout properties.

**"Search API 404"** — Wrong datacenter. Set `datacenter` explicitly in properties.

**"GraphQL query error"** — The API schema changed or your org doesn't have Search API access. Check that the agent's profile has the `cjp:config_read` scope (standard for all WxCC agents).

**No calls appearing** — Verify there are actually abandoned calls in the lookback window by checking the WxCC Analyzer. Try increasing `lookbackMinutes`.

**Calls appear as "Called Back" incorrectly** — The outbound cross-reference checks both `ani` and `dnis` fields on outbound tasks. If your WxCC version stores the destination differently, open the browser console and inspect the raw Search API response to verify field names.
