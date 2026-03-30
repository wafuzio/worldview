# Mobile Development Workflow (Same Wi-Fi)

Use this when you want to keep working from your phone browser while the app runs on your laptop.

## 1. Start server for LAN access

```bash
npm run dev:mobile
```

This binds the dev server to `0.0.0.0` and prints:
- Local URL (laptop): `http://localhost:1776`
- Phone URL (LAN): `http://<your-lan-ip>:1776`

## 2. Open on phone

On your phone (same Wi-Fi network), open the printed Phone URL in your browser.

## 3. If phone cannot connect

1. Confirm both devices are on the same SSID.
2. Approve incoming connections for Node.js in macOS Firewall.
3. Run with explicit LAN IP:

```bash
LAN_IP=192.168.0.101 npm run dev:mobile
```

## Optional scripts

- `npm run dev:lan` — standard dev server on LAN (`0.0.0.0:1776`)
- `npm run start:lan` — production start on LAN

