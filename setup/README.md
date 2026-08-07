# setup/ — the first-time delivery package

This directory is what a **bare host** needs to run the dashboard the first time it is delivered:
the systemd unit, the edge route, and (when a service declares one) its rights manifest. It travels
with the delivery — the deploy chain ships `setup/` verbatim and installs its contents; it never
generates a unit or route of its own for this service, and it runs no code from this repo as root.

| File | Role |
|---|---|
| `holistic-dashboard.service` | the systemd unit — the **single source** the unit is installed from, on both a grown host (`holistic setup`) and a bare host (the deploy chain). |
| `holistic.caddy` | the edge route — a naked `handle /api/*` block imported into the host's site block, routing the whole Holistic API to the dashboard backend. |

## Names — one thing, one name each

The dashboard spans three names that are deliberately distinct, mirroring the self repo (`devlab`,
whose unit is `devlabd`):

| Name | Value | Why |
|---|---|---|
| repository / delivery id | `holistic` | the repo directory name; the id the chain derives everything from. |
| systemd unit | `holistic-dashboard` | a unit named `holistic` would collide with the landscape identity (the `holistic` service account, `/opt/holistic`, `/var/lib/holistic`, the `holistic` secret group) — so the unit carries the `-dashboard` suffix, exactly as `devlab`'s unit is `devlabd`. |
| service account | `holistic` | the landscape account the dashboard legitimately owns and runs as (`User=holistic` in the unit). |

The unit name is used consistently everywhere it appears (this file, `services/dashboard/install.sh`),
so there is exactly one spelling of it.

## Why the dashboard is a landscape-root service, not a uniform one

A uniform service answers `/api/services/<id>/*` behind its own `/opt/<id>/bin/<id>d` daemon. The
dashboard is different by necessity: it **is** the landscape UI (served at the site root) and its
backend answers the whole `/api/*` prefix. That is the same shape the self repo uses, so its route is
a naked `/api/*` handle and its unit runs as the landscape account. It carries no rights manifest of
its own: the dashboard is the rights *authority* (it hosts the central rights management), not a
rights-gated service, so there is no `hp_*` right for it to declare.
