# Web Printer MVP 业务说明书

- 文档状态：已确认，待实施授权
- 产品形态：Tampermonkey userscript
- 已验证目标：最新版 Firefox + Tampermonkey
- 后续兼容目标：最新版 Chrome、Safari + Tampermonkey
- 首批验收站点：Solid 2、Effect v4 文档
- 实施门禁：未经产品所有者明确授权，不删除或修改源码与测试

## 1. 产品定义

Web Printer 是一个仅供个人使用的 userscript。它从当前页面发现同源链接，让用户选择页面，批量抓取并使用 Readability 提取正文，最后在新窗口生成适合浏览器打印或保存 PDF 的合并文档。

核心流程：

```text
打开目录页
→ 从 Tampermonkey 菜单启动
→ 发现当前 DOM 中的同源链接
→ 用户确认页面
→ 抓取、提取并净化正文
→ 新窗口预览
→ 浏览器打印或保存 PDF
```

重写不兼容旧业务代码、UI、设置或存储数据。保留正确的 Vite、TypeScript、Vitest、Biome 和 userscript 构建配置。

## 2. 非目标

MVP 不实现：

- XPath、CSS selector 或目录容器输入
- 自动识别侧边栏或文档框架
- 递归爬站、sitemap 导入或跨源抓取
- 登录页面、付费墙或访问控制绕过
- 站点专用适配器
- Readability 之外的提取器或正文选择兜底
- 自动或手动重试
- 可配置并发、超时或请求头
- 页面搜索、过滤、分组、拖拽排序或选择集保存
- 源站 CSS、字体或交互复制
- 自定义打印 CSS 或设置持久化
- 图片下载、base64 内嵌或离线资源包
- 内建 PDF 引擎或 HTML 下载
- 合并文档内部链接重映射
- 旧数据迁移

## 3. 运行环境与入口

- userscript 匹配所有 HTTP/HTTPS 页面。
- 只注册一个 Tampermonkey 菜单命令。
- 页面加载时不扫描 DOM、不发起请求、不显示悬浮按钮。
- 只支持公开页面。
- 首先在最新版 Firefox + Tampermonkey 上人工验收。
- Chrome 和 Safari 在实际通过验证前只能称为兼容目标。

## 4. 链接发现

### 4.1 页面输入

外部 DOM adapter 按文档顺序读取当前页面：

- 页面 URL
- `document.title`
- 所有 `<a href>`
- 每个链接的 `textContent`、`aria-label` 和子图片 `alt`

业务用例处理这些项目自有数据，不直接读取 `Document`。

### 4.2 候选规则

只保留：

- `http:` 或 `https:` URL
- 与当前页面同源的 URL

不限制路径前缀。导航、正文、页眉或页脚中的同源链接均可能成为候选，由用户自行排除。

排除：

- 纯 fragment 链接
- 外部链接
- 无法解析的链接
- 常见图片、音视频、字体、压缩包、可执行文件和 PDF

至少排除以下扩展名，匹配忽略大小写：

```text
.pdf
.png .jpg .jpeg .gif .webp .avif .svg .ico
.mp3 .wav .ogg .mp4 .webm
.woff .woff2 .ttf .otf
.zip .tar .gz .rar .7z
.exe .dmg .pkg .deb .rpm
```

不主动加入当前页面；如果 DOM 中存在明确指向当前页面的普通链接，该链接仍可成为候选。

### 4.3 URL 规范化与去重

1. 以当前页面 URL 为 base 解析相对 URL。
2. 删除 fragment。
3. 删除追踪参数，参数名匹配忽略大小写：
   - `utm_*`
   - `ref`
   - `source`
   - `campaign`
   - `fbclid`
   - `gclid`
4. 保留其他 query，且不主动重排参数。
5. 去重时忽略非根路径末尾的 `/`。
6. 请求 URL 保留第一次出现的规范化形式。
7. 保留第一次出现的位置和 DOM 顺序。

### 4.4 链接名称

名称按以下顺序回退：

1. `textContent`
2. `aria-label`
3. 子图片 `alt`
4. URL pathname
5. 完整 URL

名称去除首尾空白，并把连续空白折叠为一个空格。

没有候选链接时不打开空对话框，不自动处理当前页面，只显示轻量 toast。

## 5. 页面选择

使用当前页面中的原生模态 `<dialog>`。

每项显示：

- 复选框
- 链接名称
- URL pathname
- 悬停时的完整 URL

规则：

- 默认全部不选。
- 支持单项选择、Select all、Deselect all、Start 和 Close。
- Select all 选择所有候选。
- 没有选中项时禁用 Start。
- 显示选中数量。
- 最终顺序保持候选 DOM 顺序，而非点击顺序。
- Escape 可关闭，并正确恢复焦点。

