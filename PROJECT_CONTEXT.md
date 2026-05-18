# PROJECT_CONTEXT

## 1. 项目概览

### 项目用途
- 一个交互式网页：用户输入单个字母/数字，或手绘单笔路径，由多个 Rive 小精灵在区域内游走并组成图形。
- 当前 UI 由整页 `Rive` 文件驱动；中央为小精灵生成区域；底部为输入、参数、模式切换等控件。

### 技术栈
- `Vite`
- `React`
- `TypeScript`
- `Rive`（整页 UI + 单个小精灵动画）

### 核心模块
- `src/app/App.tsx`
  - 页面顶层状态
  - 选中字符 / 画笔模式 / 删除 / 调试开关
- `src/components/SpiritFormationStage.tsx`
  - 小精灵舞台
  - 字母/路径区域生成
  - 锚点分配
  - 生命周期精灵池
  - 画笔绘制模式
- `src/components/LittleSpiritUiOverlay.tsx`
  - 整页 `Rive` UI 覆盖层
  - 同步 `Page` artboard 中的选字、slider、debug、delete、brush 相关字段
- `src/typography/glyphField.ts`
  - 字母区域场、采样、锚点辅助
- `src/typography/glyphLayout.ts`
  - 字母在舞台中的布局与区域尺寸

### 当前主要功能
- 单字符输入：`A-Z`、`0-9`
- 单笔手绘路径模式
- 小精灵生命周期精灵池
- 删除后回到单个精灵待机状态
- 整页 Rive UI 互动
- Brush 跟随鼠标（当前 `Drawing` 状态问题仍在调查）

### 当前已知问题
- Brush 的 `Drawing` 状态在“小精灵绘制区域内生效、区域外失效”这一行为上仍未最终确认正确。
- Brush 已经能显示并跟随鼠标，但 `pointer down` / `Drawing` 与绘制区域之间仍需验证。

---

## 2. 当前架构

### 状态流
- `App.tsx`
  - 持有：
    - 当前字符/数字选择
    - `drawMode`
    - `showAnchorDebug`
    - `brushDrawingActive`
    - 其它生成参数
- `LittleSpiritUiOverlay.tsx`
  - 从 `Page` artboard 的 ViewModel 读取：
    - `selectedKey`
    - `SliderDensity.SliderValue`
    - `SliderSpeed.SliderValue`
    - `SliderSize.SliderValue`
    - `penMode`
    - `showAnchorDebug`
    - `deleteRequest`
    - `exportVideoRequest`
    - `exportGifRequest`
    - `brushX`
    - `brushY`
    - `brushOpacity`
    - `Drawing`
- `SpiritFormationStage.tsx`
  - 接收来自 `App` 的状态
  - 生成字母区域或手绘区域
  - 维护精灵池、锚点、碰撞、生命周期
  - 通过 `onDrawPointerStateChange(active)` 向上报告“当前是否正在真实绘制”

### 事件流
- 正常字母/数字输入：
  - 用户点击 `Page` artboard 中的星星按钮
  - `selectedKey` 改变
  - `App` 同步当前字符
  - `SpiritFormationStage` 重新分配目标区域与精灵
- 手绘输入：
  - 用户点击 `penMode`
  - 进入画笔模式
  - `SpiritFormationStage` 处理绘制区域内的按下、拖动、抬起
  - 生成一笔路径并转成区域
- Brush：
  - `LittleSpiritUiOverlay` 负责把鼠标位置写到 `brushX / brushY`
  - `brushOpacity` 控制 Brush 显示
  - `Drawing` 理论上应只由真实绘制状态驱动

### 模块关系
- `App.tsx` 是单一页面状态中心
- `LittleSpiritUiOverlay.tsx` 只负责 UI / Rive 页面交互与 Brush 显示同步
- `SpiritFormationStage.tsx` 只负责中央小精灵系统与绘制区域逻辑
- `glyphField.ts` / `glyphLayout.ts` 负责字母/路径区域几何

