# Web Printer 重构业务说明书

- 文档状态：Draft，待最终审核
- 目标版本：1.0.0 重构版
- 产品形态：Tampermonkey / Violentmonkey userscript
- 产品范围：只实现“XPath 发现链接 → 选择页面 → 批量处理 → 安全预览 → 打印”的核心闭环
- 重建门禁：产品所有者批准本文并再次授权删除前，不修改或删除现有代码

## 1. 产品定义

Web Printer 是一个本地运行的用户脚本。用户在当前文档页面输入一个 XPath 表达式发现同源文档链接，选择需要的页面后，脚本抓取页面、提取正文、净化不可信 HTML，最后生成只包含失败日志、文章标题、正文和打印按钮的预览页。

### 1.1 核心价值

- 不需要服务端，正文只在当前浏览器中处理。
- 使用浏览器原生 XPath 精确发现链接，不引入选择器依赖。
- 多个页面按 XPath 返回的文档顺序合并。
- 远程 HTML 经安全净化后才进入预览。
- 单页失败不影响成功页面，失败原因清楚可见。
- 用户可以随时取消正在执行的唯一任务。

### 1.2 目标用户

- 需要将在线技术文档保存为 PDF 的开发者和技术用户。
- 需要处理当前浏览器可访问的公开或登录后文档的用户。
- 能够为目标文档导航提供 XPath 表达式的用户。

### 1.3 非目标

V1 不负责：

- 自动发现链接或支持 CSS selector。
- 绕过登录、验证码、WAF、付费墙或访问控制。
- 递归访问已抓取页面并继续发现链接。
- 自动翻页、点击“Load more”或触发无限滚动。
- 执行目标页面 JavaScript 以等待 SPA 内容。
- 抓取跨源页面。
- 保存、暂停、恢复或重试任务。
- 保存任务历史或文章正文。
- 自定义打印 CSS。
- 在预览中删除文章、调整顺序或重试单篇。
- 复刻来源网站的样式和交互。
- 合并表单、iframe、视频、Canvas、WebGL 等交互内容。
- 提供云端同步、云端 PDF 或正文托管。

## 2. 已确认的产品决策

1. **链接发现**：V1 只支持一个由用户输入的 XPath 表达式，不支持 Auto 或 CSS 模式。
2. **域范围**：只发现和抓取与当前页面 same-origin 的链接。
3. **远程资源**：保留普通链接；允许 HTTPS 图片；不加载来源字体、样式、iframe、音视频及其他嵌入资源。
4. **任务状态**：完全不持久化。失败、取消、刷新或关闭后释放并清除活动任务、队列、文章、请求和任务锁；失败信息只能通过非持久化 UI 展示。
5. **并行任务**：同一页面同时最多只有一个活动任务。
6. **任务控制**：只支持取消，不支持暂停、继续或恢复。
7. **部分失败**：成功页面继续生成预览，同时显示失败日志，不提供重试。
8. **标题回退**：依次使用 Readability 标题、页面 `<title>`、最终 URL 的可读路径、`Page N`。
9. **默认选中**：XPath 返回的有效同源链接默认全部选中。
10. **来源 URL**：仅作为内部来源信息，用于 URL 解析和错误日志，不显示在文章或打印结果中。
11. **选择界面**：不提供搜索、筛选、排序或顺序编辑。
12. **预览界面**：只显示失败日志、文章标题、文章正文和 Print 按钮。
13. **重定向**：不提供重定向授权、重试或策略配置。
14. **远程图片**：采用固定策略，不提供图片开关。
15. **打印样式**：只提供内置默认样式，不支持自定义 CSS。
16. **兼容性**：不迁移或读取旧版设置和存储数据。
17. **依赖**：重建时升级全部直接依赖到当时的最新稳定版本并锁定。

## 3. XPath 链接发现

### 3.1 原生能力

使用浏览器原生 `document.evaluate()` 执行 XPath，不引入 XPath 第三方库。

界面只提供：

- 一个 XPath 输入框。
- Find Links 按钮。
- Cancel 按钮。
- 简短示例，例如 `//nav//a[@href]`。

V1 不提供自动发现、CSS selector、模式切换、可视化 XPath 生成器或站点规则库。

### 3.2 XPath 输入规则

- 输入不能为空。
- 表达式必须返回节点集合或可遍历节点结果。
- 返回节点若为 `<a>`，读取自身 href。
- 返回节点若为其他元素，读取其内部所有 `<a href>`。
- 不支持字符串、数字或布尔结果。
- 保持 XPath 返回节点及其内部链接的文档顺序。
- XPath 语法或结果类型错误必须显示在原对话框内。
- 错误时保留输入值和焦点，不产生未处理异常。