不提供搜索、过滤、分组或排序。

## 6. 预览窗口

用户点击 Start 时必须在该用户手势中同步调用 `window.open()`。

若窗口被拦截：

- 不开始抓取。
- 不关闭选择对话框。
- 使用 toast 提示用户允许弹窗。

窗口成功打开后：

- 关闭选择对话框。
- 立即显示标题、进度和 Cancel。
- 抓取逻辑仍运行在来源页面 userscript 中。
- 全部任务结束后按选择顺序一次性渲染最终文档。

抓取期间关闭预览窗口等同取消任务。

## 7. 页面收集

收集一个页面包含完整处理链：

```text
fetch
→ 验证 HTTP 状态与 Content-Type
→ Readability 提取
→ 资源和链接 URL 转换
→ 重复 h1 处理
→ DOMPurify 净化
→ 验证正文
→ 生成成功或失败结果
```

### 7.1 请求

- 只使用 `GM_xmlhttpRequest`。
- 固定并发数为 4。
- 单页超时为 20 秒。
- 不重试。
- 单页失败不终止其他页面。
- 请求完成顺序不改变输出顺序。

GM fetch adapter 只负责：

- 把回调 API 转为 Promise
- 把网络错误和超时转换为项目错误类型
- 解析响应头
- 返回项目自有响应数据

业务用例负责：

- 非 `2xx` 响应失败
- 接受 `text/html` 和 `application/xhtml+xml`
- 缺少 `Content-Type` 时仍尝试解析
- 明确为其他类型时失败
- 不执行重试

### 7.2 Readability

只使用 `@mozilla/readability` 提取正文。

Readability adapter 接收原始 HTML 和来源 URL，在内部创建 `Document`，返回项目自有的标题和 HTML 字符串。

以下情况提取失败：

- `Readability.parse()` 返回 `null`
- 正文 HTML 为空
- 正文只有空白内容

章节标题回退顺序：

1. Readability 标题
2. 候选链接文字
3. 抓取页面的 `document.title`
4. 页面 URL

### 7.3 HTML 转换

HTML document adapter 只接受和返回字符串及项目类型，在内部完成 DOM 操作。

正文链接全部基于来源页面 URL 转为绝对 URL。

图片支持：

- `img[src]`
- `img[srcset]`
- `source[srcset]`
- `img[data-src]`
- `img[data-srcset]`

当标准属性缺失时使用对应的懒加载属性。`srcset` 中每个 URL 单独绝对化。图片加载失败不使整页失败。

每篇文章由预览统一渲染章节标题。如果正文第一个内容元素是同文本 `<h1>`，删除该正文标题。比较时忽略大小写、首尾空白和连续空白；不删除其他标题。

### 7.4 HTML 净化

复用 DOMPurify。采用默认配置，并额外禁止：

```text
iframe
object
embed
script
style
```

删除所有内联 `style` 属性。危险协议、事件属性和可执行内容不得进入预览。

必须尽量保留：

- 标题、段落、列表和引用
- `pre`、`code`、`kbd`、`samp`
- 图片、`picture` 和 `source`
- 表格
- 普通链接
- 语义 HTML 结构

不复制来源脚本、样式、字体或交互行为。

## 8. 取消语义

Cancel 只显示在预览窗口。

预览窗口通过 `postMessage` 发送包含随机任务 ID 的取消消息。来源页面必须同时验证：

- `event.source` 是当前预览窗口
- 消息类型正确
- `taskId` 与当前任务一致

取消后：

1. 停止调度尚未开始的请求。
2. 不主动中止已经开始的 GM 请求。
3. 预览显示 `Cancelling…`。
4. 等待最多 4 个进行中请求完成、失败或超时。
5. 按原顺序生成部分结果。

未开始的页面显示取消占位。已经开始的请求按其最终真实结果显示成功或失败。

## 9. 进度与结果

进度状态至少包括：

```text
Preparing…
Fetching N / Total…
Cancelling…
Building preview…
Completed
```

每个页面最终状态为：

- 成功：标题、净化后的正文和来源链接信息
- 失败：链接名称、URL 和简短原因
- 取消：未开始页面的取消占位

失败原因不得显示内部堆栈，至少覆盖：

- Timeout
- Network error
- HTTP error
- Unsupported content type
- Failed to parse document
- Readability returned no content

预览顶部显示成功、失败和取消数量，并列出失败页面。单页失败不阻止打印。

## 10. 组装、预览与打印

合并文档标题使用来源目录页的 `document.title`，为空时使用 hostname。

每个来源页面渲染为独立 `<article>`：

