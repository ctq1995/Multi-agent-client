# Multi-agent-client

[![License](https://img.shields.io/github/license/xintaofei/codeg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-blue)](./package.json)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-24C8DB)](https://tauri.app/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)

**Multi-agent-client** 是一个桌面应用，用于聚合和管理本地 AI 编码代理的会话记录。支持实时连接多种 AI 代理进程，统一管理会话、文件、Git 工作流，并内置 Web 服务模式供远程访问。

---

## 功能特性

### 多代理会话聚合

- 支持读取和展示 **Claude Code**、**Codex CLI**、**OpenCode**、**Gemini CLI**、**OpenClaw** 的本地会话历史
- 统一格式渲染，支持代码块高亮、工具调用、推理内容等富文本元素

### ACP 实时连接

- 通过 ACP（Agent Control Protocol）实时连接本地代理进程
- 支持发送消息、取消操作、权限请求响应、模式切换、配置下发
- 支持 Agent Fork（并行子任务分支）
- 兼容多种权限请求格式

### Git 工作流集成

- 文件树浏览、文件内容查看与编辑（Monaco Editor）
- Git 状态、diff 查看、提交、推送、拉取、分支管理
- Stash 管理（push/pop/apply/drop/show）
- 合并冲突可视化解决（三栏 Merge 编辑器）
- Remote 管理、GitHub 账号凭据管理（基于系统 Keyring）
- GitHub 仓库克隆（含实时进度显示）

### 模型管理

- 支持配置自定义 API 接口，从远端拉取模型列表
- 自动识别 **Anthropic** / **Gemini** / **OpenAI 兼容**接口，使用对应鉴权方式和路径
- 模型拉取通过 Rust 后端执行，绕过浏览器 CORS 限制
- 支持 OpenAI 兼容第三方接口（如 `https://free.9977.me/v1`）

### Web 服务模式

- 内置 HTTP 服务器，可从任意浏览器远程访问应用
- 完整 Web API + WebSocket 事件桥接
- 支持身份验证配置

### MCP 管理

- 本地 MCP 服务扫描
- 注册表市场搜索与一键安装

### Skills 管理

- 全局和项目级别的 Skills 配置与管理

### 多语言支持

- 支持中文（简体/繁体）、英语、日语、韩语、法语、德语、西班牙语、葡萄牙语、阿拉伯语

### 其他

- 图片文件预览
- 系统通知推送
- 系统代理配置（适用于企业网络）
- 虚拟化消息列表，提升长会话滚动性能

---

## 下载安装

前往 [Releases](../../releases) 页面下载最新版本：

- `Multi-agent-client_1.0.0_x64_en-US.msi` — Windows 安装包（MSI）
- `Multi-agent-client_1.0.0_x64-setup.exe` — Windows 安装包（NSIS）

---

## 本地开发

### 环境要求

- Node.js 20+，pnpm 9+
- Rust 1.77+（含 `cargo`）
- Tauri CLI v2

### 开发命令

```bash
# 启动完整应用（Tauri + Next.js Turbopack 开发服务器）
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
        | invoke() / Web Transport
        v
Tauri 2 Commands (Rust)
  |- ACP Manager          ← 代理进程实时连接
  |- Parsers              ← 本地会话文件解析（Claude/Codex/OpenCode/Gemini/OpenClaw）
  |- Git / File / Terminal
  |- MCP marketplace
  |- Model Catalog        ← 远程模型列表拉取（Rust 后端，绕过 CORS）
  |- Web Server           ← 内置 HTTP + WebSocket 服务
  |- Git Credential       ← 系统 Keyring 凭据管理
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
- Git 凭据通过系统 Keyring 安全存储

---

## License

Apache-2.0，详见 `LICENSE`。

---

## 鸣谢

本项目基于 **[xintaofei/codeg](https://github.com/xintaofei/codeg)** 开发，感谢原项目作者 [@xintaofei](https://github.com/xintaofei) 构建了这套完整的多代理桌面工作台框架，提供了会话聚合、ACP 协议、MCP 管理、Git 工作流等核心能力。原项目以 Apache-2.0 协议开源，持续快速迭代，强烈推荐关注原仓库以获取最新功能。
