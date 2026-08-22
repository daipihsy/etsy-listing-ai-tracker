# Etsy Listing AI Tracker

个人使用的 Etsy Listing 运营记录与复盘工具（macOS）。
不是 ERP，不是订单/库存系统。核心：**截图 → ⌘V → AI 读取 → 保存数据 → 记录动作 → 长期复盘**。

## 技术栈

Electron + React + TypeScript + Tailwind CSS + SQLite（better-sqlite3）。数据全部保存在本地。

## 开发

```bash
npm install      # 安装依赖并针对 Electron 重建 better-sqlite3
npm run dev      # 本地开发运行
```

## 打包成 .dmg（Apple Silicon）

```bash
npm run dist
```

产物在 `release/` 目录下的 `Etsy Listing AI Tracker-1.0.0-arm64.dmg`。

> 应用未做代码签名（个人使用）。首次打开如提示「无法验证开发者」，
> 在 Finder 中 **右键点击 App → 打开**，或到「系统设置 → 隐私与安全性」点「仍要打开」。

## 打包 Windows 版（.exe）

由于 `better-sqlite3` 是原生模块，**无法在 macOS 上跨平台打出 Windows 包**，需在 Windows 环境编译。两种方式：

**方式一：GitHub Actions（推荐，无需自备 Windows 机器）**

1. 把本项目推到一个 GitHub 仓库。
2. 打开仓库 **Actions** 标签 → 选 “Build desktop apps” → **Run workflow**（或推一个 `v1.0.0` tag）。
3. 跑完后在该次运行页面下载 `win-installer` 产物，得到 `Etsy Listing AI Tracker-1.0.0-win-x64-setup.exe`。
   （同一次运行也会产出 macOS 的 dmg。）

**方式二：在一台 Windows 电脑上本地打包**

```bash
git clone <仓库地址>
cd etsy-listing-ai-tracker
npm install
npm run dist:win
```

产物在 `release/` 下的 `...-win-x64-setup.exe`。

## 首次使用

1. 打开 **Settings**，填写 API Base URL / API Key / Model / Vision Model（任意 OpenAI 兼容接口），点「测试连接」。
2. **Listings → 新建 Listing**，粘贴主图（⌘V）、填写名字。
3. 进入 Listing → **Add Snapshot**，粘贴 Etsy 广告 / 自然流量截图，点「AI 识别」，核对后保存。
4. 保存后按提示记录当天运营动作，AI 会整理成结构化记录。
5. 随时间积累后，查看趋势图、Timeline、Before/After 效果对比，并用「生成复盘」得到 AI Summary。

## 数据位置与备份

数据库、原始截图、设置保存在 macOS 用户数据目录（Settings 页面底部会显示具体路径）。
在 **Settings → 数据备份** 可导出 / 导入完整备份（含原始截图）。
