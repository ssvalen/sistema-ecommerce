# Generado por deploy/edge/install-edge.sh.

upstream ecommerce_api {
    server __APP1_IP__:__API_PORT__ max_fails=2 fail_timeout=10s;
    server __APP2_IP__:__API_PORT__ max_fails=2 fail_timeout=10s;
    keepalive 16;
}

proxy_cache_path /var/cache/nginx/images levels=1:2 keys_zone=images:10m
                 max_size=500m inactive=30d use_temp_path=off;

server {
    listen 80 default_server;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2 default_server;
    server_name _;

    ssl_certificate     /etc/nginx/tls/ecommerce.crt;
    ssl_certificate_key /etc/nginx/tls/ecommerce.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_session_cache   shared:ecommerce_ssl:10m;
    ssl_session_timeout 1d;

    client_max_body_size 3m;
    access_log /var/log/nginx/ecommerce.access.log ecommerce;
    root /var/www/ecommerce;

    location ~ /\. {
        deny all;
    }

    location /api/v1/images/ {
        include snippets/ecommerce-proxy.conf;
        proxy_cache images;
        proxy_cache_valid 200 30d;
        proxy_cache_lock on;
        add_header X-Cache-Status $upstream_cache_status always;
    }

    # Las cabeceras de seguridad de la API las pone la propia API (helmet).
    location /api/ {
        include snippets/ecommerce-proxy.conf;
    }

    location /assets/ {
        include snippets/ecommerce-headers.conf;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        try_files $uri =404;
    }

    location = /index.html {
        include snippets/ecommerce-headers.conf;
        add_header Cache-Control "no-cache" always;
    }

    location / {
        include snippets/ecommerce-headers.conf;
        add_header Cache-Control "no-cache" always;
        try_files $uri /index.html;
    }
}
