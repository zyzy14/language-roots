#!/usr/bin/env bash
# 语言寻根 · 一键部署到 GitHub Pages
# 前置：已在本地 `gh auth login`（或用 `gh auth login --with-token` 提供 PAT）
set -e

cd "$(dirname "$0")"

# 若仓库尚无 main 分支，则基于当前分支创建并切换
CURRENT=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT" != "main" ]; then
  git checkout -B main
fi

# 首次推送需设置上游
if ! git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
  UPSTREAM="--set-upstream origin main"
else
  UPSTREAM=""
fi

git add -A
git commit -m "deploy: $(date +%F_%T)" || echo "无新改动，直接推送"
git push $UPSTREAM

echo "✅ 已推送到 main 分支，GitHub Actions 会自动构建并部署到 GitHub Pages。"
echo "   首次部署后请在仓库 Settings → Pages 中确认 Source = GitHub Actions。"
