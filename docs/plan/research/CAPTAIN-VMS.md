# CAPTAIN-VMS.md: optional "own computer" VMs for Captains, on your own hardware

Written Nov 28, 2026 (PKT) by Grok Bot for mehdi. Public material only, no logins. Nothing was installed or run except `curl` reads of public pages and the GitHub API.
Labels: **[M] measured** (I read it in a source today), **[I] inferred** (follows from sources), **[G] guess**.

---

## 0. The short version (plain words)

- **mehdi's rule (Nov 28):** per-Captain VMs are **optional, opt-in**. The default stays exactly as it is today: Captains and threads run on your machine through the normal Docker driver, plus the one-computer-per-user browser container that `DEVIN-GOAL-CAPTAIN.md` builds. A Captain only gets its own VM when you tick **Own computer** on it. With the feature off there is **zero change**: no new service, no host daemon, no new default code path.
- **Does Capy have this? No.** Capy runs a Firecracker VM per thread **in its own cloud**, with fixed sizes (Small to Big Guy). On *your* hardware (desktop app or `capy dock`) threads run in a git worktree **directly as your user**, with no VM, no sandbox and no RAM/CPU quota. Capy's docs say outright that "a linked folder ... isn't a sandbox". Enterprise gets "BYOC on request" with no public details. [M] (sources in §1)
- **Who does it like mehdi wants?** OpenBot 1.0 (CopilotKit, MIT, Nov 10 2026) is the closest: one shared computer per person by default, tick **Isolated** on a Bot to give it a computer of its own, optional gVisor. But its isolated mode is Kubernetes/Business-only, and "budgets do not stop a Computer". [M] Flotilla can do better: isolated computers on a plain laptop/server, and quotas the kernel enforces.
- **Recommended v1:** one `ComputeDriver` seam with three backends:
  1. `docker` (default, today's code, unchanged),
  2. `docker-isolated`: a Captain-owned long-lived container with hard cgroup quotas, its own persistent disk, and gVisor (`runsc`) when the host has it. Linux, and Docker Desktop on Mac. No KVM needed.
  3. `lima`: a real VM per Captain through Lima (Apache-2.0). Same tool on **macOS (Apple Virtualization.framework, "vz")** and **Linux (QEMU + KVM)**.

  A tiny host helper, `flotilla-hostd`, does the VM work, because the server runs inside Docker and can't start host VMs itself. Remote access in v1 = Tailscale on the host (`tailscale serve` for the web UI, Tailscale SSH or plain SSH for the box), checked by `flotilla doctor`.
- **Ordering:** start the VM run **after** `CAPTAIN-EXIT.md` merges (it reuses the computer image, live view and takeover). Best also after `UNBLOCK-EXIT.md`, because the unblock run owns the device plane, `flotilla-runner` and desktop streaming rows. The prompt checks for both and waits/coexists safely.

---

## 1. What Capy does for devices and machines

| Question | Answer | Source |
|---|---|---|
| Cloud machine per thread? | Yes: Ubuntu 24.04 Firecracker microVM, own Linux 6.1 kernel, US East only, XFCE + Chrome desktop streamed to the pane, no SSH | [M] research/CAPY.md §4 (F:L3444-3469, F:L3642); https://capy.ai/llms-full.txt line 146 |
| Quotas? | Fixed sizes, 1 vCPU/4 GB up to 16 vCPU/128 GB, billed per hour; concurrency limited by plan RAM (128 GB Lite to 1 TB Max) | [M] CAPY.md §4; llms-full line 923 |
| Your own machine? | Desktop app (mac/Win/Linux) or headless **Dock CLI** `capy dock` pairs the machine as a device. "Threads on the machine work in git worktrees under `~/.capy/worktrees`", $0 machine time | [M] https://docs.capy.ai/dock (line 5, 63) |
| Sandboxed on your machine? | **No.** "A linked folder sets where the agent starts, but it isn't a sandbox." "Threads can read and change anything that user can." | [M] CAPY.md §4 (F:L225, F:L1833) |
| Per-agent VM with RAM/CPU/disk quota on your hardware? | **No public evidence of it.** | [I] from the above |
| Self-host / BYOC? | Enterprise only: "BYOC or zero data retention on request", no public detail | [M] llms-full line 29, 966 |
| Phones | iOS/Android through Revyl (third party), screen only, max 60 min | [M] CAPY.md §4 |
| Tailscale | Cloud VMs can join your tailnet as tagged ephemeral nodes | [M] CAPY.md (F:L3303) |

**Verdict:** mehdi is right. Capy gives isolation and quotas **only in its cloud**, and gives no isolation **on your hardware**. "Own sandboxed computer per Captain on your box, with quotas you set" is a real gap Flotilla can fill. [I]

## 2. How the others do it

- **Grok Bot** (docs saved in `research/fresh/grokbot/`): **one hosted cloud computer per member**, a Linux Firecracker microVM; every Bot shares it, and each Bot gets its own screen. The **durable disk is separate from the computer**: Recreate builds a fresh computer on the latest image and keeps the disk (Bots, files, logins); Terminate keeps the disk; Delete VMs and Data removes both. It hibernates when idle. You can route its traffic through your desktop. It is **cloud only, no self-host**. [M] computers.md, deployment.md ("Hosted computer: the cloud, one per member"), private-networks.md, GROKBOT-VS-CAPY.md §3a. *Lesson for Flotilla: keep the disk separate from the VM, so Recreate/upgrade never loses logins.*
- **OpenBot** (CopilotKit, MIT app template; the "CopilotKit Intelligence" runtime is **separately licensed**, with a free local license and a paid production one) [M] https://github.com/CopilotKit/openbot README:
  - **A Computer** is either a provider sandbox (E2B, Daytona, your own account) or **your own paired machine** (a small program keeps a connection) [M] https://docs.openbot.build/developers/computers/
  - **Default:** all of a person's Bots share one computer; **Isolated** gives one Bot its own container (OpenBot for Business). Sandbox mode = Kubernetes `agent-sandbox` controller; `COMPUTER_RUNTIME=runsc` for gVisor. Shared mode across people "suits a proof of concept only" [M] README, https://www.copilotkit.ai/blog/openbot-whats-new
  - Idle sandboxes pause (`pauseAfter`); "your own machines never pause"; **"budgets do not stop a Computer"** [M] docs
  - Live takeover of the Bot's real browser, live shell view [M] blog
  - *Lessons:* the shared-by-default + Isolated-opt-in shape matches mehdi's rule exactly. Flotilla's improvements are no Kubernetes needed, works on one laptop, and **kernel-enforced quotas that do stop the computer**.
- **X chatter (public posts, signal only, not proof):**
  - Agent Tincan lists "Grok Bot (always-on VM)", e2b sandbox and others as teammates "with its own computer on your Tailscale" [M] https://x.com/mvanhorn/status/2109499870663053651
  - Northflank's path is Kata + Cloud Hypervisor where nested virt exists, gVisor where it doesn't [M] https://x.com/Shawdaimarie/status/2126013732580896774
  - Someone runs "Microsandbox and a k3s cluster with Kata Containers" per agent [M] https://x.com/andysmithai/status/2103750641839706553
  - kubernetes-sigs/agent-sandbox (Sandbox CRD, gVisor/Kata, warm pools, hibernation) is often cited [M] https://x.com/davidmarble/status/2111447992553418878
  - Open-source "forkd" Firecracker sandbox runtime [M] https://x.com/oliviscusAI/status/2087689332853506320 (not evaluated)
  - Sandbox escapes led to fixes in Kata, gVisor and Docker, so isolation choice matters [M] https://x.com/aneesmerchant/status/2114718976773349514 (secondhand report)
  - Nobody I found ships "per-agent VMs with quotas on your own laptop, managed from the agent app's UI, across Linux and macOS". [I] (absence in a search is not proof)

## 3. Candidate matrix

Licenses from the GitHub API on Nov 28, 2026 [M] unless marked. "Core-safe" means OK to depend on per the brief (no AGPL in core) and the unblock rule (prefer MIT/Apache/BSD/ISC). Calling a GPL **binary** as a separate program (QEMU) is not linking [I], but flag it.

| Option | OS | Isolation | Quotas | Persistence / snapshots | GUI desktop | Boot | License | Maturity | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| **Docker + cgroups** (today's driver) | Linux; mac/Win via Docker Desktop VM | shared kernel; Flotilla adds CapDrop ALL, no-new-privs, pids, mem, internal net [M] isolation.ts | mem, cpus, pids; disk only with xfs quota or volume size [I] | volumes; `docker commit` | Xvfb + Chromium (CAPTAIN plan) | ~1 s [G] | Apache-2.0 (Moby) | very high | **default, keep** |
| **gVisor (`runsc`)** | Linux x86/arm only | user-space kernel, strong syscall filter | same as Docker | volumes; checkpoint/restore | Xvfb works [I] | ~container | Apache-2.0 (gvisor/gvisor, 20k★) | high (Google) | **v1 hardening inside `docker-isolated`** when present |
| **Lima** | macOS (vz or QEMU), Linux (QEMU+KVM) | full VM | `cpus`, `memory`, `disk` per instance | persistent disk; `limactl snapshot` (QEMU only [I]) | yes (headless + Xvfb, or display) | tens of s [G] | Apache-2.0 (22.5k★, CNCF project [I]) | high | **v1 VM backend, both OSes** |
| **Colima** | macOS, Linux | wraps Lima | same | same | — | — | MIT (31.9k★) | high | not needed; Lima directly |
| **Incus** | Linux | system containers **and** VMs (QEMU) | rich: cpu, mem, disk, net, GPU passthrough | snapshots, copy, migrate | VM console / SPICE | s [G] | Apache-2.0 (6.7k★) | high | **LATER Linux power backend** |
| **LXD** | Linux | same as Incus | same | same | same | — | **AGPL-3.0** | high | **exclude** |
| **Firecracker** | Linux KVM only | microVM, minimal device model | vCPU, mem; rate limiters | snapshots/restore | **no display device**; VNC/CDP over network only | ~125 ms vendor claim [G] | Apache-2.0 (38k★) | very high (AWS Lambda) | LATER (Linux microVM tier) |
| **firecracker-containerd** | Linux | — | — | — | — | — | Apache-2.0, **archived** | dead | exclude |
| **Cloud Hypervisor** | Linux KVM/MSHV | microVM, more devices than FC | yes | snapshots | virtio-gpu limited [I] | fast [G] | Apache-2.0/BSD-3 [I] (API shows none) | high | LATER (via Kata) |
| **Kata Containers** | Linux KVM | VM per pod/container (QEMU/CH/FC) | via OCI limits | via runtime | headless | ~1 s [G] | Apache-2.0 (9.2k★) | high | LATER (a `docker --runtime kata` option for `docker-isolated`) |
| **libkrun / krunkit** | Linux KVM, macOS HVF | light VM | yes | — | virtio-gpu (krunkit) | fast [G] | Apache-2.0 | medium | LATER |
| **microsandbox** | Linux KVM, macOS Apple Silicon, Windows WHP | libkrun microVM | yes | volumes, **live snapshot/fork** | not focus [I] | "<100 ms" vendor | Apache-2.0 (superradcompany, 9.2k★) | medium, young | **LATER: strongest "one tool on every OS" bet**; watch |
| **apple/container + containerization** | macOS 26+ Apple Silicon only | a lightweight VM per container (Virtualization.fw) | cpus, memory | volumes | headless | sub-s [G] | Apache-2.0 (52k★ / 9k★) | young (needs macOS 26) | LATER mac backend; v1 if mehdi's Mac is macOS 26 (unverified) |
| **Lume / Cua** (trycua) | macOS Apple Silicon (macOS + Linux guests); Cua also has qemu-docker/xfce images | full VM | cpu, mem, disk | yes | **yes**, computer-use focused | — | MIT (33k★) | medium | LATER (macOS-guest computers; computer-use SDK ideas) |
| **Tart** (now `openai/tart`) | macOS Apple Silicon | full VM | yes | OCI images | yes | — | **FSL-1.1-ALv2** (source-available, Apache-2.0 after 2 yrs) [M] LICENSE | high | **not in core**; optional external only, mehdi's call |
| **OrbStack** | macOS | VMs/containers | yes | yes | — | fast | **proprietary** | high | exclude from core; works as a Docker host |
| **Multipass** | Linux, mac, Win | full VM | yes | snapshots | no | s | **GPL-3.0** | high | exclude (prefer Lima) |
| **libvirt / QEMU / KVM** | Linux (QEMU also mac) | full VM | full | full | SPICE/VNC | s | libvirt LGPL-2.1; QEMU GPL-2.0 (called as binary) | very high | Lima already drives QEMU; libvirt not needed in v1 |
| **Vagrant** | all | via providers | via provider | — | — | slow | API says MIT [M]; HashiCorp BUSL history, verify | high | exclude (dev tool, not runtime) |
| **Proxmox VE** | Linux distro | full VM/LXC | full | full | noVNC/SPICE | — | AGPL-3.0 [I] | high | exclude (it's a whole OS) |
| **systemd-nspawn** | Linux | container | cgroups | btrfs snaps | — | fast | LGPL-2.1 [I] | high | no gain over Docker |
| **Sysbox** | Linux | rootless "VM-like" containers, Docker-in-Docker without privileged | Docker's | volumes | yes | fast | Apache-2.0 (4k★) | medium | LATER: lets a Captain run Docker inside its computer safely |
| **E2B (self-host runtime)** | Linux (Firecracker + Nomad + more) | microVM | yes | pause/resume with memory | desktop SDK | fast | Apache-2.0 (`e2b-dev/runtime`) | high but heavy to self-host [I] | LATER as an external *provider* (like OpenBot) |
| **Daytona** | — | — | — | — | — | — | repo **archived** | — | exclude |
| **kubernetes-sigs/agent-sandbox** | Kubernetes | gVisor/Kata | k8s | hibernation | — | — | Apache-2.0 | medium | LATER (k8s deploys only) |
| **Alibaba OpenSandbox** | Linux | container backends | — | — | desktop | — | not checked (API moved) | medium | not evaluated |
| **unkernel** | any modern browser tab, or Node CLI | Linux 7.x compiled to wasm, inside the browser/V8 sandbox; aarch64 user space emulated + JIT | memory setting 64 MB to 4 GB in UI; CPUs = Web Workers | ext4 disk saved in IndexedDB; suspend/resume | framebuffer, Wayland apps, WebGL | "<1 s" to shell, Alpine prompt 0.3 s (vendor) | **GPL-2.0** (repo) | **2 weeks old** (created Nov 12 2026, 2.7k★) | **LATER/experimental** (see §3a) |

### Desktop streaming (for "watch / take over the whole screen")
| Option | License | Verdict |
|---|---|---|
| **CDP screencast** of Chromium (CAPTAIN plan) | Chromium BSD-3 | **v1**: no VNC needed for browser takeover |
| **neko** (m1k1o/neko, WebRTC desktop) | **Apache-2.0** (22.7k★) [M] | **LATER full desktop**, license-clean. Its image uses GStreamer (LGPL) as separate binaries [I] |
| noVNC | MPL-2.0 [I] (API NOASSERTION) | needs mehdi's decision (unblock rule) |
| Selkies | MPL-2.0 [M] | decision |
| KasmVNC / TigerVNC / libvncserver | GPL-2.0 [M] | decision; only as unmodified binaries in the guest image |

### Remote access
| Option | License | Verdict |
|---|---|---|
| **Tailscale client on the host** + `tailscale serve` (web UI on your tailnet) + **Tailscale SSH** | client BSD-3 (39.8k★) [M]; the coordination server is Tailscale's SaaS | **v1 (docs + `flotilla doctor` checks)** |
| Headscale (self-hosted coordination server) | BSD-3 (46k★) [M] | v1 docs mention; fully self-hosted path |
| **tsnet** (embed a tailnet node in a Go binary) | BSD-3 [I] (part of tailscale repo) | LATER: each Captain computer as its own tagged node (Capy's model; needs the Tailscale OAuth client = unblock row 423, a mehdi login) |
| Plain SSH | — | v1: `ssh` to the host, then `flotilla computer shell <captain>` |

### 3a. unkernel (asked for by mehdi via the parent; Guillermo Rauch post https://x.com/rauchg/status/2126416223592473046 not opened by me)
- **What it is:** "A real Linux kernel, compiled to WebAssembly" with a real MMU; kernel code compiled, user programs are **unmodified aarch64 binaries emulated with a JIT**; Debian/Alpine; persistent ext4 disk in IndexedDB; TCP/IP through **Wisp proxy** (browser) or host sockets (Node); framebuffer, sound, vsock; a JavaScript SDK and a terminal CLI. [M] https://github.com/pithings/unkernel README, https://unkernel.dev
- **Proof it runs agents:** "you can just run @opencode using unkernel ... in a browser tab" [M] https://x.com/tomhaerter/status/2124587863061004397
- **Numbers (vendor):** Alpine boots in 48 MiB, prompt 0.3 s; syscalls near native; "CPU-heavy programs are well behind native" (`apk add python3` 3.4 s). [M] README
- **License:** GPL-2.0 at repo level [M]. The SDK may be licensed differently [unverified]. Fine as a separate unmodified artifact, **not** linked into core.
- **Maturity:** created Nov 12 2026, by Pooya Parsa (pi0); "licenses sponsored by Vercel" on the site [M]. Very young.
- **Networking:** needs a Wisp relay server for internet in the browser [M]. In Flotilla that relay would have to sit **behind the egress gate** [I].
- **Memory:** UI offers 64 MB to 4 GB [M]. A 4 GB ceiling fits wasm32 [I].
- **(a) No-install browser demo of Flotilla:** plausible as a **demo of one thread** (fake agent or opencode on a free model, in a tab). Not the whole app: Flotilla needs Postgres + Docker + the server [I]. **LATER**, nice for the README/landing page.
- **(b) Lightweight sandbox tier:** interesting for "run untrusted snippet / tiny agent with zero host privileges, on any OS, in Node". But aarch64 emulation is slow for builds, no Docker inside [G], 2 weeks old. **LATER, experimental `unkernel` ComputeDriver backend behind a flag; not v1.**

## 4. Top 3 per OS (for the report)

- **Linux:** 1) **Lima (QEMU+KVM)**, Apache-2.0: same tool as mac, persistent VMs, cpu/mem/disk. 2) **Docker + gVisor**, Apache-2.0: no KVM needed, fast, strong. 3) **Incus**, Apache-2.0: best quotas/snapshots/GPU, but a daemon to install (LATER). Watch: microsandbox, Kata, Firecracker.
- **macOS (Apple Silicon):** 1) **Lima with `vmType: vz`**, Apache-2.0. 2) **apple/container**, Apache-2.0, macOS 26+ only. 3) **microsandbox** (Apache-2.0, libkrun/HVF) or **Lume** (MIT) for macOS guests. Excluded from core: Tart (FSL), OrbStack (proprietary), Multipass (GPL-3.0).
- **Windows:** LATER. WSL2 + Docker driver, or microsandbox (WHP).

