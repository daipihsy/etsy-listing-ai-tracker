# Etsy Listing AI Tracker

个人使用的 Etsy Listing 运营记录与复盘工具（macOS / Windows）。
不是 ERP，不是订单/库存系统。核心：**截图 → ⌘V → AI 读取 → 保存数据 → 记录动作 → 长期复盘**。

> 下载安装包请到 **[Releases](../../releases/latest)**。

## ⚠️ 安装后打不开？（未签名 App 的正常现象，看这里）

本应用未购买苹果/微软的代码签名证书（个人自用），系统会拦一下，**放行一次即可**，App 本身安全（源码就在本仓库、由 GitHub Actions 构建）。

### macOS：提示"已损坏"或"无法验证开发者"

**最省事——终端一条命令直接解决（推荐）**

先把 App 拖进「应用程序」，然后在「终端」运行（把路径换成实际位置）：

```bash
xattr -dr com.apple.quarantine "/Applications/Etsy Listing AI Tracker.app"
```

回车后双击即可打开，之后不再有任何提示。这条命令只是移除"从网上下载"的隔离标记，安全。

**或者用图形界面放行**

1. 双击弹出的拦截框点「完成」（不要点"移到废纸篓"）
2. 打开 **系统设置 → 隐私与安全性**，拉到底部「安全性」
3. 找到 *"已阻止使用 Etsy Listing AI Tracker…"* → 点 **「仍要打开」** → 用密码/指纹确认

### Windows：SmartScreen 提示"已保护你的电脑"

点 **「更多信息」→「仍要运行」** 即可。

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

## 整店分析（多店铺）

和单链接分析分开，用于站在**全店/全局**角度记录与复盘，支持多家店。

- **录入方式（推荐"粘贴整页文本"，最快、不超时）**：
  - 在 Etsy「Stats / Shop stats」页 ⌘A 全选复制 → 粘贴 → 解析：自动填整店流量、Shopper Stats、流量来源、自然 Top Listings。
  - 在 Etsy「Ads」页 ⌘A 全选复制 → 粘贴 → 解析：自动填整店广告汇总，并抓出每个单链接的明细（含当前投放策略）。
  - 也支持粘贴截图让 AI 识别、或导入广告每日 CSV（生成每日趋势）。
- **兼容多店差异**：US$ / £ / $ / USD 各种货币、英式拼写（favourites / baskets）、日在前/月在前日期。
- **只存文本记录**：整店截图仅用于识别、不落盘，长期看文本更有效。
- **AI 优化建议 + 对话框**：结合整店流量结构、广告各链接表现与当前策略、自然流量强项，给全局的策略调整建议（切换投放策略 / 预算再分配 / 止损 / 改图改标题），也能就某条链接直接对话追问。

## 数据位置

数据库、原始截图、设置保存在系统用户数据目录（Settings 页面底部会显示具体路径）。

## 跨设备同步（手动，文件方式）

在 **Settings → 数据同步 / 备份**：

1. **在设备 A 导出**：点「导出数据文件」，得到一个 `.json`（含全部数据 + 原始截图）。
2. 把文件拷到设备 B（U 盘 / 网盘 / 微信传文件均可）。
3. **在设备 B 导入**，两种模式：
   - **合并导入（推荐）**：按记录唯一 ID 智能合并，只新增/更新，**不会删除**设备 B 上独有的数据；同一条 Listing 冲突时以「更新时间较新」的为准。日常轮流用选它最安全。
   - **覆盖式导入**：清空本地、完全替换成文件内容。仅在想把某台设备整体还原成文件状态时用。

> 适合「一次用一台、轮流用」。要真正的实时多端同步（如放到极空间 NAS 同步盘自动同步），是另一套方案，可后续再做。