### Rive / React / Overlay / Pointer 交互链路
- 页面 UI：`little_spirit_ui.riv` 的 `Page` artboard
- Brush：当前仍在 `Page` 内作为 component 使用，不再走独立 debug artboard 路线
- Brush 当前链路：
  - React 负责 `brushX / brushY / brushOpacity`
  - Rive 内部负责 Brush 图形与状态动画
  - `Drawing` 的正确触发范围仍在排查

---

## 3. 已确认事实

- Brush 已经可见，并且能跟随鼠标。
- Brush 的显示本身不再是问题，当前问题只剩 `Drawing` 状态触发范围。
- `Page` artboard 是整页 UI 主 artboard，当前这条接入链稳定。
- 单字符/数字输入已经稳定，多字符输入已放弃。
- 手绘路径已经可以生成区域与精灵。
- 手绘路径宽度已调到接近字母 `I` 的笔画宽度。
- 小精灵贴边问题已经解决。
- `K / M / W / 4` 等字符的锚点重合经过修复后明显改善。
- 当前生成分布、碰撞、生命周期整体稳定。
- `brushOpacity` 在 Rive 中是 `0-100`，不是 `0-1`。
- `Drawing` Boolean 已存在于 Brush 的 ViewModel 中，并已引入 `Page` ViewModel。
- `Brush` 不需要单独拆成另一个 `.riv` 文件；当前问题不是“独立文件缺失”。
- 之前独立 `BrushDebug` / 独立 Brush artboard 路线已经结束，不再继续。

### 当前稳定默认参数
- `Font Weight = 900`
- `Spirit Density` 默认值已固定在当前最佳默认
- `Flow Speed = 1.0`
- `Spirit Size = 0.3`

### 当前肯定不是问题的地方
- 不是 Brush 完全不可见的问题
- 不是 Rive UI 主页面无法响应的问题
- 不是单字符/数字切换的整体生命周期问题
- 不是锚点贴边问题

---

## 4. 已失败假设

### Brush 独立调试链路
- 方案：
  - 独立 `BrushDebug` artboard
  - 独立 Brush 浮层
  - portal / 多重调试框
- 结果：
  - 最终确认不值得继续
- 原因：
  - 最新导出机制、调试链复杂、已偏离真正问题

### Overlay 中全局 `window.pointerdown/up` 直接写 `Drawing`
- 方案：
  - 在 `LittleSpiritUiOverlay.tsx` 中直接用全局 pointer 事件控制 `Drawing`
- 结果：
  - 失败
- 失败表现：
  - 第一次画不生效
  - 第二次残留成 drawing
  - 区域外也污染状态

### 大量针对 `K / M / 4` 的交汇启发式
- 包括：
  - `junction penalty`
  - 交汇点直接拒绝
  - 交汇附近缩小游走半径
- 结果：
  - 明显误伤其它字母识别度
- 当前状态：
  - 已回退，不再重启

### 多字符输入
- 方案：
  - 支持最多三个字母
- 结果：
  - 会显著拖慢系统
- 结论：
  - 已回退为单字符/数字输入

---

## 5. 调试时间线

### [2026-05-17] Brush 独立调试路线结束
- 做了什么：
  - 对 `Brush` / `BrushDebug` artboard 进行单独渲染、调试框、portal 排查
- 改了哪些文件：
  - `LittleSpiritUiOverlay.tsx`
- 结果：
  - 最终不再继续这条路
- 是否成功：
  - 否（作为长期方案失败）
- 下一步：
  - 回到 `Page` 内 Brush component 路线

### [2026-05-17] Brush 作为 Page 内 component 恢复显示
- 做了什么：
  - Brush component 接回 `Page`
  - Brush 开始能正常显示与跟随鼠标
- 结果：
  - 可见性问题解决
- 是否成功：
  - 是
- 下一步：
  - 只排查 `Drawing` 状态触发

