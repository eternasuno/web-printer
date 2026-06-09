{pkgs, ...}: {
  languages = {
    javascript = {
      enable = true;
      pnpm = {
        enable = true;
        install.enable = true;
      };
    };
  };

  devcontainer = {
    enable = true;
    settings = {
      customizations.vscode.extensions = [
        "biomejs.biome"
        "eamodio.gitlens"
        "mkhl.direnv"
        "supermaven.supermaven"
      ];
    };
  };
}
