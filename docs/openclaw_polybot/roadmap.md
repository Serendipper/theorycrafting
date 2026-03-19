# OpenClaw Polybot Roadmap (Bare Metal -> Production)

## Assumptions / terminology
- “Bare metal with no OS” is interpreted as: *the machine is blank/unprovisioned*, not that we will literally run without any kernel/userspace. OpenClaw (and the common self-host patterns) require Linux + container runtime.
- This roadmap focuses on **self-hosted OpenClaw** plus a **separate, deterministic trading-bot runtime** that uses the strategies/templates OpenClaw helps you generate/refine.
- I don’t know your exact “bot code”/repo names from the video, so any references to `CVD` / “no-market” folders are treated as **placeholders** for your strategy repo layout.

## Recommended hardware
You proposed: `i7-12700K / 128GB RAM / RTX 3070` (x86_64).

### Works well
- CPU + RAM: fine for running Docker services, backtesting, and orchestration.
- RTX 3070: useful if you plan to run *local* ML work (e.g., transcription, embeddings). For trading execution, GPUs are usually optional.

### Strongly recommended add-ons
1. **Storage**
   - Prefer **2x NVMe SSD** (1TB+ each) for: logs, backtest artifacts, model caches, and workspace volumes.
   - If you can, do **ZFS** (optional) or software RAID-1 so you don’t lose your history on a single drive.
2. **Networking**
   - Ideally a **single static public IP** and stable egress.
   - If you need low jitter: consider **10GbE** NIC or at least a reliable GigE adapter + good router/switch.
3. **Power + safety**
   - **UPS** (so containers don’t corrupt state mid-write).
4. **GPU upgrade (optional)**
   - If you intend to run local transcription/LLM workloads, VRAM matters.
   - If budget allows: an upgrade to a **more VRAM-heavy GPU** (e.g., 16GB+) reduces swapping/time. (Only if you truly need local inference.)

## Stage 0: Define the architecture (before installing anything)
Aim for separation of concerns:
1. **OpenClaw service** (AI coding/agent workflow + UI/API)
2. **Trading runtime services** (strategy execution, exchange connectivity, risk controls)
3. **Backtesting service** (offline/historical evaluation)
4. **Observability** (logs, metrics, alerting)

Key safety principle:
- Treat AI-generated code as *untrusted* until it passes your own test suite + deterministic validation.

## Stage 1: Provision bare metal (minimal Linux container host)
### 1.1 BIOS/UEFI basics
- Enable UEFI boot (Secure Boot either way; document your choice).
- Disable unused peripherals (or at least document them).
- Set SATA/NVMe boot priority to your install target.

### 1.2 Install a minimal Linux distro
Common choices: **Debian 12/13**, **Ubuntu LTS**, or **Rocky/Alma**.
Minimum goal:
- Kernel + systemd
- Network configured
- Docker Engine ready (or containerd + Docker-compatible runtime)
No desktop environment. You want headless.

### 1.3 Partitioning / filesystem
Suggested:
- EFI partition (small, e.g., 512MB)
- Root partition (for OS)
- Dedicated data partition(s) mounted for:
  - OpenClaw persistent state
  - trading-bot workspace
  - logs
  - backtests

### 1.4 Set a static IP + DNS
- Use DHCP reservation or configure static IP.
- Confirm outbound HTTPS connectivity from the host.

### 1.5 Basic hardening
- Update packages.
- Configure firewall so only required inbound ports are open.
- Enable automatic security updates only if you’re comfortable with reboot behavior.

## Stage 2: Install Docker Engine + Compose
OpenClaw self-host guides commonly recommend Docker (and often reverse proxies), but you can also run it natively.
Checklist:
- Install Docker Engine + Docker Compose v2 (optional but recommended for isolation)
- Configure Docker to start on boot
- Verify:
  - `docker version`
  - `docker compose version`

## Alternative to Docker (native self-host)
OpenClaw is a Node/TypeScript project in many setups, so you typically need Node.js and npm available on the host.
Checklist:
- Install Node.js (the self-host guide I checked mentions `Node.js 20+`)
- Confirm:
  - `node -v`
  - `npm -v`
> Use whichever deployment mode you prefer: Docker isolation vs native simplicity.

## Stage 3: Deploy OpenClaw (self-hosted)
This stage uses a **hardened** config.
> Note: OpenClaw guides differ a bit by version (install method and config layout). Treat the snippets below as templates and verify the exact commands/paths for your installed OpenClaw version.

### 3.1 Create persistent data directory
Example path:
- `/opt/openclaw/data`

Inside it, you typically want:
- `workspace/` (agent working directory)
- `.openclaw/` (agent config/state/credentials)

### 3.2 Generate a secure gateway token
Example:
- `openssl rand -hex 32`

Store it somewhere safe (password manager / vault).

### 3.3 Create `openclaw.json` (security settings)
One self-host pattern includes gateway token auth, disabling mDNS, and turning off a publicly exposed control UI.