- 第一篇不强制前置分页。
- 后续文章使用 `break-before: page`。
- 失败和取消占位保持原选择位置。

预览只提供：

- Print
- Close

不自动打开打印对话框。打印稿不在链接文字后显示 URL，但 PDF 中链接应保持可点击。

固定打印 CSS 至少覆盖：

- 正文字体、宽度和标题层级
- 代码块换行或溢出
- 表格边框、换行和分页
- 图片最大宽度
- 引用和链接
- 章节分页
- 失败占位
- 打印时隐藏工具栏和控制项

## 11. Toast

来源页面使用轻量、纯文本、非阻塞 toast 显示：

- 没有候选页面
- 预览窗口被拦截
- 预览窗口已关闭
- 任务已取消
- 未预期错误

Toast 应自动消失并具备合理的可访问性语义。不为此建立通用通知框架。

## 12. 架构

### 12.1 结构

```text
src/
├── entity.ts
├── port.ts
├── usecase/
│   ├── discover.ts
│   ├── select.ts
│   ├── collect.ts
│   └── assemble.ts
├── adapter/
│   ├── page-dom.ts
│   ├── html-document.ts
│   ├── readability.ts
│   ├── dompurify.ts
│   ├── gm-fetch.ts
│   ├── selection-dialog.ts
│   ├── preview-window.ts
│   ├── toast.ts
│   └── tampermonkey-menu.ts
└── main.ts
```

不为结构图创建空文件、barrel exports、类层级、DI 容器、repository、service、gateway 或独立 workflow 层。

### 12.2 依赖方向

```text
main.ts → usecase + adapter
usecase → entity.ts + port.ts
adapter → entity.ts + port.ts
```

禁止：

```text
usecase → adapter
usecase → DOM / Window / GM globals
usecase → Readability / DOMPurify
usecase → 第三方库原生类型
```

用例可以使用标准 `URL`，但不能使用 `Document`、`Element`、`Window`、`MessageEvent`、GM、Readability 或 DOMPurify 类型。

### 12.3 `entity.ts`

只定义项目自有业务类型和错误类型，例如：

- PageSnapshot
- CandidateLink
- SelectedPage
- FetchResponse
- FetchFailure
- ExtractedArticle
- CollectedPage
- CollectionProgress
- PrintDocument

不得包含外部能力接口或第三方原生类型。

### 12.4 `port.ts`

集中定义所有外部能力接口，只放接口，不放实体、错误或实现。接口保持小型并按业务角色拆分，至少包括：

- PageReader
- PageFetcher
- ArticleExtractor
- HtmlTransformer
- HtmlSanitizer
- LinkSelector
- Preview
- Notifier
- MenuRegistrar

### 12.5 四个用例

`discover.ts`：

- URL 解析、过滤、追踪参数删除、去重、命名和顺序
- 不访问真实 DOM 或网络

`select.ts`：

- 默认未选择、单项切换、全选、全不选、开始条件和稳定顺序
- 不访问 dialog 或事件对象

`collect.ts`：

- 编排 fetch、状态和类型验证、Readability、HTML 转换、DOMPurify
- 固定并发、进度、失败隔离和取消语义
- 不直接依赖任何 adapter

`assemble.ts`：

- 把收集结果按原顺序转换为打印文档模型
- 生成失败汇总和分页信息
- 不渲染真实窗口或 HTML 文档壳

### 12.6 adapters

- `page-dom.ts`：读取当前页面 DOM，返回项目快照
- `html-document.ts`：DOMParser、资源转换和重复标题处理
- `readability.ts`：包装 Readability，返回项目类型
- `dompurify.ts`：包装 DOMPurify 和固定净化配置
- `gm-fetch.ts`：包装 `GM_xmlhttpRequest`
- `selection-dialog.ts`：选择对话框 DOM 与交互
- `preview-window.ts`：窗口、进度、取消、打印和关闭
- `toast.ts`：来源页面通知
- `tampermonkey-menu.ts`：菜单注册

所有 adapters 只通过项目自有简单类型和 `port.ts` 与用例交换数据。

### 12.7 `main.ts`

`main.ts` 是唯一 composition root，负责创建 adapters、注册菜单并串联四个用例。

它不得实现 URL 规则、并发池、HTTP/Content-Type 规则、Readability、净化、资源重写或失败汇总。

## 13. 测试策略

测试按用例和 adapter 分开。每个新模块先写规格测试，再实现。

```text
test/
├── usecase/
│   ├── discover.test.ts
│   ├── select.test.ts
│   ├── collect.test.ts
│   └── assemble.test.ts
└── adapter/
    └── 按高价值外部映射创建测试
```

不请求真实网站，也不保存 Solid 或 Effect 的完整 fixture。内容测试使用最小内联 HTML。

