# Anonymous Usage Telemetry

AgentBro can send a small anonymous daily usage snapshot to Alibaba Cloud Simple
Log Service (SLS). Anonymous usage stats are enabled by default for new configs
and can be turned off in Settings at any time.

Source builds and local development builds do not upload telemetry unless a full
SLS target is supplied at compile time.

## Release Configuration

Set these GitHub Actions secrets together:

- `AGENTBRO_TELEMETRY_SLS_HOST`
- `AGENTBRO_TELEMETRY_SLS_PROJECT`
- `AGENTBRO_TELEMETRY_SLS_LOGSTORE`

Topic and source are fixed non-secret defaults:

- Topic: `product-telemetry`
- Source: `agentbro-macos`

AgentBro writes through SLS WebTracking:

```text
POST https://<project>.<host>/logstores/<logstore>/track
```

The target Logstore must have WebTracking enabled.

## Event Contract

AgentBro uploads at most one `daily_usage_snapshot` event per local calendar day
per device. Failed uploads stay local and are retried later.

Current fields:

- app version, operating system, architecture, language bucket, surface mode,
  and coarse install channel.
- anonymous device ID generated after telemetry is active.
- `report_date`, `active_device`, and `first_seen`.
- daily app launch count.
- coarse Hook install and uninstall counts by supported agent id, plus numeric
  totals for dashboard queries.

## Viewing Metrics

Open the SLS console, select the telemetry Project and Logstore, then use query
and analysis or save the queries as dashboard charts.

Daily active devices:

```sql
event:daily_usage_snapshot | SELECT count(DISTINCT anonymous_device_id) AS dau
```

New devices:

```sql
event:daily_usage_snapshot AND first_seen:true | SELECT count(DISTINCT anonymous_device_id) AS new_devices
```

Daily installs by channel:

```sql
event:daily_usage_snapshot | SELECT report_date, install_channel, count(DISTINCT anonymous_device_id) AS devices GROUP BY report_date, install_channel ORDER BY report_date
```

Hook installs and uninstalls:

```sql
event:daily_usage_snapshot | SELECT sum(cast(hook_install_total AS bigint)) AS hook_installs, sum(cast(hook_uninstall_total AS bigint)) AS hook_uninstalls
```

## Not Collected

Telemetry must not include:

- prompts, responses, message previews, code, diffs, or terminal output.
- project paths, file paths, repository names, usernames, hostnames, SSH
  targets, IP addresses, terminal identifiers, or session IDs.
- raw Hook payloads, diagnostics contents, secrets, tokens, or API keys.

Turning anonymous usage stats off clears queued telemetry and the anonymous
device ID.