### 3.3 结果限制

- 只处理当前页面已经渲染的 DOM。
- 不执行链接、不触发页面交互、不递归发现。
- 排除同页 fragment 和 `[download]` 链接。
- 最多保留 200 个有效候选；超过时截断并提示用户缩小 XPath 范围。
- 所有结果仍必须经过 URL 解析、same-origin 过滤和去重。
- 发现结果必须由用户确认后才能抓取。

## 4. URL 处理和域范围

### 4.1 same-origin 定义

使用浏览器标准定义：

`scheme + hostname + effective port`

HTTP 与 HTTPS、不同子域或不同非默认端口均不属于 same-origin。

### 4.2 候选 URL 规则

1. 以当前页面 URL 为 base 解析相对 href。
2. 只接受 `http:` 和 `https:`。
3. 只接受与当前页面 same-origin 的 URL。
4. 删除 fragment；V1 不支持页内片段抓取。
5. 保留 query，不擅自删除参数。
6. 规范化主机名和默认端口。
7. 按规范化 URL 去重，保留第一次出现的位置和文字。
8. URL 含 username 或 password 时排除。
9. 无法解析的 URL 排除。

### 4.3 重定向边界

V1 不实现重定向授权、重试、策略配置或相关 UI。

抓取器可以遵循 userscript 管理器的标准重定向行为，但最终响应 URL 必须仍与当前页面 same-origin，否则该页面失败且不进入 Readability。最终 URL 只在内存中用于相对资源解析和失败日志。

## 5. 核心业务对象

### 5.1 SourceLink

- 显示文本。
- 规范化 URL。
- 文档顺序。
- 是否选中。

### 5.2 PageTask

只存在于当前运行内存：

- 请求 URL。
- 最终 URL。
- 状态：waiting、running、succeeded、failed、cancelled。
- HTTP 状态。
- Content-Type。
- 失败代码和安全日志文本。
- 提取后的 Article。

### 5.3 Article

- 标题。
- 已净化正文 HTML。
- 请求 URL 和最终 URL，仅供内部使用。
- XPath 结果顺序。

### 5.4 FailureCode

至少区分：

- `network-error`
- `timeout`
- `http-error`
- `cross-origin-redirect`
- `unsupported-content-type`
- `parse-failed`
- `no-readable-content`
- `sanitized-content-empty`
- `cancelled`
- `internal-error`

UI 文案不能作为程序判断条件。

## 6. 完整业务流程

### 6.1 初始化

1. DOM 可用后只注册“Web Printer”菜单。
2. 预览页面不得再次初始化主脚本菜单和页面 UI。
3. 初始化不自动发现或抓取页面。
4. 不读取旧版 storage，不执行数据迁移。

### 6.2 启动

1. 用户点击“Web Printer”。
2. 如果当前页面已有活动任务，拒绝第二次启动并提示任务正在运行。
3. 创建当前任务的内存状态和独立 AbortController。
4. 打开 XPath 输入对话框并等待用户提交。
5. 启动失败时显示错误并清除任务状态。

任务状态只存在于当前页面内存。刷新、关闭页面或浏览器重启后无需恢复。

### 6.3 发现和选择

1. 使用用户输入的一个 XPath 表达式发现候选元素。
2. 执行 URL 解析、same-origin 过滤和去重。
3. 无结果时保留对话框，允许修改 XPath 后重新发现。
4. 显示候选链接 checkbox 列表。
5. 有效候选默认全部选中。
6. 界面只支持单项选择、全选、全不选、返回修改 XPath 和取消。
7. 不支持搜索、筛选、排序或顺序编辑。
8. 最终顺序固定为 XPath 结果的文档顺序。

### 6.4 执行

1. 用户确认选择后，在用户手势内同步预创建空白预览窗口。
2. 按选择顺序创建 PageTask。
3. 使用有限并发抓取页面。
4. 请求完成顺序不改变输出顺序。
5. 单页失败记录失败日志，并继续处理其他页面。
6. 进度按已进入终态的任务数计算，不按成功文章数计算。
7. 进度 UI 显示 completed、succeeded、failed 和 total。
8. 晚到回调不得覆盖 timeout、cancelled 或其他终态。

### 6.5 取消

1. 运行界面提供 Cancel。
2. Cancel 停止启动新请求。
3. Cancel 调用所有在途 GM 请求的 `abort()`。
4. 请求间隔 delay 和 timeout 监听 AbortSignal。
5. 取消后关闭进度 UI 和空白预览窗口。
6. 清除全部文章、失败日志、队列和活动任务状态。
7. 取消后不显示部分结果，也不允许恢复。