## 5. Recommended architecture

### 5.1 Default stays as-is (zero impact)
- `FLOTILLA_COMPUTE_ISOLATION=off` (default). Off means: no host helper is contacted, `ComputeDriver` resolves to today's `DockerMachineDriver` + the CAPTAIN per-user computer container, and the UI shows the "Own computer" toggle disabled with "Turn on in Settings → Compute".
- Migration is additive only (new tables, nullable columns). A test proves the default path issues the same Docker calls as before (snapshot of dockerode calls).

### 5.2 The seam
```ts
// packages/core/src/compute/types.ts
type ComputeBackend = 'docker' | 'docker-isolated' | 'lima';      // later: 'incus' | 'microsandbox' | 'apple-container' | 'kata' | 'unkernel'
type Quota = { vcpus: number; ramMb: number; diskGb: number; gpu?: 'none' }; // gpu later
interface ComputeDriver {
  backend: ComputeBackend;
  capacity(): Promise<HostCapacity>;                        // cpus, ramMb, diskFreeGb, kvm|vz|runsc available
  create(id: ComputerId, q: Quota, image: ImageRef): Promise<void>;
  start(id): Promise<void>; stop(id): Promise<void>;        // stop = sleep; disk kept
  snapshot(id, label): Promise<SnapshotRef>; restore(id, ref): Promise<void>;
  recreate(id, image): Promise<void>;                        // new system image, same data disk (Grok Bot model)
  destroy(id, { keepDisk: boolean }): Promise<void>;
  transport(id): ProcessTransport;                           // reuses @flotilla/core ProcessTransport
  cdpEndpoint(id): Promise<URL>;                             // for live view/takeover (CAPTAIN)
}
```
- The existing `MachineDriver` (`apps/server/src/machines/machine-core.ts`) gets a thin adapter, so crew threads of an isolated Captain run **inside that Captain's computer** (one workspace dir per thread, per-thread Linux user [I]).
- **Two disks per computer:** system image (replaceable) + data disk (`/home/agent`, Chromium profile, workspaces). Recreate never touches the data disk.

