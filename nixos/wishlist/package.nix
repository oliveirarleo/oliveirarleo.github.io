{ lib, buildNpmPackage, nodejs, src }:

buildNpmPackage {
  pname = "wishlist-api";
  version = "1.0.0";

  src = lib.cleanSourceWith {
    src = src;
    filter = path: type:
      let base = baseNameOf path;
      in !(builtins.elem base [ ".git" "node_modules" ".env" ".dev.env" "dist" ".astro" "data" "result" ]);
  };

  inherit nodejs;
  npmDepsHash = "sha256-DgPCD98Ip7dMZ240DekBKKvHwOrEKN/4isc/ReuBn38=";
  npmInstallFlags = [ "--omit=dev" "--ignore-scripts" ];
  dontNpmBuild = true;

  installPhase = ''
    runHook preInstall
    mkdir -p $out/lib/wishlist $out/bin
    cp -r package.json node_modules server $out/lib/wishlist/
    cat > $out/bin/wishlist-api <<EOF
    #!${nodejs}/bin/node
    import "$out/lib/wishlist/server/index.ts";
    EOF
    chmod +x $out/bin/wishlist-api
    runHook postInstall
  '';

  meta = {
    description = "Immutable Christmas wishlist API";
    mainProgram = "wishlist-api";
  };
}
