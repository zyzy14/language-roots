#!/usr/bin/env bash
# GitHub Pages 部署（沙箱内可执行，因 api.github.com 可达）
# 用法: GH_TOKEN=xxx bash deploy-github.sh
# 作用: 登录 gh -> 建公开仓库并推送 -> 开启 GitHub Pages -> 输出站点网址
set -uo pipefail

TOKEN="${GH_TOKEN:?请先设置环境变量 GH_TOKEN}"
REPO="${REPO_NAME:-language-roots}"
cd /workspace

git config user.email "deploy@local" 2>/dev/null
git config user.name  "deploy-bot" 2>/dev/null

echo "==> 登录 gh ..."
printf '%s' "$TOKEN" | gh auth login --with-token

OWNER=$(gh api user --jq .login)
echo "    owner: $OWNER"

echo "==> 创建仓库并推送 ..."
gh repo create "$REPO" --public --source=. --push \
  --description "语言寻根 - 全球语言谱系赛博全息馆（纯静态站点）" 2>&1 | tail -3 || true

echo "==> 开启 GitHub Pages (branch=master, path=/) ..."
gh api -X POST "/repos/$OWNER/$REPO/pages" \
  -f "source[branch]=master" -f "source[path]=/" 2>&1 | tail -3 || true

echo "==> 等待 Pages 构建(约 30s) ..."
sleep 30
URL=$(gh api "/repos/$OWNER/$REPO/pages" --jq .html_url 2>/dev/null)

echo ""
echo "✅ 完成！"
echo "🌐 站点: ${URL:-https://$OWNER.github.io/$REPO/}"
echo "📦 仓库: https://github.com/$OWNER/$REPO  （可在页面上 Code -> Download ZIP 取到全部文件）"