### 5.3 Who runs the VM: `flotilla-hostd`
- The server lives in Docker and must not get host root. A small helper runs on the host as the normal user (not root):
  - Linux: a systemd **user** unit. macOS: a launchd agent.
  - It listens on a unix socket mounted into the server container (`/run/flotilla/hostd.sock`) with a token.
  - It does exactly ~10 verbs, matching ComputeDriver. It refuses anything else (no arbitrary exec on the host).
- If the unblock run already built `flotilla-runner` (device plane), hostd ships as a subcommand `flotilla-runner compute serve` instead of a new binary. The VM run checks `apps/runner` first and logs the choice in DECISIONS-LOG.md.
- Installer script written and **read-only reviewed**, never piped from the internet in tests.

### 5.4 Quotas, enforced by the kernel
- **Host capacity** = detected CPUs/RAM/free disk minus a **host reserve** (default: 2 GB + 25% RAM, 1 CPU, 20 GB disk; editable).
- **Allocations:** per Captain `{vcpus, ramMb, diskGb}`. Defaults: 2 vCPU / 4 GB / 32 GB. Minimum 1/2048/16.
- **Overcommit rules:** RAM **no overcommit** (sum of RAM of *running* computers ≤ allocatable); CPU up to **2×** allocatable; disk: the sum of max sizes ≤ free disk × 0.9 (thin disks, hard cap per disk).
- **Kernel-enforced:** a new kernel guard `compute` in `packages/core/src/kernel/` denies create/start/resize that breaks the rules. Hooks can only make it stricter (same rule as budgets). A start that doesn't fit puts an orange "Needs you" card: "Not enough RAM: stop Captain X or lower its RAM".
- **Enforcement on the box:** Lima `cpus/memory/disk`; Docker `NanoCpus/Memory/MemorySwap=Memory/PidsLimit` + volume size (xfs project quota where available, else a loopback ext4 file of fixed size [I]).
- **Time/money:** a computer counts toward the Captain's wall-clock budget; budget exhaustion **stops** the computer (unlike OpenBot). Idle sleep after `FLOTILLA_COMPUTER_IDLE_MIN`.

