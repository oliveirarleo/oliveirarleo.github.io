{ config, lib, pkgs, ... }:
let
  cfg = config.services.wishlist;
in
{
  options.services.wishlist = {
    enable = lib.mkEnableOption "the shared Christmas wishlist API";

    package = lib.mkOption {
      type = lib.types.package;
      default = pkgs.callPackage ./package.nix {
        src = ../..;
        nodejs = cfg.nodePackage;
      };
      defaultText = lib.literalExpression "pkgs.callPackage ./package.nix { src = ../..; }";
      description = "Immutable wishlist API package built with buildNpmPackage.";
    };

    nodePackage = lib.mkOption {
      type = lib.types.package;
      default = pkgs.nodejs_26;
      description = "Node.js package. Node 26 is used to match the project engine requirement.";
    };

    host = lib.mkOption {
      type = lib.types.str;
      default = "127.0.0.1";
      description = "Address the API listens on. Keep this on loopback and expose it through Cloudflare Tunnel.";
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = 8787;
      description = "Port the API listens on. Production defaults to 8787; local development uses 8788 from .dev.env.";
    };

    allowedOrigin = lib.mkOption {
      type = lib.types.str;
      default = "https://oliveirarleo.com";
      description = "Exact browser origin allowed to call the API.";
    };

    hostname = lib.mkOption {
      type = lib.types.str;
      default = "wishlist-api.oliveirarleo.com";
      description = "Public hostname routed to the API by Cloudflare Tunnel.";
    };

    tunnelId = lib.mkOption {
      type = lib.types.str;
      description = "Cloudflare Tunnel ID.";
    };

    credentialsFile = lib.mkOption {
      type = lib.types.path;
      description = "Path to the Cloudflare Tunnel credentials file.";
    };

    environmentFile = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      example = "/run/secrets/wishlist.env";
      description = ''
        EnvironmentFile containing TURNSTILE_SECRET and BETTER_AUTH_SECRET.
        WISHLIST_SECRET_PEPPER belongs there too while accounts created before
        the Better Auth migration still need their first sign-in.
        A sops-nix template is recommended so secrets are not stored in the Nix store.
      '';
    };

    user = lib.mkOption {
      type = lib.types.str;
      default = "mainframe";
      description = "User running the API service.";
    };

    group = lib.mkOption {
      type = lib.types.str;
      default = "users";
      description = "Group running the API service.";
    };
  };

  config = lib.mkIf cfg.enable {
    assertions = [
      {
        # Cloudflare Universal SSL covers the apex and first-level hostnames only.
        assertion = lib.length (lib.splitString "." cfg.hostname) <= 3;
        message = "Cloudflare Universal SSL does not cover nested hostnames such as api.wishlist.oliveirarleo.com.";
      }
    ];

    services.cloudflared-tunnel = {
      enable = true;
      tunnels = {
        "${cfg.tunnelId}" = {
          inherit (cfg) credentialsFile;
          default = "http_status:404";
          ingress = {
            "${cfg.hostname}" = "http://127.0.0.1:${toString cfg.port}";
          };
        };
      };
    };

    # Daily consistent SQLite snapshot. Losing the database loses every wish and
    # every user secret, so keep the newest 14 copies.
    systemd.services.wishlist-backup = {
      description = "Back up the Christmas wishlist database";
      serviceConfig = {
        Type = "oneshot";
        User = cfg.user;
        Group = cfg.group;
        StateDirectory = "wishlist";
        UMask = "0077";
        ExecStart = pkgs.writeShellScript "wishlist-backup" ''
          set -euo pipefail
          dir=/var/lib/wishlist/backups
          mkdir -p "$dir"
          stamp=$(date -u +%Y%m%dT%H%M%SZ)
          ${pkgs.sqlite}/bin/sqlite3 /var/lib/wishlist/wishes.db ".backup '$dir/wishes-$stamp.db'"
          ls -1t "$dir"/wishes-*.db | tail -n +15 | xargs -r rm --
        '';
      };
    };
    systemd.timers.wishlist-backup = {
      wantedBy = [ "timers.target" ];
      timerConfig = {
        OnCalendar = "daily";
        Persistent = true;
      };
    };

    # Do not open the API port in the NixOS firewall.
    systemd.services.wishlist = {
      description = "Christmas Wishlist API";
      after = [ "network-online.target" ];
      wants = [ "network-online.target" ];
      wantedBy = [ "multi-user.target" ];

      environment = {
        NODE_ENV = "production";
        HOST = cfg.host;
        PORT = toString cfg.port;
        DATABASE_PATH = "/var/lib/wishlist/wishes.db";
        ALLOWED_ORIGIN = cfg.allowedOrigin;
        # The API only listens behind the Cloudflare Tunnel, so client IPs come from its headers.
        TRUST_PROXY = "true";
      };

      serviceConfig = {
        Type = "simple";
        User = cfg.user;
        Group = cfg.group;
        ExecStart = "${cfg.package}/bin/wishlist-api";
        EnvironmentFile = lib.optional (cfg.environmentFile != null) cfg.environmentFile;

        StateDirectory = "wishlist";
        StateDirectoryMode = "0750";
        UMask = "0077";

        Restart = "on-failure";
        RestartSec = 3;

        NoNewPrivileges = true;
        PrivateTmp = true;
        PrivateDevices = true;
        ProtectSystem = "strict";
        ProtectHome = true;
        ProtectKernelTunables = true;
        ProtectKernelModules = true;
        ProtectControlGroups = true;
        RestrictAddressFamilies = [
          "AF_INET"
          "AF_INET6"
          "AF_UNIX"
        ];
        RestrictNamespaces = true;
        LockPersonality = true;
        CapabilityBoundingSet = "";
      };
    };
  };
}
