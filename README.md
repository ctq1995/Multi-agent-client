# Multi-agent-client

[![License](https://img.shields.io/github/license/xintaofei/codeg)](./LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB)](https://tauri.app/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![基于](https://img.shields.io/badge/基于-codeg%20v0.4.1-orange)](https://github.com/xintaofei/codeg)

> 本项目 fork 自 [xintaofei/codeg](https://github.com/xintaofei/codeg)，当前基于上游 `v0.1.4` 分支进行定制开发，上游最新版本为 `v0.4.1`。

**Multi-agent-client** 是一个桌面应用，用于聚合和浏览本地 AI 编码代理的会话记录。它从多个代理（Claude Code、Codex CLI、OpenCode、Gemini CLI 等）的本地文件系统中读取会话数据，统一格式后在 UI 中展示，并支持多种远程模型接口配置。

---

## 功能现状与上游对比

本分支基于上游 `v0.1.4` 标签 fork，并在此基础上进行了独立的功能增强。上游目前已迭代至 `v0.4.1`，以下是详细的功能对比说明。

### 本分支已有 / 独有的功能

| 功能 | 说明 |
|------|------|
| **多 AI 代理会话聚合** | 支持 Claude Code、Codex CLI、OpenCode 会话读取与展示 |
| **多语言 UI** | 支持中文（简/繁）、英、日、韩、法、德、西、葡、阿拉伯语 |
| **ACP（Agent Control Protocol）** | 实时连接本地代理进程，发送消息、查看响应 |
| **MCP 管理** | 本地扫描 + 注册表搜索/安装 MCP 服务 |
| **Skills 管理** | 全局和项目级别的 Skills 配置 |
| **Git 工作流集成** | 文件树、diff 查看、git 变更、提交、终端 |
| **GitHub 克隆进度条** | 克隆远程仓库时显示实时进度 |
| **窗口置顶修复** | 修复设置窗口打开时遮挡其他应用的问题 |
| **更多权限请求格式支持** | 兼容更多代理发出的权限请求格式 |
| **远程模型选择器** | 支持配置自定义 API 接口并从远端拉取模型列表 |
| **多接口自动适配** | 自动识别 Anthropic / Gemini / OpenAI 兼容接口，使用对应鉴权方式和路径格式 |
| **模型列表精简显示** | 只显示模型名称 + 上下文长度能力标签，界面简洁清晰 |
| **欢迎页版本号动态读取** | 版本号从 Tauri 运行时动态获取，随 `tauri.conf.json` 自动变化 |
| **通知系统** | 支持系统通知推送 |

### 上游已有、本分支尚未合并的功能

| 功能模块 | 上游版本引入 | 说明 |
|----------|-------------|------|
| **Web 服务模式** | v0.3.0+ | 内置 HTTP 服务器，可从任意浏览器远程访问 Codeg，实现远程开发。包含完整的 Web API、WebSocket 事件桥接、身份验证 |
| **OpenClaw 代理支持** | v0.2.x+ | 新增 OpenClaw 代理的会话解析器 |
| **Gemini CLI 解析器** | v0.2.x+ | 新增 Gemini CLI 会话历史读取 |
| **版本控制增强** | v0.2.x+ | Push、Pull、Stash、Merge 冲突解决 UI，三栏 Merge 编辑器 |
| **Git 账号管理** | v0.2.x+ | GitHub 及其他 Git 服务器的账号凭据管理（基于系统 Keyring） |
| **图片预览** | v0.2.x+ | 在软件内预览会话中引用的图片文件 |
| **虚拟化消息列表** | v0.2.x+ | 使用 Virtua 替换 @tanstack/react-virtual，提升长会话滚动性能 |
| **Monaco 代码编辑器集成** | v0.2.x+ | 内置 Monaco Editor，支持本地文件编辑 |
| **Agent Fork 支持** | v0.2.x+ | ACP 代理进程 fork 管理 |
| **Transport 抽象层** | v0.3.0+ | 统一 Tauri IPC 和 Web HTTP 两种传输方式，同一套前端代码适配桌面和 Web |
| **登录页面** | v0.3.0+ | Web 模式下的身份验证登录页 |
| **会话块级虚拟化渲染** | v0.2.x+ | 重构消息渲染，支持块级虚拟化，减少卡顿 |
| **并行命令执行结果修复** | v0.2.x+ | 修复并行命令的执行结果与命令块的对应关系 |
| **Mermaid 版本统一** | v0.2.x+ | 统一 Mermaid 图表渲染版本 |

### 功能异同摘要

```
上游 v0.4.1 核心新增:
  ✦ Web 服务模式（最大差异，约 25+ 新文件）
  ✦ 更多代理适配（Gemini CLI、OpenClaw）
  ✦ 完整 Git 高级操作（Push/Merge/Stash/凭据管理）
  ✦ 性能优化（块级虚拟化、Virtua 替换）
  ✦ Monaco 代码编辑器

本分支独有:
  ✦ 多接口 API 自动适配（Anthropic/Gemini/OpenAI）
  ✦ 模型列表精简 UI
  ✦ 窗口置顶问题修复
  ✦ GitHub 克隆进度条
  ✦ 通知系统
```

---

## 技术栈

- **桌面运行时**：Tauri 2（Rust 后端 + WebView 前端）
- **前端**：Next.js 16（静态导出）+ React 19 + TypeScript（strict 模式）
- **样式**：Tailwind CSS v4 + shadcn/ui
- **包管理器**：pnpm
- **数据库**：SeaORM + SQLite（会话索引）

---

## 支持的代理

### 会话历史读取

| 代理 | 环境变量路径 | macOS/Linux 默认路径 | Windows 默认路径 |
|------|-------------|---------------------|------------------|
| Claude Code | `$CLAUDE_CONFIG_DIR/projects` | `~/.claude/projects` | `%USERPROFILE%\.claude\projects` |
| Codex CLI | `$CODEX_HOME` | `~/.codex/sessions` | `%USERPROFILE%\.codex\sessions` |
| OpenCode | — | `~/.local/share/opencode` | `%APPDATA%\opencode` |

### ACP 实时连接

支持通过 ACP 协议实时连接以下代理进程：
- Claude Code、Codex CLI、OpenCode 等

---

## 快速开始

### 环境要求

- Node.js `>=22`
- pnpm `>=10`
- Rust stable（2021 edition）
- Tauri 2 构建依赖

Linux（Debian/Ubuntu）额外依赖：

```bash
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf
```

### 开发

```bash
pnpm install

# 启动完整应用（Tauri + Next.js Turbopack）
pnpm tauri dev

# 仅启动前端
pnpm dev

# 构建前端（静态导出到 out/）
pnpm build

# 构建桌面应用
pnpm tauri build

# Lint 检查
pnpm eslint .

# Rust 检查（在 src-tauri/ 目录下执行）
cargo check
cargo clippy
```

---

## 架构

```text
Next.js 16 (Static Export) + React 19
        |
        | invoke()
        v
Tauri 2 Commands (Rust)
  |- ACP Manager          ← 代理进程实时连接
  |- Parsers              ← 本地会话文件解析
  |- Git / File / Terminal
  |- MCP marketplace
  |- Model Catalog        ← 远程模型列表拉取（本分支增强）
  |- SeaORM + SQLite
        |
        v
本地文件系统 / 代理会话数据 / Git 仓库
```

---

## 隐私与安全

- 默认本地优先：所有解析、存储和项目操作均在本地执行
- 网络请求仅在用户主动触发时发生（如拉取远程模型列表）
- 支持系统代理，适用于企业网络环境

---

## License

Apache-2.0，详见 `LICENSE`。

---

## 鸣谢

本项目基于 **[xintaofei/codeg](https://github.com/xintaofei/codeg)** 开发，感谢原项目作者 [@xintaofei](https://github.com/xintaofei) 构建了这套完整的多代理桌面工作台框架，提供了会话聚合、ACP 协议、MCP 管理、Git 工作流等核心能力。原项目以 Apache-2.0 协议开源，持续快速迭代，强烈推荐关注原仓库以获取最新功能。