### 5.5 Lifecycle and UI
- States: `absent → creating → running ⇄ sleeping → destroying`, plus `error`. Reconciled by the reaper on boot (event-sourced, idempotent; a lost reply = `unknown`, shown to the user, like OpenBot).
- **Settings → Compute** (greys/black, orange only for "needs you", no pills): a host capacity bar (allocated vs free), and a per-Captain row: Own computer toggle, backend (auto), sliders for CPU/RAM/disk, buttons Start / Sleep / Snapshot / Recreate / Destroy. Destroy and Recreate raise an approval card (delete = risky action per CAPTAIN gate).
- The live view and takeover from CAPTAIN work unchanged: `cdpEndpoint()` points at the Captain's own Chromium.

### 5.6 Network and security
- **No Docker socket, no host mounts** in any computer (`assertIsolated` extended to VMs). The host's `~/.ssh`, `~/.claude`, etc. are never shared.
- **Egress only through the gate:**
  - `docker-isolated`: the same internal network + gate as today.
  - `lima` on Linux: QEMU user networking with `restrict=on` plus guest forward to the gate [I], so the VM has no direct route.
  - `lima` on macOS `vz`: no per-VM host-side egress control in Lima today [I]. v1 runs the agent as a non-root guest user without sudo, guest nftables default-deny except the gate, and `HTTP(S)_PROXY` = gate. This is **weaker** (guest root could undo it), so it's labelled in the UI ("egress enforced inside the VM") and logged in DECISIONS-LOG.md. LATER: host-side pf rules or apple/container networking.
