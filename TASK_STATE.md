# TASK STATE

Last updated: 2026-05-18  
Current goal: 已完成导出功能任务，当前无进行中的 `exportVideoRequest / exportGifRequest` 问题  
Goal boundary:
- 导出当前单个字母 / 数字，或用户笔划生成的小精灵动画
- 导出透明背景 WebM
- 导出白底 GIF
- 不扩展到其它 Brush / UI / 分布 / 多字母问题

## 1. 已确认结论

### 导出目标与最终规格
- `exportVideoRequest` 已实现并可正常下载。
- `exportGifRequest` 已实现并可正常下载。
- WebM 最终规格为：`512x512 / 5s / 30fps / 透明背景`。
- GIF 最终规格为：`256x256 / 3s / 白底`。
- 导出内容为当前单个字母 / 数字，或当前用户笔划生成的小精灵动画。

### 当前导出实现路径
- Rive UI 中的 `btn_video` / `btn_gif` 通过 listener 触发 `exportVideoRequest` / `exportGifRequest`。
- `LittleSpiritUiOverlay` 负责监听这两个 trigger，并把请求转发给页面代码。
- `App.tsx` 只负责持有导出 handler ref，并统一处理错误提示。
- `SpiritFormationStage` 持有真正的导出实现，因为只有它拥有当前舞台尺寸、精灵实例和实时动画状态。
- WebM 与 GIF 共用同一条“从当前 stage 采样帧”的导出思路，但最终编码方式不同。

### WebM 导出结论
- WebM 不是直接录整页 DOM，而是由 `SpiritFormationStage` 将当前小精灵舞台逐帧绘制到离屏 canvas。
- 离屏 canvas 保持透明背景，再通过 `captureStream()` + `MediaRecorder` 录制下载。
- 该方案已经过用户实测，功能正常。

### GIF 导出结论
- GIF 同样基于 `SpiritFormationStage` 的帧采样，但采样时会先绘制白底。
- GIF 采用固定帧采样窗口，不依赖浏览器原生 GIF 能力。
- 当前 GIF 编码器已改为 `gifenc`，避免手写压缩流带来的画面遮挡问题。
- 该方案已经过用户实测，功能正常。

### 触发链路结论
- `LittleSpiritUiOverlay` 中 trigger 监听不能只依赖 `didHydrateRef.current`。
- 单纯修改 ref 不会触发重新渲染，可能导致 `deleteRequest` / `exportVideoRequest` / `exportGifRequest` 根本没有真正注册监听。
- 当前已改为显式 `isHydrated` state 驱动 trigger 注册，这一链路已被用户实测确认正常。

## 2. 已检查过的文件

以下文件已直接参与本轮导出实现或被确认过，不应无故重读：

- `/Users/mazzaloth/Desktop/MAZZ/VibeCoding/Catafont/src/app/App.tsx`
- `/Users/mazzaloth/Desktop/MAZZ/VibeCoding/Catafont/src/app/useVideoExport.ts`
- `/Users/mazzaloth/Desktop/MAZZ/VibeCoding/Catafont/src/components/LittleSpiritUiOverlay.tsx`
- `/Users/mazzaloth/Desktop/MAZZ/VibeCoding/Catafont/src/components/SpiritFormationStage.tsx`
- `/Users/mazzaloth/Desktop/MAZZ/VibeCoding/Catafont/src/styles/global.css`
- `/Users/mazzaloth/Desktop/MAZZ/VibeCoding/Catafont/package.json`
- `/Users/mazzaloth/Desktop/MAZZ/VibeCoding/Catafont/src/types/gifenc.d.ts`

## 3. 已失败方案

### WebM 初始空实现
- `LittleSpiritUiOverlay` 中 `exportVideoRequest` / `exportGifRequest` 初始只有 trigger，没有实际导出逻辑。
- 问题不是参数错误，而是功能未落地。

### Trigger 监听注册错误路线
- 最初把 `deleteRequest` / `exportVideoRequest` / `exportGifRequest` 的监听注册放在 `didHydrateRef.current` 条件后。
- 由于 ref 变化不驱动重渲染，导致监听有概率从未真正挂上。
- 该路线已结束，不应恢复。

### GIF 手写编码路线
- 初版 GIF 使用手写全局调色板 + 手写 LZW 压缩编码。
- 下载功能可用，但导出 GIF 出现白色区域遮挡画面的问题。
- 已确认问题在编码结果，而不是 trigger、下载动作或白底采样本身。
- 该路线已放弃，不应恢复。

## 4. 本轮最终实现

- `LittleSpiritUiOverlay` 新增 `onExportVideo` / `onExportGif` 接口，并在 hydrate 完成后注册 trigger 监听。
- `App.tsx` 新增 `exportVideoHandlerRef` / `exportGifHandlerRef`，负责接收 stage 提供的导出函数。
- `SpiritFormationStage` 内部新增离屏导出能力：
  - 透明 canvas 导出 WebM
  - 白底 canvas 采样 GIF
- `useVideoExport.ts` 被扩展为可配置时长 / 帧率 / 文件名的通用 WebM 导出 hook。
- GIF 最终使用 `gifenc` 编码，并补充了 `/src/types/gifenc.d.ts` 类型声明。
- 文件名规格已同步更新：
  - WebM 文件名包含 `512`
  - GIF 文件名包含 `256`

## 5. 当前状态

- 用户已确认：WebM 导出功能正常。
- 用户已确认：GIF 导出功能正常。
- 用户已确认：GIF 遮挡问题已消失。
- 当前导出规格已锁定为最终版本：
  - WebM：`512x512 / 5s / 透明背景`
  - GIF：`256x256 / 3s / 白底`

## 6. 后续排查原则

- 不重新搜索整个项目
- 不重复验证已确认可工作的 trigger 链
- 一次只排查一个导出问题
- 修改前先区分是 trigger 问题、采样问题，还是编码问题
- 若再次出现 GIF 画面异常，优先检查采样结果与 `gifenc` 输入，不要先怀疑按钮或下载逻辑

## 7. 当前问题直接相关文件（允许查看）

- `/Users/mazzaloth/Desktop/MAZZ/VibeCoding/Catafont/src/components/LittleSpiritUiOverlay.tsx`
- `/Users/mazzaloth/Desktop/MAZZ/VibeCoding/Catafont/src/components/SpiritFormationStage.tsx`
- `/Users/mazzaloth/Desktop/MAZZ/VibeCoding/Catafont/src/app/App.tsx`
- `/Users/mazzaloth/Desktop/MAZZ/VibeCoding/Catafont/src/app/useVideoExport.ts`
- `/Users/mazzaloth/Desktop/MAZZ/VibeCoding/Catafont/src/types/gifenc.d.ts`