### 6.6 完成和失败

- 全部成功：生成预览。
- 部分成功：在预览顶部显示失败日志，随后显示成功文章。
- 全部失败：在来源页面显示非持久化失败日志，关闭空白预览窗口并清除活动任务状态。
- 任务级内部错误：中止全部在途请求，显示错误并清除任务状态。
- 任何结束路径都必须释放活动任务锁。
- 不提供自动或手动重试。

### 6.7 Popup blocked

如果预创建窗口被拦截，任务仍继续。任务成功后在来源页面显示一个需要用户点击的 Open Preview 操作，复用当前内存中的结果，不重新抓取。该操作不属于预览内容，页面刷新后结果可以丢失。

### 6.8 预览内容

预览页只包含：

1. 部分失败时的失败日志。
2. 每篇文章的标题。
3. 每篇文章的正文。
4. Print 按钮。

预览页不包含来源 URL、资源警告、目录、删除、调序、重试、设置、历史或恢复入口。打印只能由用户点击 Print 后触发。

## 7. 网络处理

### 7.1 默认参数

- 全局并发：3。
- 请求启动间隔：500 ms。
- 单请求超时：30 秒。
- 不自动重试。

V1 不提供设置界面。参数作为内置常量，后续版本如有明确需求再开放配置。

### 7.2 响应校验

进入正文提取前必须满足：

- HTTP 最终状态为 2xx。
- 最终 URL 与当前页面 same-origin。
- Content-Type 为 `text/html`；Content-Type 缺失时只允许通过受控检查确认 HTML。
- 响应未被取消。

3xx 不作为正文结果；4xx 和 5xx 不进入 Readability。

### 7.3 超时

超时必须：

- 从真实请求开始时计时。
- 调用底层 GM request 的 `abort()`。
- 将页面标记为 `timeout`。
- 释放并发槽。
- 忽略晚到回调。

单页超时不终止整批任务。

## 8. 内容处理流水线

固定顺序：

1. 校验响应状态、最终 URL 和 Content-Type。
2. 以最终响应 URL 建立解析上下文。
3. 使用 Readability 提取标题和正文。
4. 将允许的 URL 属性绝对化。
5. 使用成熟 allowlist sanitizer 净化正文。
6. 对净化后的 URL 再做协议和资源检查。
7. 生成 Article。
8. 按 XPath 结果顺序加入预览。

Readability 是正文提取器，不是安全净化器。

### 8.1 URL 绝对化

以每篇页面的最终 URL 为 base，至少处理：

- `a[href]`
- `img[src]`
- `img[srcset]`
- `source[src]`
- `source[srcset]`

使用标准 URL API，不使用合并文档的单一 `<base>`。无法解析的 URL 属性移除。fragment-only 链接仅在可安全映射到当前文章锚点时保留，否则移除。

### 8.2 HTML 允许列表

允许：

- `article`、`section`、`div`、`span`
- `h1`–`h6`、`p`、`br`、`hr`
- `ul`、`ol`、`li`、`dl`、`dt`、`dd`
- `strong`、`em`、`b`、`i`、`u`、`s`、`mark`、`small`、`sub`、`sup`
- `pre`、`code`、`kbd`、`samp`
- `blockquote`、`q`
- `table`、`caption`、`thead`、`tbody`、`tfoot`、`tr`、`th`、`td`
- `figure`、`figcaption`
- `a`、`img`、`picture`、`source`

### 8.3 必须移除

至少移除：

- `script`、`noscript`
- `iframe`、`frame`、`object`、`embed`
- `form`、`input`、`button`、`select`、`textarea`
- `meta`、`base`、`link`
- 来源 `style` 和内联 `style` 属性
- `audio`、`video`、`canvas`
- 未允许的 SVG 和 MathML
- 所有 `on*` 事件属性
- `srcdoc`
- 未列入允许列表的属性
- `javascript:`、`vbscript:`、`file:`、`blob:` 和未知协议

### 8.4 链接和图片

- 普通链接允许 `http:` 和 `https:`。
- `<img>` 和 `<picture>` 内 `<source>` 的 `src`、`srcset` 只允许 `https:`。
- `data:` 图片禁止。
- 图片限制在打印页面宽度内。
- 不提供远程图片开关。
- 不下载或内嵌图片。
- 不加载来源字体、样式、iframe、音视频或其他嵌入资源。
- 外部链接不得获得预览窗口的 opener 能力。

## 9. 默认打印样式

V1 只提供项目内置的固定打印样式，不提供设置菜单、CSS 编辑器、CSS storage 或恢复默认操作。

