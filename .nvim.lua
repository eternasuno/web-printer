vim.lsp.config("tsgo", {
  on_attach = function(client)
    client.server_capabilities.documentFormattingProvider = false
    client.server_capabilities.documentRangeFormattingProvider = false
  end,
})
vim.lsp.enable("tsgo")

vim.lsp.enable("biome")