### [2026-05-17] 最小实验：让 `SpiritFormationStage` 成为 `Drawing` 唯一来源
- 做了什么：
  - `SpiritFormationStage.tsx` 增加 `onDrawPointerStateChange(active)`
  - 在真实绘制开始/结束时发出 `true/false`
  - `LittleSpiritUiOverlay.tsx` 删除代码侧全局 `pointerdown/up` 对 `Drawing` 的直接写入
  - `Drawing` 改为只读 `brushDrawingActive`
- 改了哪些文件：
  - `SpiritFormationStage.tsx`
  - `LittleSpiritUiOverlay.tsx`
  - `SESSION_SUMMARY.md`
- 结果：
  - 已完成代码层最小实验，等待用户实测
- 是否成功：
  - 待验证

### [2026-05-18] 建立长期项目记忆文档
- 做了什么：
  - 新建 `PROJECT_CONTEXT.md`
  - 记录项目概览、架构、事实、失败方案、时间线、当前工作状态
- 改了哪些文件：
  - `PROJECT_CONTEXT.md`
- 结果：
  - 长期记忆基线建立
- 是否成功：
  - 是
- 下一步：
  - 后续每次代码修改、验证、调试、排除问题后都必须追加更新

### [2026-05-18] 页面标题与可点击手型指针轻量修正
- 做了什么：
  - 将 `index.html` 的浏览器标题改为 `Assemble! Susuwatari ~集合！ススワタリ～`
  - 在 `src/styles/global.css` 中为整页 `Rive` UI 画布增加非 draw mode 下的 `cursor: pointer`
  - 保持 `drawMode` 时 `LittleSpiritUiOverlay.tsx` 通过 `document.body.style.cursor = 'none'` 隐藏系统光标，因此不会和 Brush 模式冲突
- 改了哪些文件：
  - `index.html`
  - `src/styles/global.css`
  - `PROJECT_CONTEXT.md`
  - `KNOWN_FACTS.md`
- 为什么改：
  - 满足 UI 文案更新需求
  - 让用户在普通模式下悬停整页 Rive 交互区时得到更符合习惯的“可点击”反馈
- 结果：
  - 代码层已完成最小改动，待构建与页面实测确认
- 是否成功：
  - 待验证
- 下一步：
  - 执行构建验证
  - 再处理 Git 仓库初始化/同步与 Cloudflare 发布链路

### [2026-05-18] Git 仓库初始化与忽略规则补全
- 做了什么：
  - 在当前目录初始化本地 Git 仓库
  - 将默认分支改为 `main`
  - 在 `.gitignore` 中补充 `*.tsbuildinfo` 与 `.wrangler`
- 改了哪些文件：
  - `.gitignore`
  - `PROJECT_CONTEXT.md`
  - `KNOWN_FACTS.md`
- 为什么改：
  - 为首次提交、远程同步与 Cloudflare Pages 发布准备干净的仓库基础
  - 避免把本地 TypeScript 构建缓存和 Cloudflare 本地目录误提交到仓库
- 结果：
  - 本地仓库已建立，已具备提交条件
- 是否成功：
  - 是
- 下一步：
  - 生成首次提交
  - 继续确认远程 Git 与 Cloudflare 发布方式

### [2026-05-18] GitHub 建仓与发布工具接线
- 做了什么：
  - 在 GitHub 中创建远程仓库 `MazzalothCode/Susuwatari`
  - 将本地仓库连接到 `origin`
  - 初次 `git push` 因 `POST git-receive-pack (chunked)` 失败，随后用 `git -c http.version=HTTP/1.1 -c http.postBuffer=524288000 push -u origin main --verbose` 成功推送
  - 安装 `wrangler` 为开发依赖
  - 新增 `wrangler.toml`，写入 Pages 项目基础配置
  - 在 `package.json` 中新增 `deploy:pages` 脚本
- 改了哪些文件：
  - `package.json`
  - `package-lock.json`
  - `wrangler.toml`
  - `PROJECT_CONTEXT.md`
  - `KNOWN_FACTS.md`
