# Putting Tukuza SIS online with a Cloudflare Tunnel

This lets students and lecturers open the **real, live** system in a browser at
`https://edu.fpuniversitycollege.com` — students view results, lecturers enter
and edit them — while the database stays on the school's desktop computer.
There is only ever one database, so there is nothing to sync or reconcile.

```
 Browser ──https──▶ Cloudflare ──tunnel──▶ cloudflared ──▶ Tukuza SIS (127.0.0.1:4000)
                                              (same PC)        (same PC)
```

Nothing is opened on the school's router or firewall: `cloudflared` makes an
*outbound* connection to Cloudflare, and the SIS server only listens on the
PC's own loopback address.

## Before you start — three things to check

1. **Is `fpuniversitycollege.com`'s DNS managed by Cloudflare?** A named tunnel
   with a custom hostname requires that. If the domain's DNS is at the
   registrar or the web host instead, you can add it to a free Cloudflare
   account — but that means switching the domain's nameservers, which also
   moves the *main website and email*. Do not do that casually: whoever manages
   the website must confirm every existing DNS record (website, `MX` for email,
   etc.) was imported correctly first, or the site/email can go down.
   If you can't do that yet, use the **quick test** below, or put the system on
   a separate domain that is on Cloudflare.
2. **The PC must be on, awake, and running the SIS app** whenever people need
   access. The tunnel only works while the app is open. Use a dedicated office
   machine, set Windows power settings to never sleep, and add the app to the
   Windows Startup folder so it relaunches after a reboot.
3. **The default admin password must be changed first.** It is published in the
   public repository. The app enforces this: until it is changed, the server
   refuses every request that arrives through the tunnel (people sitting at the
   PC are unaffected). On first login you'll be forced to choose a new one;
   after that, remote access switches on by itself.

## Quick test (no domain, no account, 2 minutes)

```powershell
cloudflared tunnel --url http://127.0.0.1:4000
```
(Get `cloudflared.exe` from Cloudflare's official downloads page,
https://developers.cloudflare.com/tunnel/downloads/ . A `winget` package named
`Cloudflare.cloudflared` also exists, but I couldn't confirm it in Cloudflare's
own docs, so treat the downloads page as the authoritative source.)
It prints a temporary `https://<random-words>.trycloudflare.com` address that
works while the command is running. Good for trying it out; **not** for
production — the address changes every time.

## Permanent setup

Install `cloudflared` first (see the downloads page above), then run these in PowerShell on the SIS computer:

```powershell
cloudflared tunnel login                         # opens a browser; pick fpuniversitycollege.com
cloudflared tunnel create tukuza-sis             # prints a TUNNEL-UUID and writes a credentials .json
```
Copy `config.yml.example` (this folder) to `C:\Users\<you>\.cloudflared\config.yml`
and fill in the UUID and your Windows username. Then:

```powershell
cloudflared tunnel route dns tukuza-sis edu.fpuniversitycollege.com
cloudflared tunnel run tukuza-sis                # test it; Ctrl+C to stop
```
Open `https://edu.fpuniversitycollege.com` from your phone (on mobile data, not
the school Wi-Fi) to confirm it works from outside.

### Keeping it running permanently (Windows service)

Windows services run as the SYSTEM account, which has its **own** `.cloudflared`
folder — so the files you created as yourself aren't found automatically.
This is Cloudflare's documented procedure
(https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/as-a-service/windows/),
in an **Administrator** Command Prompt:

1. Put `cloudflared.exe` somewhere permanent, e.g. `C:\Cloudflared\bin`, and run
   `cloudflared.exe service install` from there.
2. `mkdir C:\Windows\System32\config\systemprofile\.cloudflared`
3. Copy these three files from `C:\Users\<you>\.cloudflared\` into that folder:
   `cert.pem`, `config.yml`, and `<TUNNEL-UUID>.json`.
4. In the **copied** `config.yml`, change `credentials-file:` to
   `C:\Windows\System32\config\systemprofile\.cloudflared\<TUNNEL-UUID>.json`.
5. Check it: `cloudflared.exe tunnel ingress validate`
6. In Registry Editor, open
   `HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\Cloudflared` and set
   `ImagePath` to (no stray spaces):
   `C:\Cloudflared\bin\cloudflared.exe --config=C:\Windows\System32\config\systemprofile\.cloudflared\config.yml tunnel run`
7. `sc start cloudflared`

After any later change to the config, restart the service. The service starts
when Windows starts, but it only helps if the SIS app is also running.

## What changed in the app to make this safe

| Protection | Detail |
|---|---|
| Loopback-only listener | The server accepts connections only from the PC itself (`BIND_ADDRESS` overrides). |
| Default-password gate | No remote access while `admin` / `Admin@2026` is unchanged. Forced change on first login. |
| Per-install session secret | Generated randomly on first launch, stored in the database. (It used to be a hardcoded fallback shared by every install, which would have let anyone forge an admin login.) |
| Account lockout | 5 wrong passwords locks that account for 15 minutes, even for the right password. |
| Rate limits | 20 login attempts / 15 min per visitor IP; 600 requests / 15 min for remote visitors. The desktop's own local use is never throttled. |
| Real client IPs | Read from `X-Forwarded-For` **only** when the connection comes from the PC itself (i.e. cloudflared), so LAN users can't spoof it. Login IPs are recorded in the audit log. Cloudflare always appends the visitor's address there (their docs confirm the *Remove visitor IP headers* setting can't remove it for ordinary traffic). |
| Tunnel traffic can't pass as local | A request counts as "local" only if it has no proxy markers (`X-Forwarded-For`, `CF-Ray`, `CF-Connecting-IP`, `CDN-Loop`, …). This closes a gap that would otherwise exist if a Cloudflare Worker handled your hostname, which drops `X-Forwarded-For`. |
| CORS allow-list | Only the app itself plus origins you add in Settings → Security. Not needed if people simply open the site's address directly. |
| Settings hygiene | Sync secrets and the allow-list are hidden from non-admin accounts. |
| Sign everyone out | Settings → Security → *Sign Everyone Out* rotates the session secret instantly. |

## What this does **not** protect against — be realistic

* **The PC itself.** Anyone with physical access, or malware on that machine,
  has the whole database. Keep it locked, patched, and backed up (Backups page,
  with an offsite folder).
* **Weak or shared passwords.** There is no two-factor login. Require strong
  passwords for staff; lecturers can edit results, so their accounts matter.
* **Real student data is now reachable from the internet** (names, NRC numbers,
  fees, results). That's the nature of the feature. For an extra layer in front
  of the whole site, Cloudflare Access (free for small teams) can require an
  email one-time code before the login page even loads, and Cloudflare's WAF
  can add a stricter rate-limit rule.
* **Uptime.** It works only while the PC and the app are running.

## `edu.` already has a link — and a choice to make

The website's "SIS Portal" link points at `edu.fpuniversitycollege.com`. This
tunnel is designed to serve **that** hostname with the full live system. The
separate read-only `web-portal/` app (a synced copy that can't edit anything)
would compete for the same name; use one or the other there. If you keep both,
give `web-portal` a different hostname.
