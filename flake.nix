{
  description = "A VS Code extension for Pieuvre";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs?ref=24.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        nodeEnv = pkgs.nodePackages.override {
          nodejs = pkgs.nodejs_20;
        };
      in
      {
        devShell = pkgs.mkShell {
          name = "vspieuvre-dev";

          buildInputs = with pkgs; [
            # Node.js (for VS Code extension)
            nodejs_20
            yarn

            # VS Code extension tools
            vscodium
            vsce
          ];

          # Environment variables
          shellHook = ''
            echo "Dev shell ready!"
            echo "Node: $(node --version)"
            echo "VS Code: $(code --version 2>/dev/null || echo 'Install via Nix or system')"
          '';
        };

        packages.default = pkgs.stdenv.mkDerivation {
          name = "vspieuvre";
          src = self;

          # Add yarn to nativeBuildInputs
          nativeBuildInputs = with pkgs; with nodeEnv; 
            [ yarn nodejs_20 vsce webpack webpack-cli ];

          # Explicit build phases
          buildPhase = ''
            export HOME=$(mktemp -d)  # Some tools need a home directory
            vsce package
          '';

          installPhase = ''
            mkdir -p $out
            cp *.vsix $out/
          '';
        };
      }
    );
}