Use this as a starting template (replace `YOUR_256_BIT_HEX_TOKEN`):
```json
{
  "gateway": {
    "bind": "lan",
    "port": 18789,
    "auth": {
      "mode": "token",
      "token": "YOUR_256_BIT_HEX_TOKEN"
    },
    "controlUI": false,
    "discovery": {
      "mdns": { "mode": "off" }
    }
  },
  "sandbox": {
    "mode": "all",
    "scope": "agent"
  },
  "session": {
    "dmScope": "per-channel-peer"
  }
}
```

Decisions to make:
- Keep `controlUI` disabled unless you’re explicitly protecting it behind auth/TLS.
- Keep the gateway reachable only via your reverse proxy (do not expose it broadly on the internet).

### 3.4 Run OpenClaw gateway container
Typical pattern:
- start the container with:
  - environment variables for tokens and paths
  - volume mount for `/opt/openclaw/data:/data`
  - port mapping only if going through a reverse proxy

### 3.4a Native install + run (no Docker)
If you go native, a self-host guide I checked uses a global npm install:

```bash
npm install -g @anthropic/openclaw
```

Then you’d:
- create `openclaw.json` (template above)
- run the gateway (the guide’s Docker example uses `openclaw serve`; confirm the exact subcommand for your installed version via `openclaw --help`)

### 3.5 Configure reverse proxy + TLS
Recommended:
- Nginx or Caddy or Traefik
- TLS termination on 443
- Forward WebSocket upgrade headers (OpenClaw uses WebSockets in many setups)

Firewall goal:
- OpenClaw container port is not exposed publicly
- Only reverse proxy is exposed

### 3.6 Verify health + auth
Verification steps you should do:
- health endpoint returns expected status
- requests without auth return 401/403
- external access works over TLS

## Stage 4: Connect AI tooling to the trading-bot workflow (what “polybot” means here)
Use OpenClaw for:
- strategy research prompts
- code generation/refactoring
- backtest orchestration *as a helper*, not as a replacement for deterministic risk controls

Use your trading runtime for:
- actual exchange orders (with strict constraints)

### 4.1 Recommended repo layout (placeholder)
Create a repository structure like:
- `strategies/`
  - strategy definitions or templates
- `backtests/`
  - backtesting runner + results outputs
- `bots/`
  - runnable bot configs (per exchange / per account)
- `risk/`
  - position sizing, kill-switch, max loss rules
- `exchange_adapters/`
  - exchange API integration

Map to the video’s conceptual folders:
- “`backtesting.py`” (backtest runner)
- “`no-market` bots folder” (multi-account example)
- “CVD bot folder” (example bot implementation)

### 4.2 Build the RBI system (Research -> Backtest -> Incubate)
This aligns with what the speaker described:
1. **Research**
   - Generate candidate strategies from templates / known indicators
2. **Backtest**
   - Evaluate candidate strategies on historical data
   - Require a minimum bar for winrate/edge and stress tests
3. **Incubate**
   - Run live with tiny size
   - Add risk controls and periodic health checks

Safety requirement:
- No strategy goes to “incubate” without passing your validation checks.

## Stage 5: Risk controls (non-negotiable)
The video repeatedly emphasizes risk controls and debugging discipline.

Minimum risk controls to implement:
- max position size (per trade and daily)
- max drawdown / kill switch
- stop-loss / take-profit enforcement
- fee-aware sizing (fees can dominate)
- watchdog restart + alerting

Operational behavior:
- run every N seconds/minutes (choose based on exchange + strategy needs)
- check logs and fix bugs periodically

## Stage 6: Observability + maintenance
### 6.1 Logs + metrics
Log categories:
- OpenClaw logs (agent activity, gateway/auth events)
- trading runtime logs (decisions, orders placed, order errors)
- backtest logs (inputs, performance metrics)

Metrics you want:
- order success rate
- latency
- PnL / realized returns (with care)
- restart/crash counts

### 6.2 Backups
- Back up:
  - OpenClaw persistent data directory
  - trading strategy configs
  - backtest dataset indexes (not necessarily all raw data if huge)

### 6.3 Update strategy
OpenClaw + dependencies:
- stage updates in a staging environment if possible
- validate config + health checks before swapping production

## Stage 7: Concrete “first run” plan (execution order)
1. Provision minimal Linux host + Docker + firewall + reverse proxy skeleton
2. Deploy OpenClaw with a locked-down `openclaw.json` + verified TLS/auth
3. Create your strategy repo scaffolding (even if empty)
4. Implement backtesting runner stub (`backtesting.py` equivalent)
5. Implement a no-live “paper bot” first
6. Only then:
   - run incubations at tiny size
   - enforce kill switches and risk limits

## Stage 8: Testing checklist (before risking real money)
- Authentication: external requests require auth
- Websocket proxy: upgrade works
- Trading sandbox: paper trading works
- Order sanity checks: bot never sends orders outside allowed parameters
- Rate limiting: bot never violates exchange limits
- Fail-safes: kill switch triggers and stops orders

## References (from web sources I checked)
- https://www.simpleopenclaw.com/blog/self-hosting-complete-guide
- https://www.clawctl.com/blog/setup-openclaw-complete-guide