- 为什么改：
  - 满足“同步至 Git 仓库”目标
  - 为 Cloudflare Pages 持续发布准备最小可复用配置
- 结果：
  - GitHub 远程仓库已创建且首个提交已成功推送
  - Cloudflare 账户浏览器登录态已确认可用
- 是否成功：
  - 部分成功（GitHub 完成，Cloudflare 正在进行）
- 下一步：
  - 在 Cloudflare Pages 中连接 GitHub 仓库或完成首次部署

### [2026-05-18] Cloudflare Pages 首次上线完成
- 做了什么：
  - 在 Cloudflare Pages 中创建项目 `susuwatari`
  - 因 GitHub App 授权页面被 GitHub 二次验证邮件拦住，未走仓库直连发布
  - 改为将本地构建产物 `dist` 通过 Pages Direct Upload 完成首次部署
  - 部署后打开线上地址核验页面可正常访问
- 改了哪些文件：
  - `PROJECT_CONTEXT.md`
  - `KNOWN_FACTS.md`
- 结果：
  - 项目已成功上线到 `https://susuwatari.pages.dev/`
  - 线上页标题已确认为 `Assemble! Susuwatari ~集合！ススワタリ～`
  - 当前 GitHub 仓库同步已完成，Cloudflare 首次发布也已完成
- 是否成功：
  - 是
- 下一步：
  - 若后续要改为 GitHub 自动部署，需要先在 GitHub 完成 Cloudflare Pages App 对 `Susuwatari` 仓库的授权

---

## 6. 当前工作状态

### 当前正在调查的问题
- 当前本轮主要工作已切换为：
  - 页面标题修改
  - 普通模式下可点击区域的手型指针反馈
  - Git / Cloudflare 发布链路建立与首次发布

### 当前唯一假设
- 由于当前 UI 是整页 Rive 画布承载，给非 draw mode 的 overlay canvas 设置手型指针即可在不改动 Brush 逻辑的前提下提供符合用户习惯的点击反馈。

### 下一步计划
- 构建确认标题与样式修改没有破坏现有页面
- 完成本地首次提交
- 完成 Cloudflare Pages 首次上线

### 当前禁止修改的区域
- 不重启 BrushDebug / 独立 Brush artboard 调试路线
- 不重新搜索整个项目
- 不重做精灵分布、锚点、生命周期、UI 主接线
- 不在无证据情况下同时修改多个系统

---

## [追加更新 | 2026-05-18 | 导出功能阶段]

### 1. 项目概览增量
- 当前主要功能已新增：
  - 导出透明背景 WebM
  - 导出白底 GIF
- 当前已知问题已变化：
  - Brush 的 `Drawing` 状态问题本轮已完成并被用户确认，不再是当前问题
  - `exportVideoRequest / exportGifRequest` 已完成并被用户确认无问题

### 2. 当前架构增量

#### 导出状态流
- `little_spirit_ui.riv` 的 `Page` artboard 中包含：
  - `exportVideoRequest`
  - `exportGifRequest`
- `LittleSpiritUiOverlay.tsx`
  - 监听上述 trigger
  - 通过 props 调用页面级导出 handler
- `App.tsx`
  - 持有：
    - `exportVideoHandlerRef`
    - `exportGifHandlerRef`
  - 只负责承接 stage 暴露出来的导出函数与错误提示
- `SpiritFormationStage.tsx`
  - 暴露：
    - `onExportVideoReady`
    - `onExportGifReady`
  - 持有真正导出逻辑：
    - WebM：离屏透明 canvas + `captureStream()` + `MediaRecorder`
    - GIF：离屏白底 canvas 采样 + `gifenc` 编码

#### 导出事件流
- 用户点击 Rive 中的 `btn_video`
- listener 在 `Pointer Down` 时触发 `exportVideoRequest`
- `LittleSpiritUiOverlay.tsx` 监听 trigger 并调用 `onExportVideo`
- `App.tsx` 转调当前 `SpiritFormationStage` 提供的导出函数
- `SpiritFormationStage.tsx` 基于当前 live stage 采样并生成 WebM 下载

