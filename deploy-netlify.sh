#!/usr/bin/env bash
# Netlify 手动部署脚本（无需 netlify-cli，直接调 API）
# 用法: NETLIFY_TOKEN=xxxx bash deploy-netlify.sh
set -uo pipefail

TOKEN="${NETLIFY_TOKEN:?请先设置环境变量 NETLIFY_TOKEN}"
SRC="/workspace/language-roots-deploy.zip"
WORK="/tmp/netlify-deploy"

rm -rf "$WORK"
mkdir -p "$WORK"
cd "$WORK"
unzip -o "$SRC" >/dev/null

API="https://api.netlify.com/api/v1"
AUTH="Authorization: Bearer $TOKEN"

echo "==> 创建站点 ..."
TS=$(date +%s)
SITE_JSON=$(curl -s -H "$AUTH" -H "Content-Type: application/json" \
  -X POST "$API/sites" -d "{\"name\":\"language-roots-$TS\"}")
SITE_ID=$(echo "$SITE_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
SITE_URL=$(echo "$SITE_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin).get('url',''))")
echo "    站点ID : $SITE_ID"
echo "    网址   : $SITE_URL"

echo "==> 创建部署 ..."
DEPLOY_JSON=$(curl -s -H "$AUTH" -X POST "$API/sites/$SITE_ID/deploys")
DEPLOY_ID=$(echo "$DEPLOY_JSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "    部署ID : $DEPLOY_ID"

echo "==> 上传文件 ..."
find . -type f | while read -r f; do
  p="${f#./}"
  curl -s -H "$AUTH" -X PUT --data-binary "@$f" "$API/deploys/$DEPLOY_ID/files/$p" >/dev/null
  echo "    + $p"
done

echo "==> 等待部署就绪 ..."
for i in $(seq 1 30); do
  STATE=$(curl -s -H "$AUTH" "$API/deploys/$DEPLOY_ID" | python3 -c "import sys,json;print(json.load(sys.stdin).get('state',''))")
  if [ "$STATE" = "ready" ] || [ "$STATE" = "published" ]; then break; fi
  sleep 2
done

echo "==> 设为生产部署 ..."
curl -s -H "$AUTH" -H "Content-Type: application/json" \
  -X PATCH "$API/sites/$SITE_ID" -d "{\"production_deploy\":\"$DEPLOY_ID\"}" >/dev/null

echo ""
echo "✅ 部署完成！"
echo "🌐 站点地址: ${SITE_URL:-请在 Netlify 后台查看站点域名}"
