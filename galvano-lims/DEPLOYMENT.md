# Debian VPS deployment

The production stack uses Docker Compose and Caddy. Only Caddy publishes host
ports; PostgreSQL, the API, uploads, and reports stay on a private Docker
network. Caddy obtains and renews HTTPS certificates automatically when a
domain is used.

## 1. DNS and firewall

Point the domain's `A` record to the VPS IPv4 address (and `AAAA` to its IPv6
address, if used). Allow inbound TCP ports 22, 80, and 443, plus UDP 443:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
```

Do not expose PostgreSQL port 5432 or backend port 3001.

## 2. Install Docker on Debian

Install Docker Engine and the Compose plugin from Docker's official Debian
repository. Follow: https://docs.docker.com/engine/install/debian/

Verify the installation:

```bash
sudo docker run --rm hello-world
sudo docker compose version
```

## 3. Clone and configure

```bash
sudo mkdir -p /opt/elab2
sudo chown "$USER":"$USER" /opt/elab2
git clone --branch alpha https://github.com/mcjoonior/eLAB2.git /opt/elab2
cd /opt/elab2
cp .env.production.example .env.production
```

Generate three URL-safe secrets:

```bash
openssl rand -hex 32
openssl rand -hex 64
openssl rand -hex 64
```

Put the first value in `POSTGRES_PASSWORD`, and the next two in `JWT_SECRET`
and `JWT_REFRESH_SECRET`. Set `APP_ADDRESS`, `APP_ORIGIN`, and `GUS_BIR_KEY`.
Never commit `.env.production`.

For a domain:

```env
APP_ADDRESS=lims.example.com
APP_ORIGIN=https://lims.example.com
```

For a temporary IP-only deployment without automatic TLS:

```env
APP_ADDRESS=http://203.0.113.10
APP_ORIGIN=http://203.0.113.10
```

## 4. Validate and start

Always pass the production environment explicitly:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Inspect startup logs if needed:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=200
```

Check `https://YOUR_DOMAIN/api/health` after DNS has propagated.

## Updating from GitHub

Commit and push changes from the development machine. On the VPS:

```bash
cd /opt/elab2
git pull --ff-only origin alpha
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker image prune -f
```

## Database backup

Create a local backup directory and dump PostgreSQL:

```bash
mkdir -p /opt/elab2-backups
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$(sed -n 's/^POSTGRES_USER=//p' .env.production)" \
  "$(sed -n 's/^POSTGRES_DB=//p' .env.production)" \
  | gzip > "/opt/elab2-backups/elab2-$(date +%F-%H%M%S).sql.gz"
```

Back up the named volumes for uploaded files and generated reports as well.
Test restoration before relying on backups.

## Security notes

- Rotate any GUS or application credentials that were previously committed.
- Keep `.env.production` readable only by the deployment user (`chmod 600`).
- Configure automatic VPS security updates and regular off-server backups.
- The first startup seeds default users if the database is empty. Log in
  immediately and replace or remove all default accounts/passwords.