- 用户点击 Rive 中的 `btn_gif`
- listener 在 `Pointer Down` 时触发 `exportGifRequest`
- `LittleSpiritUiOverlay.tsx` 监听 trigger 并调用 `onExportGif`
- `App.tsx` 转调当前 `SpiritFormationStage` 提供的导出函数
- `SpiritFormationStage.tsx` 基于当前 live stage 采样并生成 GIF 下载

#### 当前导出规格
- WebM：`512x512 / 5s / 30fps / 透明背景`
- GIF：`256x256 / 3s / 白底`

### 3. 已确认事实增量
- `exportVideoRequest` trigger 现已真实接通，不再是空 handler。
- `exportGifRequest` trigger 现已真实接通，不再是空 handler。
- WebM 导出不是录整页 UI，而是只采样中央小精灵舞台。
- WebM 当前导出链路可稳定产出透明背景文件。
- GIF 当前导出链路可稳定产出白底文件。
- `LittleSpiritUiOverlay.tsx` 中 trigger 监听注册不能只依赖 `didHydrateRef.current` 这种 ref 变化。
- 使用 ref 记录 hydration 完成状态时，可能因为不触发重渲染而导致 trigger 从未真正 `on(...)`。
- 当前 trigger 监听注册已经改为由显式 `isHydrated` state 驱动。
- GIF 的最终可用编码方案是 `gifenc`。
- GIF 手写编码器路线已经被证伪，不应恢复。
- WebM `512x512 / 5s` 规格已经被用户实测确认正常。
- GIF `256x256 / 3s` 规格已经被用户实测确认正常。

### 4. 已失败假设增量

#### 导出 trigger 已经生效，只是编码失败
- 假设：
  - Rive 中 `btn_video` 已经正确触发，问题只在导出实现内部
- 如何验证：
  - 检查 `LittleSpiritUiOverlay.tsx` 中 trigger 监听注册逻辑
  - 发现监听受 `didHydrateRef.current` 约束，但 ref 改变不触发重渲染
- 结果：
  - 该假设不完整
  - 根因之一是 trigger 可能根本没挂上

#### GIF 白色遮挡来自白底采样层
- 假设：
  - GIF 中白色遮挡是因为采样 canvas 先铺了白底
- 如何验证：
  - 下载动作本身成功
  - 触发链正常
  - 画面异常只出现在 GIF 编码结果中
- 结果：
  - 该假设失败
  - 更接近根因的是手写 GIF 压缩/编码流本身有问题

#### 手写 GIF 编码可以作为长期稳定方案
- 假设：
  - 轻量手写全局调色板 + LZW 编码足够稳定
- 如何验证：
  - 首版 GIF 可下载
  - 用户实测发现画面被白色区域遮挡
- 结果：
  - 失败
  - 已改为 `gifenc`

### 5. 调试时间线增量

### [2026-05-18] 导出功能可行性评估
- 做了什么：
  - 检查 `exportVideoRequest / exportGifRequest` 的代码入口
  - 确认 overlay 中虽然存在 trigger，但 handler 为空
  - 评估 WebM 与 GIF 的实现可行性、时长与分辨率边界
- 改了哪些文件：
  - 无代码改动
- 结果：
  - 确认 WebM 可行、GIF 可行，但 GIF 更适合做兼容导出
- 是否成功：
  - 是
- 下一步：
  - 先落 `exportVideoRequest`

### [2026-05-18] 实现透明 WebM 导出
- 做了什么：
  - 扩展 `useVideoExport.ts`
  - 在 `SpiritFormationStage.tsx` 内新增离屏透明 canvas 录制逻辑
  - 打通 `LittleSpiritUiOverlay -> App -> SpiritFormationStage` 的导出链
- 改了哪些文件：
  - `src/app/useVideoExport.ts`
  - `src/components/SpiritFormationStage.tsx`
  - `src/components/LittleSpiritUiOverlay.tsx`
  - `src/app/App.tsx`