- No inbound ports. CDP binds to the VM's private interface. The server reaches it through hostd's port-forward.
- Secrets: human input during takeover is never stored (CAPTAIN BEYOND-004); the data disk is never read by the server.

### 5.7 Remote access
- **v1:**
  - Docs plus `flotilla doctor`, which checks: Tailscale present, `tailscale serve` exposing `:8080` on the tailnet only (not Funnel), SSH reachable, and warns if the UI is bound to `0.0.0.0` on a public interface.
  - `flotilla computer shell <captain>` on the host opens a shell in that Captain's computer (Lima `limactl shell`, or `docker exec`).
  - The web UI's existing shell action uses the same transport.
- **LATER:** tsnet so each computer is its own tagged ephemeral tailnet node (Capy's model), per-computer SSH certificates, Headscale one-click.

## 6. Ship now vs later

**SHIP NOW (DEVIN-GOAL-VMS.md, ~10 units), all behind `FLOTILLA_COMPUTE_ISOLATION=off` by default:**
- VM-001 `ComputeDriver` seam + adapter to `MachineDriver`; default path byte-identical
- VM-002 Host capacity + quota allocator + kernel `compute` guard (no RAM overcommit, CPU 2×, disk cap)
- VM-003 `flotilla-hostd` (or `flotilla-runner compute serve`), unix socket + token, fixed verbs, fake backend for tests
- VM-004 `docker-isolated` backend (cgroups + sized data volume + gVisor when present)
- VM-005 `lima` backend (vz on mac, QEMU/KVM on Linux), generated Lima YAML golden-tested; real boot where KVM exists
- VM-006 Guest image: Ubuntu cloud image + provision script (non-root agent, Xvfb + Chromium + Playwright MCP from the CAPTAIN computer image, guest exec agent), two-disk layout
- VM-007 Routing: Captain's runs and crew threads go to its own computer when the toggle is on; live view/takeover via `cdpEndpoint`
- VM-008 Egress through the gate for both backends + `assertIsolated` for computers
- VM-009 Settings → Compute UI + per-Captain toggle + lifecycle buttons + approval cards + orange capacity card
- VM-010 `flotilla doctor` + remote access docs (Tailscale serve/SSH, Headscale) + README section
- VM-011 Exit: eval `make eval-vms` (create/sleep/wake/recreate keeps login cookie in fixture site; quota denial; budget stop; default-off zero-impact diff)

**LATER (ranked):**
1. Full desktop streaming (neko, Apache-2.0) for "watch the whole screen"
2. Incus backend (Linux power users: GPU, snapshots, migration)
3. apple/container backend (macOS 26+)
4. microsandbox backend (one tool on Linux/mac/Windows, live fork)
5. tsnet: per-computer tailnet node + SSH (needs Tailscale OAuth client, unblock row 423)
6. Kata/Firecracker microVM tier on Linux servers
7. Sysbox so a Captain can run Docker inside its computer
8. GPU quotas (Incus/NVIDIA passthrough)
9. External providers (E2B self-host, Daytona-like), OpenBot style
10. macOS-guest computers (Lume) for Xcode work
11. Windows hosts (WSL2)
12. unkernel: browser demo + experimental wasm sandbox tier
13. Route the computer's traffic through your laptop (Grok Bot feature)

## 7. Fit with the other runs

- **CAPTAIN run** builds `deploy/computer.Dockerfile`, the `computers` table (`0500_captain_core.sql`), the computer proxy, live view, takeover and the action gate. The VM run **reuses** all of them and only adds a `backend`/`quota`/`owner_captain_id` layer. It needs CAPTAIN-EXIT merged.
- **UNBLOCK run** owns B1 (device plane, `flotilla-runner`, dock CLI, SSH/rsync BYOM), B3 (desktop stream, thread image, row 215 desktop/SSH) and row 423 (Tailscale). The VM run **does not flip** any of those rows. It must not edit `deploy/thread.Dockerfile` or `PARITY.md`, and it uses its own ledger `docs/plan/VMS-PARITY.md` and migrations `06NN_vms_*`.
- **Devin CLI PR:** no overlap.

## 8. Unverified / open
- Whether Devin's VM has `/dev/kvm` (decides whether the Lima Linux backend gets a real boot test or stays `unverified` with a live check for mehdi).
- Lima `vz` snapshot support (I believe snapshot is QEMU-only) [I]; v1 falls back to "stop + copy data disk".
- QEMU `restrict=on` + guestfwd through Lima's config for gate-only egress [I]: must be proven in a test or re-blocked.
- mehdi's Mac (8 GB RAM per the earlier chat) can hold at most one small VM next to Docker [I]; the Arch laptop (16 GB) or Devin's/your server is the better host.
- Whether mehdi's Mac is on macOS 26 (apple/container).
- Cloud Hypervisor license (API shows none; I believe Apache-2.0 OR BSD-3).
- Alibaba OpenSandbox and "forkd" not evaluated.
- The Rauch post on unkernel was not opened (cited as given); unkernel SDK license.
- Capy BYOC details are not public.