打印规则：

- Print 工具栏和失败日志在打印时隐藏。
- 文章默认另起一页，首篇除外。
- 长代码块允许跨页。
- 图片限制在页面宽度内。
- 表格支持换行和安全分页。
- 链接在 PDF 中保持可点击。
- 不显示来源 URL。

## 10. 预览安全

- 预览与来源页面 DOM 隔离。
- 预览窗口不允许来源内容访问 `window.opener`。
- 来源正文不能覆盖或伪造 Print 控件。
- 使用限制性 CSP 作为纵深防御，不能替代 sanitizer。
- 不执行来源脚本或复制来源 CSP。
- userscript 不在预览页递归初始化主流程。
- 标题和失败日志使用与输出上下文匹配的安全写入方式。

## 11. 持久化边界

V1 不需要 GM storage：

- 不保存 XPath。
- 不保存网络参数。
- 不保存 CSS。
- 不保存任务、文章、日志或历史。
- 不读取或迁移 `wp-custom-css`、`wp-batch-config` 等旧版数据。
- 重建后的项目采用全新默认行为，旧版存储值保持未使用状态即可。

## 12. Userscript 权限

只保留实际需要的能力：

- `GM_registerMenuCommand`：启动入口。
- `GM_xmlhttpRequest`：抓取用户选择的 same-origin 页面并支持 abort。

不申请 storage、设置菜单或未使用的 grant。Readability 和 sanitizer 打包进 userscript，不使用运行时 CDN。发布产物中的权限、版本和依赖必须可检查、可复现。

## 13. UI 与无障碍

- 全流程可仅用键盘完成。
- XPath 和链接选择对话框具有 dialog 语义、标题关联和模态状态。
- 焦点进入、圈闭和关闭后恢复正确。
- XPath 输入具有 label，错误与字段关联。
- 进度具有 progressbar/status 语义。
- 失败日志通过可访问状态区域呈现。
- 状态不只依赖颜色。
- 图标按钮具有可访问名称，不使用 emoji 作为功能图标。
- Select All 的 checked/indeterminate 状态正确。
- 支持 200% 缩放和高对比度。

## 14. 非功能要求

### 14.1 性能

- XPath 过滤后最多处理 200 个候选。
- 100 页任务严格遵守并发上限。
- 页面完成后尽快释放原始响应字符串。
- Cancel 后 1 秒内停止启动新请求。
- 预览 100 篇常规文档仍可滚动和打印。

### 14.2 可靠性

- XPath 文档顺序和输出顺序确定。
- 单页失败不影响其他页面。
- 每个 PageTask 进入唯一终态。
- 晚到回调不改变终态。
- 任意退出路径都释放请求、timer、进度 UI、占位窗口和任务锁。
- 重复启动不会创建第二个活动任务。
- 任务结束后不残留可恢复状态。

### 14.3 可维护性

- 核心调度、URL 规则和稳定输出顺序不直接依赖 DOM、GM 全局或 Window。
- XPath DOM、网络、Readability、sanitizer 和预览分别有明确边界。
- 采用满足核心流程的最小目录和抽象。
- 核心用例覆盖成功、页面失败、取消和边界测试。

## 15. 依赖升级策略

重建开始时采用 npm registry 当时的最新稳定版本：

- TypeScript
- Vite
- vite-plugin-monkey
- Vitest
- DOM 测试环境
- Biome
- Mozilla Readability
- Tampermonkey 类型声明
- 成熟 HTML sanitizer

规则：

- 不使用 beta、rc 或 nightly，除非单独批准。
- `package.json` 不长期声明 `latest`。
- 写入明确版本或受控 semver 范围。
- 提交 lockfile，使用 frozen lockfile 安装。
- package version 是产品版本单一来源。
- userscript `@version` 从 package version 生成。
- Git tag、package version 和 userscript version 一致。
- Readability 和 sanitizer 打包进入 userscript。

## 16. 测试策略

### 16.1 XPath 与 URL

- 空 XPath、合法 XPath、非法 XPath。
- 节点集合、单节点、容器节点和不支持的结果类型。
- XPath 返回顺序稳定。
- 相对 URL、same-origin、跨源、非 HTTP(S)、fragment 和去重。
- 候选数量上限。

### 16.2 批处理

- 乱序完成时保持 XPath 顺序。
- 并发和请求间隔符合内置参数。
- 单页 HTTP、网络、timeout、跨源重定向、解析和净化失败不影响其他页面。
- timeout 调用真实 abort。
- Cancel 中止所有在途请求并清空任务状态。
- 第二次启动被运行锁拒绝。
- 部分失败显示日志和成功文章。
- 全部失败不生成文章预览。