- 结果：
  - WebM 导出功能初步完成
- 是否成功：
  - 部分成功
- 下一步：
  - 验证 trigger 是否真正生效

### [2026-05-18] 修复 trigger 注册时机问题
- 做了什么：
  - 检查 `LittleSpiritUiOverlay.tsx` 的 trigger 监听逻辑
  - 发现 `didHydrateRef.current` 不会驱动重新渲染
  - 改为显式 `isHydrated` state 驱动注册
- 改了哪些文件：
  - `src/components/LittleSpiritUiOverlay.tsx`
- 结果：
  - `exportVideoRequest` 已被用户确认可正常触发
- 是否成功：
  - 是
- 下一步：
  - 实现 `exportGifRequest`

### [2026-05-18] 实现 GIF 导出并排除编码问题
- 做了什么：
  - 在 `SpiritFormationStage.tsx` 中加入 GIF 采样与导出逻辑
  - 初版使用手写编码器
  - 用户反馈 GIF 画面被白色区域遮挡
  - 改为安装并接入 `gifenc`
  - 增加 `src/types/gifenc.d.ts`
- 改了哪些文件：
  - `src/components/SpiritFormationStage.tsx`
  - `src/app/App.tsx`
  - `src/components/LittleSpiritUiOverlay.tsx`
  - `package.json`
  - `src/types/gifenc.d.ts`
- 结果：
  - GIF 已恢复正常导出
- 是否成功：
  - 是
- 下一步：
  - 评估最终导出规格

### [2026-05-18] 锁定最终导出规格
- 做了什么：
  - 在已可用的基础上评估 WebM 更长时长与 GIF 更高分辨率的余量
  - 按用户确认改为：
    - WebM `512x512 / 5s`
    - GIF `256x256 / 3s`
- 改了哪些文件：
  - `src/components/SpiritFormationStage.tsx`
- 结果：
  - 最终规格确定，用户实测无问题
- 是否成功：
  - 是
- 下一步：
  - 仅维护文档与长期记忆

### 6. 当前工作状态增量

#### 当前正在调查的问题
- 当前无进行中的导出问题。
- 当前无进行中的 Brush 问题。

#### 当前唯一状态
- 本轮任务已完成，当前唯一工作是维护长期记忆文档，避免未来重复探索导出链路。

#### 下一步计划
- 若未来再出现导出问题，先区分：
  - trigger 是否触发
  - stage 采样是否正确
  - 编码器输出是否正确
- 不要在没有证据时同时改 trigger、采样与编码三层。

#### 当前禁止修改的区域（增量）
- 不要把 trigger 注册逻辑改回只依赖 `didHydrateRef.current`
- 不要恢复手写 GIF 编码器
- 不要把 WebM 改回录整页 DOM 的方案

---

## 7. 增量更新记录

### [2026-05-18 | Brush pointer down 问题收尾完成]

#### 本次新增确认
- Brush `Drawing` 问题已经完成修复，并经过用户实测确认。
- 最终有效的 Rive 写入点不是根层 `Drawing`，而是 `Brush/Drawing`。
- `SpiritFormationStage.tsx` 应继续作为唯一真实绘制状态来源：
  - 仅在中央绘制区内 `pointerdown` 才开始笔画
  - 绘制开始时通过 `onDrawPointerStateChange(true)` 上报
  - `pointerup / pointercancel / finalize` 时回写 `false`
- 中央绘制区当前已固定为“居中的正方形区域”。
- 进入 `drawMode` 时，绘制区会显示 `1px` 灰色虚线边框；绘制完成或退出笔模式后边框消失。

#### 本次新增失败结论
- “把 stage 区内指针事件代理转发回 overlay / Rive canvas”不是根因修复。
  - 结果：没有解决 Brush 状态错位，还一度干扰现有绘制路径显示。
- “通过 overlay 层级 / z-index 调整来解释 Brush 不触发”也不是根因。
  - 结果：只会混淆显示层问题和状态同步问题。
