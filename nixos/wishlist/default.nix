{ config, lib, pkgs, ... }:
let
  cfg = config.services.wishlist;
in
{
  options.services.wishlist = {
    enable = lib.mkEnableOption "the shared Christmas wishlist API";

    package = lib.mkOption {
      type = lib.types.str;
      default = "/home/mainframe/git/p/oliveirarleo.github.io";
      description = ''
        Checkout containing server/index.ts and its installed node_modules.
        Run `pnpm install --prod --frozen-lockfile` in this directory before
        starting the service.
      '';
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
      description = "Port the API listens on.";
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
        Optional EnvironmentFile containing TURNSTILE_SECRET. A sops-nix
        template is recommended so the secret is not stored in the Nix store.
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
      };

      serviceConfig = {
        Type = "simple";
        User = cfg.user;
        Group = cfg.group;
        WorkingDirectory = cfg.package;
        ExecStart = "${cfg.nodePackage}/bin/node ${cfg.package}/server/index.ts";
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
        ProtectHome = "read-only";
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
