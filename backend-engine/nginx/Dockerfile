# =============================================================================
# FunTurf edge proxy image — LOCAL DEVELOPMENT ONLY
# =============================================================================
# Built by ../docker-compose.yml to front the three local API replicas.
#
# This image is intentionally NOT deployed. Render load-balances across a
# service's instances at its own edge and terminates TLS there, so shipping our
# own nginx to production would add a redundant hop with nothing to gain. See
# ../render.yaml — it declares one backend service and no proxy.
#
# The config is baked in here (rather than only bind-mounted) so the image is
# self-contained. docker-compose additionally bind-mounts the same files
# read-only, so edits take effect via `nginx -s reload` without a rebuild.
# =============================================================================

# Pinned to a minor. `nginx:alpine` alone floats across majors and can land a
# config-breaking change on an unrelated rebuild.
FROM nginx:1.27-alpine

# Main config: workers, upstream pool, sticky hashing, WebSocket upgrade map,
# rate-limit zones, and the server block.
COPY nginx.conf /etc/nginx/nginx.conf

# Shared forwarded-header snippet, `include`d by each proxying location.
# It MUST land at this exact path — nginx.conf includes it by absolute path.
# Read the header comment in that file before editing: proxy_set_header does not
# inherit once a location defines one of its own.
COPY proxy_common.conf /etc/nginx/snippets/proxy_common.conf

# NOTE: do NOT add `RUN nginx -t` here. It looks like a useful build-time guard,
# but nginx resolves the hostnames in an `upstream` block while parsing the
# config — app1/app2/app3 don't exist during a build, so it fails with
# "host not found in upstream" on a perfectly valid file.
# Validate against the running cluster instead:
#   docker compose exec nginx nginx -t
#
# For the same reason this container must start AFTER the replicas resolve —
# docker-compose enforces that with depends_on: condition: service_healthy.

EXPOSE 80

# No CMD/ENTRYPOINT: the official nginx image already runs
# `nginx -g "daemon off;"` in the foreground and installs a signal-handling
# entrypoint that supports graceful reload. Overriding it buys nothing.
