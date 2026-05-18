# Assemble! Susuwatari

## English

### Overview

In `Assemble! Susuwatari`, you can gather the soot sprites from *Spirited Away* into any letter, number, or shape you want.
This is an interactive web project where, after the user selects a letter, a number, or draws a single-stroke path, a group of soot sprites wanders across the stage and gradually reassembles into the target form.

The whole experience is built on a full-page `Rive` interface. Users can select a single character, switch into one-stroke drawing mode, adjust motion parameters, and watch the sprite group gradually reorganize itself into the requested shape.

### Features

- Full-page Rive UI overlay
- `Rive`-driven interactive animation
- Single-character input for `A-Z` and `0-9`
- Single-stroke drawing mode
- The central spirit stage handles soot-sprite spawning and movement
- Adjustable density, speed, and size controls
- Call the spirits home / reveal the spirits' "souls"
- Transparent-background `WebM` export
- `GIF` export

### Tech Stack

- `Vite`
- `React`
- `TypeScript`
- `Rive`
- `opentype.js`
- `gifenc`

### Core Files

- `src/app/App.tsx`: top-level page state
- `src/components/SpiritFormationStage.tsx`: spirit spawning, movement, drawing, and export
- `src/components/LittleSpiritUiOverlay.tsx`: bridge between the page and the Rive UI
- `src/typography/glyphField.ts`: sampling and region logic for glyphs and strokes
- `src/typography/glyphLayout.ts`: geometry and layout for glyph rendering

### Local Development

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Default local URL:

```text
http://localhost:5173
```

### Build

Create a production build with:

```bash
npm run build
```

### Deployment

The project is connected to Cloudflare Pages and deploys automatically from the GitHub `main` branch.

Production site:

```text
https://susuwatari.pages.dev/
https://susu.mazzzz.art/
```

### Export Specs

- WebM: `512x512 / 5s / 30fps / transparent background`
- GIF: `256x256 / 3s / white background`

---

# 集合！灰尘精灵

## 中文

### 项目概览

在 `集合！灰尘精灵` 里，你可以让《千与千寻》中的灰尘精灵们集结成你想要的字母/数字/图形。
这是一个交互式网页项目，用户选择一个字母、数字，或手绘一笔路径后，一群灰尘精灵会在舞台中游走并重新集合成目标图形。

整个体验建立在整页 `Rive` 界面之上。用户可以选择单个字符、切换到单笔绘制模式、调整运动参数，并观察精灵群如何逐步重组为指定形状。

### 功能

- 使用整页 `Rive` UI 覆盖层
- 基于 `Rive` 的交互动画
- 支持 `A-Z` 与 `0-9` 的单字符输入
- 支持单笔绘制模式
- 中央小精灵舞台负责灰尘精灵的生成与运动
- 支持密度、速度、尺寸调节
- 将精灵呼唤回家 / 让精灵显示“灵魂”
- 支持导出透明背景 `WebM`
- 支持导出 `GIF`

### 技术栈

- `Vite`
- `React`
- `TypeScript`
- `Rive`
- `opentype.js`
- `gifenc`

### 核心文件

- `src/app/App.tsx`：页面顶层状态管理
- `src/components/SpiritFormationStage.tsx`：小精灵生成、运动、绘制与导出
- `src/components/LittleSpiritUiOverlay.tsx`：页面逻辑与 Rive UI 的桥接层
- `src/typography/glyphField.ts`：字形与笔划区域采样逻辑
- `src/typography/glyphLayout.ts`：字形布局与几何计算

### 本地开发

安装依赖并启动开发服务器：

```bash
npm install
npm run dev
```

默认本地地址：

```text
http://localhost:5173
```

### 构建

使用以下命令构建生产包：

```bash
npm run build
```

### 部署

项目当前已接入 Cloudflare Pages，并由 GitHub `main` 分支自动部署。

线上地址：

```text
https://susuwatari.pages.dev/
https://susu.mazzzz.art/
```

### 导出规格

- WebM：`512x512 / 5秒 / 30fps / 透明背景`
- GIF：`256x256 / 3秒 / 白底`

---

# 集合！ススワタリ

## 日本語

### 概要

`集合！ススワタリ` では、『千と千尋の神隠し』に登場するススワタリたちを、好きな文字・数字・図形へ集結させることができます。
このプロジェクトはインタラクティブな Web 作品で、ユーザーが文字・数字を選ぶか、一筆書きのパスを描くと、ススワタリたちがステージ上を動き回り、最終的に目標の形へ組み上がっていきます。

体験全体はフルページの `Rive` UI を基盤として構成されています。ユーザーは単一文字を選び、一筆描きモードに切り替え、動きのパラメータを調整しながら、ススワタリの群れが指定した形へ少しずつ再編成される様子を見ることができます。

### 機能

- フルページ `Rive` UI オーバーレイ
- `Rive` ベースのインタラクティブアニメーション
- `A-Z` と `0-9` の単文字入力
- 一筆書きモード
- 中央ステージでススワタリの生成と移動を制御
- 密度・速度・サイズの調整
- ススワタリを呼び戻す / ススワタリの「たましい」を見せる
- 透過背景 `WebM` 書き出し
- `GIF` 書き出し

### 技術スタック

- `Vite`
- `React`
- `TypeScript`
- `Rive`
- `opentype.js`
- `gifenc`

### 主要ファイル

- `src/app/App.tsx`：ページ全体の状態管理
- `src/components/SpiritFormationStage.tsx`：ススワタリの生成、移動、描画、書き出し
- `src/components/LittleSpiritUiOverlay.tsx`：ページと Rive UI の橋渡し
- `src/typography/glyphField.ts`：文字形状とストローク領域のサンプリング
- `src/typography/glyphLayout.ts`：文字レイアウトと幾何計算

### ローカル開発

依存関係をインストールして開発サーバーを起動：

```bash
npm install
npm run dev
```

デフォルトのローカル URL：

```text
http://localhost:5173
```

### ビルド

本番ビルドは次のコマンドで作成します：

```bash
npm run build
```

### デプロイ

このプロジェクトは Cloudflare Pages に接続されており、GitHub の `main` ブランチから自動デプロイされます。

公開 URL：

```text
https://susuwatari.pages.dev/
https://susu.mazzzz.art/
```

### 書き出し仕様

- WebM：`512x512 / 5秒 / 30fps / 透過背景`
- GIF：`256x256 / 3秒 / 白背景`
