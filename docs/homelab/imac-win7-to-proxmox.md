# iMac (Windows 7) → Proxmox — backup, test, cutover

Friend-helper plan: keep Plex and other services safe, prove restores work, then wipe Windows 7 and stand up **Proxmox VE** on the Intel iMac.

**Last updated:** 2026-07-22

**Assumption:** This is an **Intel** iMac currently running **Windows 7** (typically Boot Camp). Apple Silicon cannot run Proxmox as a bare-metal host. Confirm model year before you touch disks.

---

## Goals

1. **No silent data loss** — media libraries, configs, and credentials leave the machine *before* the OS is destroyed.
2. **Prove migration** — restore Plex (and other services) on a throwaway Linux target and confirm playback / clients still work.
3. **Cut over cleanly** — install Proxmox, restore services as VMs/LXCs, document rollback if hardware hates Linux.

---

## Phase 0 — Inventory (do this first, on-site)

Write answers down (paper or a shared note). Do not skip.

### Hardware

- [ ] Exact model: Apple menu is gone on Win7 — check sticker, `System Information` equivalents, or boot Option-key firmware screen / serial → [Apple coverage checker](https://checkcoverage.apple.com/) / EveryMac.
- [ ] Year / CPU / RAM / internal disk size and type (HDD vs SSD vs fusion).
- [ ] Does it have a **T2** chip? (roughly late-2018+ Intel Macs). T2 means Secure Boot + extra Linux friction.
- [ ] Working **wired Ethernet** path? Prefer USB/Thunderbolt dongle over Wi‑Fi for a server. Bring a known-good USB NIC + USB keyboard if built-in input is flaky under Linux.
- [ ] Free USB stick (≥16 GB) for installer; second stick or external drive for backups.

### Services currently running on the iMac

| Service | Data path(s) | Config / DB path | Ports | Notes |
|---------|--------------|------------------|-------|-------|
| Plex Media Server | media folders | `%LOCALAPPDATA%\Plex Media Server\` | 32400, etc. | Library DB + metadata matter as much as video files |
| Other servers | … | … | … | Fill in (Arr stack, Samba, game servers, etc.) |
| Scheduled tasks / startup apps | — | — | — | Anything that must come back day one |

Also capture:

- [ ] Local admin account name(s); BitLocker / VeraCrypt status (**Win7 rarely has BitLocker**; still check encryption).
- [ ] Network: current IP, DHCP reservation, hostname, any port forwards / Dynamic DNS.
- [ ] Plex claim / remote access state; where media lives (internal disk vs external USB/NAS).
- [ ] Rough disk usage for media vs OS vs other.

**Exit criteria:** You can name every service that must survive, and you know which disks hold the irreplaceable bits.

---

## Phase 1 — Backup (before any destructive install)

Treat this as **two layers**: file/app backup (what you restore into Proxmox) and a **full disk image** (what you roll back to if the experiment fails).

### 1a — Stop writes where it helps

- [ ] Pause big downloads / library scans.
- [ ] Quit Plex cleanly so the DB is consistent.
- [ ] Note external drive letters; do not unplug mid-copy.

### 1b — Application / data backup (primary restore path)

Copy to at least **one** external drive you control (two is better: “keep” + “take home”).

**Plex (Windows):**

- [ ] Entire `Plex Media Server` app-data folder (preferences, DB, metadata, plug-ins).
- [ ] All media roots (or confirm they already live on a disk you are *not* wiping).
- [ ] Export / screenshot: libraries, agents, remote access, claimed server name.
- Official reference: [Plex — Moving a Plex installation](https://support.plex.tv/articles/201370363-move-an-install-to-another-system/) (Windows → Linux path differs; the DB/metadata folder is the valuable piece).

**Everything else:**

- [ ] Service configs, databases (SQLite/Postgres dumps), `.env` / credential stores (encrypt the backup).
- [ ] User Documents / Desktop / browser profiles if they matter.
- [ ] Any SSL certs, API keys, VPN configs.

Checksum / size check:

```text
# On a Linux/Mac helper machine after copy, or with Win tools:
# compare total bytes + spot-check a few large media files play
```

- [ ] Record total bytes copied and a few sample hashes (or just “file count + size”) so you know the copy finished.

### 1c — Full disk image (rollback)

- [ ] Create a **sector image** of the Windows system disk (Clonezilla, `dd`, Macrium Reflect Free, etc.) onto an external drive large enough for the used space (or sparse/compressed image).
- [ ] Label the drive and note date, tool, and which disk was imaged.
- [ ] Optional: image any other internal volumes you might wipe.

**Do not** rely on “we’ll just reinstall Win7” — media and Plex metadata are the hard part; the image is insurance for “Proxmox won’t boot / no NIC.”

### 1d — Backup validation

- [ ] Plug the backup drive into a **second computer**.
- [ ] Open sample videos from the media copy.
- [ ] Confirm the Plex app-data folder is present and non-empty (`Plug-in Support/Databases/`, etc.).
- [ ] Confirm the disk image file opens / Clonezilla can see it (you do not need a full restore yet).

**Exit criteria:** Second machine can read media + Plex data; image exists and is labeled; friend agrees “we can wipe after Phase 2 passes.”

---

## Phase 2 — Migration test (no Proxmox wipe yet)

Goal: prove Plex (and critical services) come up on Linux **before** destroying Windows.

### Recommended test bed

Pick one:

1. **Spare PC / old laptop** with Linux (Debian/Ubuntu) + Docker or native Plex — fastest.
2. **External SSD** temporarily booted as a Linux live/persistent install on the iMac (non-destructive if you are careful about target disk).
3. **VM on your machine** with passthrough of a copy of the media folder (slower for large libraries; fine for config smoke-test).

### Plex restore smoke test

- [ ] Install Plex Media Server on Linux (or the official Docker image).
- [ ] Stop Plex; replace its config/data directory with the **backed-up** Windows app-data (follow current Plex move docs; paths differ by install method).
- [ ] Point libraries at the **copied** media paths (update paths if drive letters became `/mnt/...`).
- [ ] Start Plex; claim/sign-in if required; verify:
  - [ ] Libraries appear
  - [ ] Poster/metadata mostly intact
  - [ ] Local playback works
  - [ ] Phone / TV apps can see the server on LAN
- [ ] Fix path mapping issues *here*, not during cutover night.

### Other services

- [ ] Same pattern: restore config → start → hit health URL / client → note Linux package or Docker Compose snippet you will reuse under Proxmox.

### Document the “day-one” stack

Write a short target layout, for example:

| Workload | Proxmox guest | Notes |
|----------|---------------|-------|
| Plex | LXC or VM (Debian) | GPU passthrough only if you need HW transcode and the iMac GPU cooperates |
| *arr / downloaders | LXC | Keep separate from Plex |
| File share | LXC (Samba) or mount host storage | Prefer media on a dedicated disk/ZFS dataset |
| Proxmox host | bare metal | Management UI only; little else |

**Exit criteria:** Friend streams something from the test Plex using a normal client. You have a written guest layout and Compose/package notes.

---

## Phase 3 — Proxmox install (destructive)

Only after Phase 1 + 2 pass and the friend says go.

### Gear checklist

- [ ] Proxmox VE ISO from [proxmox.com](https://www.proxmox.com/en/downloads) (verify checksum).
- [ ] USB written with a tool that Mac firmware likes (Etcher is common; some Macs need a special FAT32/GPT USB layout if the stock hybrid ISO will not EFI-boot).
- [ ] USB Ethernet + USB keyboard.
- [ ] Static IP plan (outside DHCP pool), gateway, DNS, hostname/FQDN (FQDN is annoying to change later).
- [ ] Backup drives **unplugged** during install so you do not wipe them by accident.

### Apple-specific gotchas (Intel)

- [ ] Boot installer via **Option (Alt)** → **EFI Boot** (not always “GRUB”).
- [ ] If T2: set Secure Boot to **No Security** via Recovery → Startup Security Utility before expecting unsigned OS USB boots.
- [ ] Expect missing Wi‑Fi / trackpad / keyboard on some models — wired NIC + USB input first.
- [ ] Prefer **wired** management networking for the host.
- [ ] T2 machines may need community T2 kernels/firmware after install for fans/Wi‑Fi/etc. Plan offline docs; do not depend on Wi‑Fi day one.
- [ ] iMac is a terrible silent 24/7 server (heat, power, display). Fine for a homelab experiment; say that out loud.

### Install steps (high level)

1. Boot installer; target **only** the disk you intend to wipe (triple-check serial/size).
2. Filesystem: ZFS mirror if two disks; otherwise ext4 or single-disk ZFS — match your comfort and RAM.
3. Set root password, email, static network, FQDN.
4. Reboot; confirm `https://<ip>:8006` from another machine.
5. Apply updates; add no-subscription repo if that is your policy; reboot once.

**Exit criteria:** Proxmox UI reachable on LAN; host has working storage and networking; Windows is gone and you still have Phase 1 backups.

---

## Phase 4 — Rebuild services on Proxmox

### Storage

- [ ] Create a dataset/directory for media (e.g. host mount or virtiofs/9p/NFS to guests).
- [ ] Copy media from backup → server storage (overnight `rsync` is fine). Prefer **one** canonical media tree.
- [ ] Keep the backup drive intact until a week of happy streaming passes.

### Guests

- [ ] Create Debian/Ubuntu LXC or VM for Plex; restore the **tested** config from Phase 2.
- [ ] Recreate other services from your notes / Compose files.
- [ ] Set restart policy / start on boot.
- [ ] Firewall: expose only what you mean to (Plex 32400/tcp, SSH on a management VLAN if you have one).

### Cutover checklist

- [ ] Clients point at the new server (IP/DNS).
- [ ] Port forwards / reverse proxy updated if remote access is required.
- [ ] Power loss test: reboot host; guests and Plex return without babysitting.
- [ ] Snapshot guests after “known good” so experiments are cheap.

**Exit criteria:** Same smoke tests as Phase 2, but on the iMac Proxmox host; friend uses it for a few days without needing Windows.

---

## Phase 5 — Harden and mop up

- [ ] Proxmox root + UI behind strong passwords; SSH keys; disable password SSH if comfortable.
- [ ] Automatic backups of guest configs (Proxmox Backup Server, or scheduled `vzdump` to external disk).
- [ ] UPS if the iMac will stay a server.
- [ ] Document: IP, root recovery, where backups live, Plex claim email, disk layout diagram.
- [ ] After ≥1 week stable: optional prune of the full Win7 disk image (keep media backup longer).

---

## Rollback

| Failure | Response |
|---------|----------|
| Proxmox installer will not boot / no NIC | Stop; do not wipe until media is sorted. Use different USB writer / EFI path / USB NIC. |
| Proxmox installed but hardware unusable | Restore the **Phase 1c** disk image to the internal disk; services resume from Win7 while you rethink hardware. |
| Plex metadata broken but media OK | Rebuild library from media; accept rescrape (why Phase 2 matters). |
| Only some services fail | Keep Proxmox; fix guests from backups; Windows image still optional insurance. |

---

## Suggested session plan (with a friend)

| Visit / block | Focus |
|---------------|--------|
| **1 — Inventory + backup** | Phase 0–1; leave with verified external copies; no wipe |
| **2 — Migration lab** | Phase 2 on spare hardware or your place; Plex streams |
| **3 — Install day** | Phase 3–4; overnight media `rsync` if needed |
| **4 — Follow-up** | Phase 5; fix remote access, snapshots, “where is the backup?” |

Bring: spare USB NIC, keyboard, ≥2 large external drives, Ethernet cable, phone hotspot as last-resort docs access, snacks.

---

## References

- [Plex — Move an install to another system](https://support.plex.tv/articles/201370363-move-an-install-to-another-system/)
- [Proxmox VE documentation](https://pve.proxmox.com/pve-docs/)
- [Apple — Startup Security Utility (T2)](https://support.apple.com/en-us/HT208330)
- Community writeups on Proxmox on Intel Macs (USB NIC, EFI Boot, T2 kernels) — useful when the stock ISO/Wi‑Fi misbehaves; treat as tips, not gospel for every iMac year.

---

## Open questions to answer before Visit 3

1. Exact iMac model / year / T2?
2. Where does the media live today (internal vs external), and how many TB?
3. Full list of “must work Monday” services beyond Plex?
4. Is remote Plex access required, or LAN-only?
5. Comfort level: LXCs + Docker vs one big VM?
