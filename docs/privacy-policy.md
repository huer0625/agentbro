# Privacy Policy

Last updated: May 28, 2026

AgentBro is a macOS utility for surfacing local AI coding agent events in a
floating island. AgentBro is designed to process coding session data locally on
your Mac.

## Data Collection

AgentBro does not sell personal information and does not use advertising
tracking.

AgentBro may send optional anonymous usage telemetry. Anonymous usage stats are
enabled by default for new configs and can be disabled in Settings at any time.

When enabled, AgentBro may send one anonymous daily usage snapshot to help
understand daily active devices, launch counts, coarse install channel, display
mode, and Hook install or uninstall counts.

Anonymous telemetry does not include prompts, responses, code, diffs, terminal
output, project paths, file paths, repository names, usernames, hostnames, SSH
targets, IP addresses, raw Hook payloads, diagnostic contents, secrets, tokens,
or API keys. See [telemetry.md](telemetry.md) for the current field allowlist.

## Local Processing

To provide its core features, AgentBro may process local information such as AI
coding session status, approvals, questions, completion notifications,
configuration files for supported tools, user preferences, and local integration
state. This information is used to display session state, route notifications,
install or remove integrations you request, and jump back to related local
windows.

## Remote SSH Features

If you enable remote SSH support, AgentBro uses the SSH target information you
provide to connect to the selected host and forward session events back to the
local app. Remote SSH information and forwarded events are used for that feature
and are not sent to AgentBro telemetry.

## Diagnostics

AgentBro may let you export diagnostics for troubleshooting. Diagnostic exports
are user-initiated and saved to a location you choose. Review diagnostic files
before sharing them in an issue or support request.

## Third-Party Services

If anonymous telemetry is enabled, AgentBro may use Alibaba Cloud Simple Log
Service to store anonymous product usage events.

For privacy questions or support, open an issue at:

https://github.com/shirenchuang/agentbro/issues