### 13.1 用例测试

使用手写 fake ports，覆盖：

- 同源、fragment、追踪参数、query、尾斜杠和资源过滤
- 名称回退、DOM 顺序和去重
- 默认不选、全选、全不选和稳定选择顺序
- 最大并发 4
- 乱序完成时保持输入顺序
- 单项失败不阻塞批次
- 取消后停止调度并等待在途任务
- 未开始项标记取消
- HTTP 状态和 Content-Type 业务规则
- 成功、失败和取消汇总
- 分页标记和文档标题回退

### 13.2 Adapter 测试

用最小内联 HTML 或替代外部 API，覆盖：

- 页面 DOM 到项目快照的映射
- Readability 正常和空内容结果
- `pre`、`code`、表格和图片保留
- 相对链接、`src`、`srcset`、`data-src` 和 `data-srcset`
- 重复首个 `<h1>`
- 危险元素、事件属性、协议和内联样式清理
- GM 成功、网络错误和超时映射
- dialog 的默认状态和批量选择
- popup blocked
- Cancel 消息的 source 与 task ID 校验

不追求脆弱的完整 DOM 快照。不新增依赖只为自动检查导入方向。

## 14. 人工验收

首批站点：

- `https://v2.solidjs.com/`
- `https://www.effect.website/docs/v4/onboarding`

在最新版 Firefox + Tampermonkey 上至少验证：

1. 两个站点均能发现同源候选链接。
2. 默认无选中项，并支持逐项、全选和全不选。
3. 可处理至少 30 个页面，并发不超过 4。
4. 输出顺序与候选 DOM 顺序一致。
5. 标题、正文、代码块、图片和表格适合打印。
6. 相对链接和图片资源正确绝对化。
7. 单页失败不会终止任务，失败占位和汇总准确。
8. Cancel 停止调度新请求并保留在途请求的最终结果。
9. 关闭预览窗口等同取消。
10. 每篇文章独立分页。
11. Print 打开浏览器打印对话框，工具栏不进入打印稿。
12. popup blocked 时不开始抓取并给出提示。

Firefox 验收通过后，再分别验证 Chrome 和 Safari；通过前不得声明已正式支持。

## 15. 工程范围

实施获批后：

- 删除现有 `src/` 中的旧业务实现。
- 删除或替换描述旧流程的测试。
- 删除或重写描述旧架构和旧 UI 的文档。
- 删除旧选择器输入、自定义 CSS、存储和迁移能力。
- 删除不再使用的模块和依赖。

保留：

- Git 历史
- Vite、TypeScript、Vitest、Biome 和 vite-plugin-monkey 配置
- lockfile 和开发环境配置
- `@mozilla/readability`
- `dompurify`
- Tampermonkey 类型
- 仍然准确的开发指令

## 16. 实施顺序

必须获得明确的“开始重写”授权后执行：

1. 删除旧业务测试和实现。
2. 建立 `entity.ts` 与 `port.ts`。
3. 依次为 discover、select、collect、assemble 写测试并实现。
4. 为外部 adapters 写高价值测试并实现。
5. 在 `main.ts` 完成 composition。
6. 删除剩余旧业务代码。
7. 运行 lint、typecheck、test 和 build。
8. 在 Firefox + Tampermonkey 上验收两个真实站点。
9. 验收通过后更新实现相关文档。
10. 后续验证 Chrome 和 Safari。

## 17. 完成定义

MVP 完成必须满足：

- Firefox + Tampermonkey 人工验收通过。
- Solid 2 和 Effect v4 均完成真实流程验证。
- 至少稳定处理 30 页。
- 固定并发 4、单页超时 20 秒、无重试。
- 非 `2xx` 和明确非 HTML 响应失败。
- 单页失败不终止任务，最终顺序稳定。
- 取消和关闭窗口语义符合本文。
- Readability、资源转换和 DOMPurify 流水线符合本文。
- 危险内容、属性和协议不进入预览。
- 每篇文章独立分页，并提供 Print 和 Close。
- 内层 usecase 不直接依赖 DOM、Window、GM 或第三方库。
- 自动化测试不依赖真实网络或真实站点 fixture。
- `pnpm run lint`、`pnpm run typecheck`、`pnpm run test`、`pnpm run build` 全部通过。
- 旧流程文档已删除或更新。
- Chrome 和 Safari 在通过验证前明确标记为未验证兼容目标。

## 18. 当前授权状态

本文已获批准写入仓库，但尚未获得源码重写授权。

在产品所有者明确回复“开始重写”前，不得：

- 删除或修改现有源码
- 删除或修改现有测试
- 修改依赖
- 开始实现新业务流程