- “根层 `Drawing` 可作为最终写入点”已被证伪。
  - 观测：临时诊断显示根层值不可用，而嵌套 binding 才能正确响应。

#### 本次修改文件
- `src/components/LittleSpiritUiOverlay.tsx`
- `src/components/SpiritFormationStage.tsx`
- `src/app/App.tsx`
- `src/styles/global.css`

#### 本次结果
- 区域外不会触发 Brush pointer down。
- 区域内第一次按下拖动即可触发 Brush pointer down。
- `pointerup` 后会恢复 `BrushIdle`。
- 绘制路径恢复正常显示。
- 绘制区提示边框已按需求完成。

#### 当前状态更新
- 当前没有进行中的 Brush pointer down 故障。
- 与 Brush 状态同步相关的后续修改，应优先保持现有链路不变：
  - `SpiritFormationStage -> brushDrawingActive -> LittleSpiritUiOverlay -> Brush/Drawing`
- 若未来此链路再次异常，优先先验证 binding 路径和状态来源，不要先动 overlay 层级或重启事件代理方案。

---

## 5. 调试时间线（追加）

### [2026-05-18] 建立 `KNOWN_FACTS.md`
- 做了什么：
  - 新建 `KNOWN_FACTS.md`
  - 只提取项目过程中 100% 确认的事实
  - 不写入推测、失败假设或未证实结论
- 改了哪些文件：
  - `KNOWN_FACTS.md`
  - `SESSION_SUMMARY.md`
  - `PROJECT_CONTEXT.md`
- 结果：
  - 项目现在同时拥有：
    - 长期记忆：`PROJECT_CONTEXT.md`
    - 当前目标摘要：`SESSION_SUMMARY.md`
    - 纯确认事实库：`KNOWN_FACTS.md`
- 是否成功：
  - 是
- 下一步：
  - 后续进入任何新任务前，先读这三份文档，再定义当前唯一目标

### [2026-05-18] Cloudflare Pages 切换为 GitHub 自动部署并保留原域名
- 做了什么：
  - 在 GitHub 完成 Cloudflare Pages GitHub App 对 `MazzalothCode/Susuwatari` 的仓库授权
  - 用户确认后删除原有 `susuwatari` Direct Upload Pages 项目
  - 以同名 `susuwatari` 重新创建 GitHub 集成的 Pages 项目
  - 设置生产分支为 `main`
  - 设置构建命令为 `npm run build`
  - 设置输出目录为 `dist`
- 改了哪些文件：
  - `PROJECT_CONTEXT.md`
  - `KNOWN_FACTS.md`
- 结果：
  - 新项目构建成功
  - Cloudflare 项目页显示 `Automatic deployments enabled`
  - Production 来源已切换到 GitHub `main`
  - `susuwatari.pages.dev` 继续沿用，无需更换地址
  - 线上访问时浏览器标题确认为 `Assemble! Susuwatari ~集合！ススワタリ～`
- 是否成功：
  - 是
- 验证：
  - Cloudflare 项目页可见仓库入口 `MazzalothCode/Susuwatari`
  - 最新生产部署来源为提交 `67bbd84` `Document Cloudflare Pages launch`
  - 线上域名 `https://susuwatari.pages.dev/` 已恢复可访问
- 下一步：
  - 后续只需继续向 GitHub `main` 推送，Cloudflare Pages 应自动构建并发布

### [2026-05-18] 当前工作状态更新（部署链路）
- 当前正在调查的问题：
  - 当前无阻塞中的部署问题
- 当前唯一状态：
  - GitHub 自动部署链路已接通，后续维护以 `main` 分支推送为唯一发布入口
- 下一步计划：
  - 后续如再有 UI / 交互改动，继续沿用 `GitHub main -> Cloudflare Pages` 自动部署链路验证
- 当前禁止修改的区域：
  - 不要在无必要情况下删除当前已生效的 Cloudflare Pages `susuwatari` 项目
  - 不要把部署方式改回 Direct Upload，除非明确需要临时热修复
