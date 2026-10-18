#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
usage() { cat <<'HELP'
StonkLaunch 本地安装（不部署、不迁移数据库、不创建账号或链上配置）
用法: bash scripts/install.sh [--check-only] [--help]
--check-only  仅检查 Node、pnpm、锁文件和配置，不安装依赖，不创建文件
版本基线: Node 24.19.0 / pnpm 11.25.0
已有 .env / .env.local 原样保留。缺少配置时只在普通安装复制 .env.example 为 .env.local。
HELP
}
CHECK_ONLY=false
while (($#)); do case "$1" in --help|-h) usage; exit 0;; --check-only) CHECK_ONLY=true;; *) printf '未知选项: %s\n' "$1" >&2; exit 2;; esac; shift; done
cd "$ROOT"
command -v node >/dev/null || { echo '请先从 Node 官方来源安装 Node 24.19.0。' >&2; exit 1; }
command -v pnpm >/dev/null || { echo '请先准备 pnpm 11.25.0，再重新运行。脚本不会自动全局安装工具。' >&2; exit 1; }
[[ "$(node --version)" == 'v24.19.0' ]] || { echo 'Node 版本不匹配；需要 v24.19.0。' >&2; exit 1; }
[[ "$(pnpm --version)" == '11.25.0' ]] || { echo 'pnpm 版本不匹配；需要 11.25.0。' >&2; exit 1; }
[[ -f package.json && -f pnpm-lock.yaml ]] || { echo '缺少 package.json 或 pnpm-lock.yaml；请使用完整源码。' >&2; exit 1; }
if [[ ! -f .env && ! -f .env.local ]]; then
 if "$CHECK_ONLY"; then echo '配置文件缺失：普通安装会创建默认 demo .env.local。';
 else (umask 077; cp .env.example .env.local); echo '已创建 .env.local，默认 demo；未填入任何凭据。'; fi
else echo '已有环境文件保持原样；不会输出内容。'; fi
# Do not source environment files: values are data, not shell commands.
if ! "$CHECK_ONLY"; then pnpm install --frozen-lockfile; fi
cat <<'NEXT'
检查结束。尚未执行生产构建、数据库 migration、后台部署或链上交易。
下一步：pnpm typecheck && pnpm test && pnpm build
预览：pnpm dev（默认 http://localhost:3000）
生产应用：pnpm start；索引：pnpm indexer（独立进程）
数据库：由已获授权的操作员在目标 Supabase 项目审阅并运行 supabase/migrations/0001_initial.sql。
Supabase Auth Solana Web3 provider、允许域名和公开资源 bucket 需外部配置。
Docker / worker 环境和缺失配置处理详见 deploy/README_ZH.md。
NEXT
