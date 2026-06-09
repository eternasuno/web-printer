vim.lsp.config.tsserver = {
	cmd = { "typescript-language-server", "--stdio" },
	filetypes = { "typescript", "javascript", "typescriptreact", "javascriptreact" },
	root_markers = { "tsconfig.json", "package.json" },
	capabilities = {
		documentFormattingProvider = false,
		documentRangeFormattingProvider = false,
	},
}
vim.lsp.enable("tsserver")

vim.lsp.config.biome = {
	cmd = { "biome", "lsp-proxy" },
	filetypes = {
		"typescript",
		"javascript",
		"typescriptreact",
		"javascriptreact",
		"json",
		"jsonc",
	},
	root_markers = { "biome.json", "biome.jsonc" },
}
vim.lsp.enable("biome")
