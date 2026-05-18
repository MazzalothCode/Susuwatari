# KNOWN_FACTS

## 项目基础

- 项目是一个交互式网页：用户输入单个字母/数字，或手绘单笔路径，由多个 Rive 小精灵在区域内游走并组成图形。
- 项目中文名当前语境为 `集合！灰尘精灵`。
- 技术栈包含：`Vite`、`React`、`TypeScript`、`Rive`。
- 项目当前 Git 名称语境为 `Susuwatari`。
- 当前整页 UI 使用 `little_spirit_ui.riv` 的 `Page` artboard。
- 当前输入范围是：`A-Z`、`0-9`、单笔手绘路径。
- 多字符输入功能已经放弃，当前只保留单字符/单数字。

## 当前稳定功能

- 单字符/数字切换功能正常。
- 手绘单笔路径功能正常，并且能生成对应区域与小精灵。
- 删除后会回到单个小精灵待机状态。
- `Show Anchor Debug` 功能被保留。
- 整页 Rive UI 的主要交互链路已经接通。

## 小精灵系统

- 小精灵贴边问题已经解决。
- `K / M / W / 4` 等字符的锚点重合问题经过修复后有明显改善。
- 当前生成分布、碰撞、生命周期整体稳定。
- 手绘路径宽度已经调到接近字母 `I` 的笔画宽度。
- 小精灵与字母的相对尺寸已经从“跟字母面积耦合”改为稳定方案。

## 当前稳定默认参数

- `Font Weight = 900`
- `Flow Speed = 1.0`
- `Spirit Size = 0.3`
- `Spirit Density` 当前默认值已经固定在最佳默认区间

## Brush / Page / Rive 相关

- Brush 已经可见，并且能跟随鼠标。
- Brush 的显示本身不是当前问题。
- `brushX`、`brushY` 已存在并已用于 Brush 跟随。
- `brushOpacity` 在 Rive 中是 `0-100` 范围，而不是 `0-1`。
- `Drawing` Boolean 已存在于 Brush 的 ViewModel 中，并已引入 `Page` ViewModel。
- Brush 最终有效的按下态同步目标是 `Brush/Drawing`，不是根层 `Drawing`。
- `Brush` 不需要单独拆成另一个 `.riv` 文件。
- 当前 `.riv` 文件中的 `Page` artboard 是整页 UI 的主 artboard。
- `SpiritFormationStage` 是 Brush 真实绘制状态的唯一来源。
- Brush pointer down 现在只会在中央绘制区内触发，区域外无效。
- `pointerup` 后 Brush 会恢复 `BrushIdle`。
- 当前中央绘制区是居中的正方形区域。
- 进入 `drawMode` 时，绘制区会显示 `1px` 灰色虚线边框；退出或绘制完成后边框消失。
- 页面浏览器标题当前应为 `Assemble! Susuwatari ~集合！ススワタリ～`。
- 非 draw mode 下，手型指针不应再作用于整张 Rive 页面画布，而是由 overlay 热点区域判定；进入 draw mode 后仍由 Brush 链路接管并隐藏系统光标，不与“笔”模式冲突。
- `LittleSpiritUiOverlay.tsx` 当前不再通过 CSS 给整张 `.ui-overlay-rive canvas` 直接写 `cursor: pointer`。

## 仓库 / 发布基础

- 仓库根目录当前存在 `favicon.svg`，并已作为网页 favicon 接入 `index.html`。
- 当前目录已经初始化为本地 Git 仓库，默认分支为 `main`。
- `.gitignore` 当前会忽略 `dist`、`node_modules`、`.DS_Store`、`*.tsbuildinfo` 与 `.wrangler`。
- GitHub 远程仓库当前为 `https://github.com/MazzalothCode/Susuwatari.git`。
- 项目已安装 `wrangler` 作为开发依赖，并提供 `npm run deploy:pages` 发布命令。
- `wrangler.toml` 当前使用 `name = "susuwatari"` 与 `pages_build_output_dir = "dist"`。
- Cloudflare Pages 项目当前为 `susuwatari`。
- 项目首次上线曾通过 Pages Direct Upload 成功发布到 `https://susuwatari.pages.dev/`。
- 为了保留同一个 `susuwatari.pages.dev` 地址并切换到 GitHub 自动部署，原 Direct Upload 项目已被删除并重建。
- Cloudflare Pages GitHub App 现已获得 `MazzalothCode/Susuwatari` 仓库访问权限。
- Cloudflare Pages 当前已启用 GitHub 自动部署，生产分支为 `main`。
- 当前 `susuwatari.pages.dev` 对应的是 GitHub 集成的 Pages 项目，不再是 Direct Upload 项目。
- 线上页当前可访问，且浏览器标题已确认是 `Assemble! Susuwatari ~集合！ススワタリ～`。
- 当前项目主体实现已完成，状态已进入文档审阅 / 维护阶段。

## 页面交互限制

- `src/main.tsx` 当前会全局拦截 `contextmenu` 事件，因此整页右键菜单被禁用。

## 文档状态

- `README.md` 当前已改为英文全文 / 中文全文 / 日文全文的分段结构。
- `README.md` 的英文与日文部分当前已按用户修订后的中文内容同步更新。

## 小精灵资源加载相关

- `SpiritFormationStage.tsx` 当前会先在 stage 级别调用 `useRiveFile({ src: littieSpiritUrl })` 共享加载小精灵 `.riv` 文件。
- 单个 `SpiritRive` 当前不再各自使用 `src: littieSpiritUrl` 直接加载文件，而是接收共享的 `riveFile`。

## 当前已明确不是问题的事项

- 不是 Brush 完全不可见的问题。
- 不是 Rive 主页面完全不响应的问题。
- 不是单字符/数字切换的整体生命周期问题。
- 不是锚点贴边问题。
- 不是 overlay 层级 / `z-index` 问题。
- 不是“必须把 stage 指针事件代理回 Rive canvas”才能触发的问题。

## 导出功能相关

- `little_spirit_ui.riv` 的 `Page` artboard 当前存在 `exportVideoRequest` 与 `exportGifRequest` trigger。
- `btn_video` 的 listener 在 `Pointer Down` 时会触发 `exportVideoRequest`。
- `btn_gif` 的 listener 在 `Pointer Down` 时会触发 `exportGifRequest`。
- `LittleSpiritUiOverlay.tsx` 当前会在 hydrate 完成后稳定监听 `exportVideoRequest` 与 `exportGifRequest`。
- 仅依赖 `didHydrateRef.current` 不足以保证 trigger 监听真正注册；当前已由 `isHydrated` state 驱动注册。
- WebM 当前是由 `SpiritFormationStage.tsx` 采样中央小精灵舞台后生成，不是录整页 UI。
- GIF 当前也是由 `SpiritFormationStage.tsx` 采样中央小精灵舞台后生成。
- WebM 当前导出规格是 `512x512 / 5s / 30fps / 透明背景`。
- GIF 当前导出规格是 `256x256 / 3s / 白底`。
- GIF 当前最终编码器是 `gifenc`。
- GIF 手写编码器方案已经被证伪，不能视为稳定方案。
- `exportVideoRequest` 用户已实测正常。
- `exportGifRequest` 用户已实测正常。
