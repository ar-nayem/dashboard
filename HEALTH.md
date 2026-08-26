# Getting Apple Health data into the dashboard

## There is no Apple Health API

Worth stating plainly, because it shapes everything below: **Apple provides no
server-side API for Health data.** HealthKit is an on-device framework. There is
no OAuth flow, no REST endpoint, no developer portal where you generate a key
and pull your weight history. Nothing running on a server can reach into your
Health app, and no third-party service can either — they all use one of the
routes below.

So instead of the server pulling, **your phone pushes**. The dashboard exposes a
webhook; an automation on your phone POSTs readings to it on a schedule.

```
iPhone (Health app)  →  Shortcuts automation  →  POST /api/health-webhook  →  dashboard
```

## The endpoint

```
POST https://arnayem.top/dashboard/api/health-webhook
Content-Type: application/json
x-webhook-secret: <your HEALTH_WEBHOOK_SECRET>
```

Body:

```json
{
  "readings": [
    { "type": "weight",        "value": 72.4, "unit": "kg", "date": "2026-08-26" },
    { "type": "resting_hr",    "value": 58,                 "date": "2026-08-26" },
    { "type": "hrv",           "value": 61,                 "date": "2026-08-26" },
    { "type": "steps",         "value": 8431,               "date": "2026-08-26" },
    { "type": "active_energy", "value": 540,                "date": "2026-08-26" },
    { "type": "sleep",         "value": 7.2,                "date": "2026-08-26" },
    { "type": "vo2max",        "value": 42.1,               "date": "2026-08-26" }
  ]
}
```

- `type` must be one of the seven above. Anything else is skipped and counted
  in the response, rather than failing the whole batch — one bad field should
  not cost you the other six readings.
- `date` is optional and defaults to today. `unit` is optional and defaults to
  the canonical unit for that metric.
- Posting the same `type` and `date` again **corrects** that day's reading
  instead of adding a second one, so a retry or an overlapping schedule can't
  double-count.
- At most 500 readings per request.

Response:

```json
{ "written": 6, "skipped": 1, "details": ["unknown type \"bogus\""] }
```

Find your secret on the server:

```bash
ssh root@45.76.15.203 'grep HEALTH_WEBHOOK_SECRET /var/www/dashboard/.env'
```

## Route 1 — Shortcuts (free, built in, fiddly)

Free and uses nothing but Apple's own app. The tedious part is that Shortcuts
has no native "read a health metric as a number" action — you go through
**Find Health Samples**, which returns a list you then have to reduce.

Per metric you want:

1. Shortcuts → **+** → Add Action → **Find Health Samples**
2. Set the sample type (e.g. *Body Mass*), **Sort by** Date, **Order** Latest
   First, **Limit** 1
3. Add **Get Details of Health Sample** → *Value*
4. Store it in a variable

Then one **Get Contents of URL** action for the whole batch:

- **URL**: `https://arnayem.top/dashboard/api/health-webhook`
- **Method**: POST
- **Headers**: `x-webhook-secret` = your secret,
  `Content-Type` = `application/json`
- **Request Body**: JSON, matching the shape above, with your variables in the
  `value` fields

Finally, Shortcuts → **Automation** → **+** → Time of Day → e.g. 07:00 daily →
run this shortcut. Turn **Ask Before Running** off, or it will never fire
unattended.

Sample types worth mapping:

| Dashboard `type` | Health sample |
| --- | --- |
| `weight` | Body Mass |
| `resting_hr` | Resting Heart Rate |
| `hrv` | Heart Rate Variability |
| `steps` | Steps |
| `active_energy` | Active Energy |
| `sleep` | Sleep Analysis |
| `vo2max` | VO₂ Max |

## Route 2 — Health Auto Export (paid, much less work)

[Health Auto Export](https://apps.apple.com/app/health-auto-export/id1115567069)
is a third-party iOS app with a REST API export destination and its own
scheduler. You point it at a URL, pick metrics, set a cadence, and it runs
itself — no per-metric Shortcut wiring.

**Caveat, stated honestly:** its JSON payload is its own shape, not the one
above, so it will not work against this endpoint as-is. Adapting the webhook to
accept its format is maybe an hour's work — ask and I'll add it. I have not
verified its exact current payload, so that estimate assumes no surprises.

## Route 3 — one-off bulk import

For backfilling history rather than ongoing sync:

Health app → your profile picture → **Export All Health Data**. You get a
`.zip` containing `export.xml` — often hundreds of MB, with every sample your
phone has ever recorded. There is no importer for this yet; ask if you want
one, and say which metrics matter, since parsing the whole file is slow and
most of it is noise.

## Checking it works

The **Sync** tab shows Apple Health's status and when it last received a push.
The **Health** tab's *Recent readings* list shows each raw value with a *from
phone* badge, so you can confirm what actually arrived — and delete anything
that came in wrong.

Test the endpoint yourself before wiring up the phone:

```bash
curl -X POST https://arnayem.top/dashboard/api/health-webhook \
  -H 'Content-Type: application/json' \
  -H 'x-webhook-secret: YOUR_SECRET' \
  -d '{"readings":[{"type":"weight","value":72.4,"unit":"kg"}]}'
```

A wrong or missing secret returns `401` and writes nothing.