### 16.3 内容安全

- 相对 `href/src/srcset` 以各自 finalUrl 绝对化。
- `<script>`、事件属性、`javascript:`、`srcdoc`、危险 SVG 等不能执行。
- 来源 CSS 不进入预览。
- 标题和日志不能逃逸输出上下文。
- 未允许的远程资源不会加载。
- 预览不能控制来源窗口。

### 16.4 浏览器和打印

至少完成：

- Tampermonkey + Chromium 冒烟。
- Tampermonkey + Firefox 冒烟。
- Violentmonkey + Chromium 冒烟。
- Violentmonkey + Firefox 冒烟。
- 长代码、宽表格、大图、中文、无标题和多页正文打印样本。
- 自动化无障碍扫描和一次人工键盘检查。

## 17. 验收标准

### 17.1 核心流程

- 用户输入一个 XPath 后发现链接。
- 非法 XPath 保留对话框并显示错误。
- 只展示 same-origin 的 HTTP(S) 候选。
- 候选按 XPath 文档顺序展示并默认选中。
- 用户确认后开始唯一活动任务。
- 输出文章顺序与候选顺序一致。
- 部分失败时显示失败日志和成功文章。
- 全部失败时显示日志并退出。
- Cancel 后无请求、timer、文章或任务状态残留。
- 成功后预览只显示失败日志、标题、正文和 Print。

### 17.2 网络和安全

- 并发不超过内置值。
- timeout 和 Cancel 真实中止请求。
- 非 2xx、非 HTML及跨源最终 URL 不进入 Readability。
- 所有正文经过 URL 绝对化和 sanitizer。
- 恶意 fixture 在预览中不能执行。
- 远程资源符合固定策略。
- 预览窗口与来源窗口隔离。

### 17.3 工程和发布

- lint、strict typecheck、测试和 production build 全部通过。
- metadata 自动校验通过。
- 四个目标 userscript/浏览器组合冒烟通过。
- frozen lockfile 构建可复现。
- tag、package 和 userscript version 一致。
- 发布工作流先 verify 再 build。
- 发布产物保持 `dist/web-printer.user.js`。

## 18. 重建门禁

### Gate 0：说明书批准

产品所有者明确批准本文。批准前不删除或修改现有源码。

### Gate 1：旧版冻结

- 记录当前 commit。
- 保留可安装 userscript、lockfile 和测试结果。
- 保存安全、提取和打印 fixture。

旧版冻结只用于回滚，不要求新版本读取或迁移旧数据。

### Gate 2：删除批准

产品所有者再次明确下达“可以删除并重建”的指令。

删除前：

- 创建可恢复的 git 分支或 tag。
- 保留 `.git` 和本说明书。
- 不删除历史提交或旧版发布附件。

### Gate 3：最小骨架

- 使用重建日最新稳定依赖。
- frozen install、lint、typecheck、test 和 build 可执行。
- userscript 可安装、菜单可见、预览不递归初始化。

### Gate 4：核心闭环

- XPath → 选择 → 抓取 → 提取 → 净化 → 预览 → 打印可用。
- 运行锁、失败日志和 Cancel 符合本文。
- 安全样本不能执行。

### Gate 5：发布候选版

- 全部验收标准通过。
- 权限审查通过。
- 四个目标组合冒烟通过。
- 发布 prerelease 并验证真实文档站。
- 保留回滚方式。

## 19. 审核清单

- [ ] Userscript 仍是首发形态。
- [ ] V1 只支持一个用户输入的 XPath，不支持 Auto 或 CSS。
- [ ] 只发现和抓取 same-origin 链接。
- [ ] 不实现自定义重定向策略或授权流程。
- [ ] 固定允许 HTTPS 图片，不提供图片开关。
- [ ] 不持久化任务、文章、日志、XPath 或设置。
- [ ] 不读取或迁移任何旧版 storage。
- [ ] 只允许一个活动任务，只支持 Cancel。
- [ ] Cancel、失败和刷新后不保留任务状态。
- [ ] 部分失败显示日志并继续预览成功文章，不提供重试。
- [ ] 预览只显示失败日志、标题、正文和 Print。
- [ ] 不提供搜索、筛选、排序、删除单篇或重试单篇。
- [ ] 不支持自定义打印 CSS，只使用内置样式。
- [ ] 所有直接依赖在重建日升级至最新稳定版本并锁定。
- [ ] Readability 和 sanitizer 打包进入 userscript。
- [ ] 删除代码前仍需再次明确授权。
