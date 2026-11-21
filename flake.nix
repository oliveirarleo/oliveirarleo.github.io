{
  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = inputs:
    let
      dev = inputs.flake-utils.lib.eachDefaultSystem (system:
        let
          pkgs = (import (inputs.nixpkgs) { inherit system; });
        in {
          devShells.default = with pkgs; pkgs.mkShellNoCC {
            buildInputs = [
              musl
              nodejs_26
              pnpm
            ];
          };
        }
      );
    in dev // {
      nixosModules.default = import ./nixos/wishlist/default.nix;
    };
}
