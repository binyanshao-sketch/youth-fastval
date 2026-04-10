#!/bin/bash
# ============================================================
# 上线全量端到端测试脚本 v2
# ============================================================
set -uo pipefail

BASE="http://localhost:3000"
PASS=0
FAIL=0
TOTAL=0
SERVER_DIR="/Users/shao/Desktop/youth-fastval-main-fixed/server"

pass() { ((PASS++)); ((TOTAL++)); printf "  ✅ PASS: %s\n" "$1"; }
fail() { ((FAIL++)); ((TOTAL++)); printf "  ❌ FAIL: %s — %s\n" "$1" "${2:-}"; }
section() { printf "\n━━━ %s ━━━\n" "$1"; }

json_get() { python3 -c "import sys,json; d=json.load(sys.stdin); print(d$1)" 2>/dev/null; }

restart_server() {
  kill $(lsof -ti:3000) 2>/dev/null || true
  sleep 1
  cd "$SERVER_DIR"
  node src/app.js >> /tmp/youth-fastval-test.log 2>&1 &
  local max_wait=15
  for i in $(seq 1 $max_wait); do
    if curl -sf "$BASE/ready" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "ERROR: Server failed to start"
  return 1
}

# ============================================================
section "0. 初始化：清理测试数据 & 启动服务"
# ============================================================
mysql -u root yibin_youth_festival -e "
  DELETE FROM verify_records;
  DELETE FROM user_coupons;
  DELETE FROM lottery_records;
  DELETE FROM lucky_bag_records;
  DELETE FROM redpacket_jobs;
  DELETE FROM users;
  UPDATE redpacket_pool SET used_count=0;
  UPDATE coupons SET used_count=0;
" 2>/dev/null && pass "清理测试数据" || fail "清理测试数据"

restart_server && pass "服务启动" || { fail "服务启动"; exit 1; }

# ============================================================
section "1. 基础健康检查"
# ============================================================

R=$(curl -sf "$BASE/health")
echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['status']=='ok'" 2>/dev/null && pass "GET /health" || fail "GET /health"

R=$(curl -sf "$BASE/ready")
echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['status']=='ready'" 2>/dev/null && pass "GET /ready" || fail "GET /ready"

R=$(curl -sf "$BASE/api/status")
echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['success'] and d['data']['isActive']" 2>/dev/null && pass "GET /api/status" || fail "GET /api/status"

R=$(curl -s "$BASE/api/nonexistent")
echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['message']=='接口不存在'" 2>/dev/null && pass "404 处理" || fail "404 处理"

# ============================================================
section "2. 用户认证流程"
# ============================================================

R=$(curl -s -X POST "$BASE/api/user/h5/login" -H "Content-Type: application/json" -d '{"deviceId":"e2e_user_1"}')
TOKEN_U1=$(echo "$R" | json_get "['data']['token']")
[ -n "$TOKEN_U1" ] && [ "$TOKEN_U1" != "None" ] && pass "H5 登录" || fail "H5 登录"

HAS_OPENID=$(echo "$R" | python3 -c "import sys,json; print('openid' in json.load(sys.stdin).get('data',{}))")
[ "$HAS_OPENID" = "False" ] && pass "登录不返回 openid" || fail "openid 泄露"

R=$(curl -s "$BASE/api/user/info")
MSG=$(echo "$R" | json_get "['message']")
[[ "$MSG" == *"登录"* ]] && pass "无 token → 401" || fail "无 token" "$MSG"

R=$(curl -s "$BASE/api/user/info" -H "Authorization: Bearer fake.token.here")
MSG=$(echo "$R" | json_get "['message']")
[[ "$MSG" == *"过期"* ]] || [[ "$MSG" == *"登录"* ]] && pass "伪造 token → 401" || fail "伪造 token" "$MSG"

R=$(curl -s "$BASE/api/user/info" -H "Authorization: Bearer $TOKEN_U1")
OK=$(echo "$R" | json_get "['success']")
[ "$OK" = "True" ] && pass "GET /api/user/info" || fail "GET /api/user/info"

R=$(curl -s "$BASE/api/user/stats" -H "Authorization: Bearer $TOKEN_U1")
OK=$(echo "$R" | json_get "['success']")
[ "$OK" = "True" ] && pass "GET /api/user/stats" || fail "GET /api/user/stats"

R=$(curl -s -X POST "$BASE/api/user/h5/bindPhone" \
  -H "Authorization: Bearer $TOKEN_U1" \
  -H "Content-Type: application/json" \
  -d '{"phone":"13900000001"}')
OK=$(echo "$R" | json_get "['success']")
[ "$OK" = "True" ] && pass "H5 绑定手机号" || fail "H5 绑定手机号"

R2_LOGIN=$(curl -s -X POST "$BASE/api/user/h5/login" -H "Content-Type: application/json" -d '{"deviceId":"e2e_user_phone_dup"}')
TOKEN_DUP=$(echo "$R2_LOGIN" | json_get "['data']['token']")
R=$(curl -s -X POST "$BASE/api/user/h5/bindPhone" \
  -H "Authorization: Bearer $TOKEN_DUP" \
  -H "Content-Type: application/json" \
  -d '{"phone":"13900000001"}')
OK=$(echo "$R" | json_get "['success']")
[ "$OK" = "False" ] && pass "手机号已被使用 → 拒绝" || fail "手机号已被使用 → 拒绝"

# ============================================================
section "3. 福袋领取全流程（含围栏）"
# ============================================================

# 3.1 围栏 — 北京坐标拒绝
R=$(curl -s -X POST "$BASE/api/user/luckyBag/receive" \
  -H "Authorization: Bearer $TOKEN_U1" \
  -H "Content-Type: application/json" \
  -d '{"latitude":39.9,"longitude":116.4}')
MSG=$(echo "$R" | json_get "['message']")
[[ "$MSG" == *"宜宾"* ]] && pass "围栏: 北京坐标拒绝" || fail "围栏: 北京坐标拒绝" "$MSG"

# 重启清除内存限流
restart_server

# 3.2 缺少位置信息
R=$(curl -s -X POST "$BASE/api/user/luckyBag/receive" \
  -H "Authorization: Bearer $TOKEN_U1" \
  -H "Content-Type: application/json" \
  -d '{"slotIndex":1}')
MSG=$(echo "$R" | json_get "['message']")
[[ "$MSG" == *"位置"* ]] && pass "缺少位置 → 400" || fail "缺少位置 → 400" "$MSG"

# 重启
restart_server

# 3.3 正常领取（宜宾坐标）
R=$(curl -s -X POST "$BASE/api/user/luckyBag/receive" \
  -H "Authorization: Bearer $TOKEN_U1" \
  -H "Content-Type: application/json" \
  -d '{"latitude":28.77,"longitude":104.63,"slotIndex":3}')
LUCKY_OK=$(echo "$R" | json_get "['success']")
if [ "$LUCKY_OK" = "True" ]; then
  pass "福袋领取成功"
  RP_AMOUNT=$(echo "$R" | json_get "['data']['redPacket']['amount']")
  RP_MODE=$(echo "$R" | json_get "['data']['redPacket']['mode']")
  COUPON_CNT=$(echo "$R" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']['coupons']))")
  [ -n "$RP_AMOUNT" ] && [ "$RP_AMOUNT" != "None" ] && pass "红包金额: $RP_AMOUNT" || fail "红包金额为空"
  [ "$RP_MODE" = "mock" ] && pass "红包模式: mock" || fail "红包模式" "$RP_MODE"
  [ "$COUPON_CNT" -gt 0 ] 2>/dev/null && pass "消费券: $COUPON_CNT 张" || fail "消费券为 0"
else
  MSG=$(echo "$R" | json_get "['message']")
  fail "福袋领取" "$MSG"
fi

# 重启
restart_server

# 3.4 重复领取
R=$(curl -s -X POST "$BASE/api/user/luckyBag/receive" \
  -H "Authorization: Bearer $TOKEN_U1" \
  -H "Content-Type: application/json" \
  -d '{"latitude":28.77,"longitude":104.63}')
OK=$(echo "$R" | json_get "['success']")
MSG=$(echo "$R" | json_get "['message']")
[ "$OK" = "False" ] && pass "重复领取拒绝: $MSG" || fail "重复领取应拒绝"

# 3.5 查看我的福袋
R=$(curl -s "$BASE/api/user/luckyBag/my" -H "Authorization: Bearer $TOKEN_U1")
OK=$(echo "$R" | json_get "['success']")
[ "$OK" = "True" ] && pass "GET /luckyBag/my" || fail "GET /luckyBag/my"

# 3.6 红包列表
R=$(curl -s "$BASE/api/user/redpacket/list" -H "Authorization: Bearer $TOKEN_U1")
TOTAL_R=$(echo "$R" | json_get "['data']['total']")
[ "$TOTAL_R" -ge 1 ] 2>/dev/null && pass "红包列表: $TOTAL_R 条" || fail "红包列表" "$TOTAL_R 条"

# ============================================================
section "4. 消费券流程"
# ============================================================

R=$(curl -s "$BASE/api/user/coupons/my" -H "Authorization: Bearer $TOKEN_U1")
OK=$(echo "$R" | json_get "['success']")
[ "$OK" = "True" ] && pass "GET /coupons/my" || fail "GET /coupons/my"

COUPON_ID=$(echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d[0]['id'] if d else '')" 2>/dev/null)
if [ -n "$COUPON_ID" ]; then
  R=$(curl -s "$BASE/api/user/coupon/$COUPON_ID/qrcode" -H "Authorization: Bearer $TOKEN_U1")
  HAS_QR=$(echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); print('qrcodeUrl' in d.get('data',{}))")
  [ "$HAS_QR" = "True" ] && pass "消费券二维码" || fail "消费券二维码"

  # IDOR: 用户B查看用户A的券
  TOKEN_U2=$(curl -s -X POST "$BASE/api/user/h5/login" -H "Content-Type: application/json" -d '{"deviceId":"e2e_user_2"}' | json_get "['data']['token']")
  R=$(curl -s "$BASE/api/user/coupon/$COUPON_ID/qrcode" -H "Authorization: Bearer $TOKEN_U2")
  OK=$(echo "$R" | json_get "['success']")
  [ "$OK" = "False" ] && pass "IDOR: 他人券 → 拒绝" || fail "IDOR: 他人券未拒绝"
else
  fail "无消费券可测二维码"
fi

# ============================================================
section "5. 抽奖流程"
# ============================================================

R=$(curl -s "$BASE/api/user/lottery/config" -H "Authorization: Bearer $TOKEN_U1")
WHEEL_CNT=$(echo "$R" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data'].get('wheel',[])))" 2>/dev/null)
[ "$WHEEL_CNT" -gt 0 ] 2>/dev/null && pass "抽奖配置: 转盘 $WHEEL_CNT 格" || fail "抽奖配置"

TOKEN_U2=$(curl -s -X POST "$BASE/api/user/h5/login" -H "Content-Type: application/json" -d '{"deviceId":"e2e_user_no_bag"}' | json_get "['data']['token']")
R=$(curl -s -X POST "$BASE/api/user/lottery/draw" \
  -H "Authorization: Bearer $TOKEN_U2" \
  -H "Content-Type: application/json" -d '{"gameType":"wheel"}')
OK=$(echo "$R" | json_get "['success']")
[ "$OK" = "False" ] && pass "未领福袋 → 抽奖拒绝" || fail "未领福袋 → 不应可抽奖"

R=$(curl -s -X POST "$BASE/api/user/lottery/draw" \
  -H "Authorization: Bearer $TOKEN_U1" \
  -H "Content-Type: application/json" -d '{"gameType":"wheel"}')
OK=$(echo "$R" | json_get "['success']")
if [ "$OK" = "True" ]; then
  PRIZE=$(echo "$R" | json_get "['data']['prizeName']")
  pass "抽奖成功: $PRIZE"
else
  MSG=$(echo "$R" | json_get "['message']")
  fail "抽奖" "$MSG"
fi

R=$(curl -s -X POST "$BASE/api/user/lottery/draw" \
  -H "Authorization: Bearer $TOKEN_U1" \
  -H "Content-Type: application/json" -d '{"gameType":"wheel"}')
OK=$(echo "$R" | json_get "['success']")
[ "$OK" = "True" ] || [ "$OK" = "False" ] && pass "重复抽奖处理 (ok=$OK)" || fail "重复抽奖"

R=$(curl -s "$BASE/api/user/lottery/my" -H "Authorization: Bearer $TOKEN_U1")
OK=$(echo "$R" | json_get "['success']")
[ "$OK" = "True" ] && pass "GET /lottery/my" || fail "GET /lottery/my"

# ============================================================
section "6. 商家端流程"
# ============================================================

restart_server

# 6.1 发送验证码（已注册商家）
R=$(curl -s -X POST "$BASE/api/merchant/send-code" \
  -H "Content-Type: application/json" -d '{"phone":"13800138001"}')
OK=$(echo "$R" | json_get "['success']")
[ "$OK" = "True" ] && pass "商家发送验证码" || fail "商家发送验证码"

restart_server

# 6.2 未注册商家（不泄露注册状态）
R=$(curl -s -X POST "$BASE/api/merchant/send-code" \
  -H "Content-Type: application/json" -d '{"phone":"19999999999"}')
MSG=$(echo "$R" | json_get "['message']")
[[ "$MSG" == *"如该手机号已注册"* ]] && pass "未注册 → 不泄露状态" || fail "未注册商家" "$MSG"

restart_server

# 6.3 商家登录
R=$(curl -s -X POST "$BASE/api/merchant/send-code" \
  -H "Content-Type: application/json" -d '{"phone":"13800138001"}')
CODE=$(redis-cli GET "merchant:login-code:13800138001" 2>/dev/null)
TOKEN_M=""
if [ -n "$CODE" ] && [ "$CODE" != "(nil)" ]; then
  R=$(curl -s -X POST "$BASE/api/merchant/login" \
    -H "Content-Type: application/json" -d "{\"phone\":\"13800138001\",\"code\":\"$CODE\"}")
  TOKEN_M=$(echo "$R" | json_get "['data']['token']")
  [ -n "$TOKEN_M" ] && [ "$TOKEN_M" != "None" ] && pass "商家登录" || fail "商家登录"
else
  fail "验证码未找到"
fi

# 6.4 核销消费券
if [ -n "$TOKEN_M" ] && [ "$TOKEN_M" != "None" ]; then
  COUPON_CODE=$(mysql -u root yibin_youth_festival -sN -e "SELECT code FROM user_coupons WHERE status=1 LIMIT 1" 2>/dev/null)
  if [ -n "$COUPON_CODE" ]; then
    R=$(curl -s -X POST "$BASE/api/merchant/verify" \
      -H "Authorization: Bearer $TOKEN_M" \
      -H "Content-Type: application/json" -d "{\"code\":\"$COUPON_CODE\"}")
    OK=$(echo "$R" | json_get "['success']")
    [ "$OK" = "True" ] && pass "核销消费券" || { MSG=$(echo "$R" | json_get "['message']"); fail "核销" "$MSG"; }

    R=$(curl -s -X POST "$BASE/api/merchant/verify" \
      -H "Authorization: Bearer $TOKEN_M" \
      -H "Content-Type: application/json" -d "{\"code\":\"$COUPON_CODE\"}")
    OK=$(echo "$R" | json_get "['success']")
    [ "$OK" = "False" ] && pass "重复核销拒绝" || fail "重复核销应拒绝"
  else
    fail "无可核销消费券"
  fi

  R=$(curl -s "$BASE/api/merchant/statistics" -H "Authorization: Bearer $TOKEN_M")
  OK=$(echo "$R" | json_get "['success']")
  [ "$OK" = "True" ] && pass "商家核销统计" || fail "商家核销统计"

  R=$(curl -s "$BASE/api/merchant/records?page=1" -H "Authorization: Bearer $TOKEN_M")
  OK=$(echo "$R" | json_get "['success']")
  [ "$OK" = "True" ] && pass "商家核销记录" || fail "商家核销记录"
fi

# ============================================================
section "7. 管理后台全接口"
# ============================================================

R=$(curl -s -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" -d '{"username":"testadmin","password":"Test@2026"}')
ADMIN_TOKEN=$(echo "$R" | json_get "['data']['token']")
[ -n "$ADMIN_TOKEN" ] && [ "$ADMIN_TOKEN" != "None" ] && pass "管理员登录" || fail "管理员登录"

R=$(curl -s "$BASE/api/admin/dashboard" -H "Authorization: Bearer $ADMIN_TOKEN")
OK=$(echo "$R" | json_get "['success']")
[ "$OK" = "True" ] && pass "Dashboard" || fail "Dashboard"

R=$(curl -s "$BASE/api/admin/users?page=1&pageSize=5" -H "Authorization: Bearer $ADMIN_TOKEN")
CNT=$(echo "$R" | json_get "['data']['total']")
[ "$CNT" -gt 0 ] 2>/dev/null && pass "用户列表: $CNT 人" || fail "用户列表"

USER_ID_1=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['list'][0]['id'])" 2>/dev/null)
R=$(curl -s "$BASE/api/admin/users/$USER_ID_1" -H "Authorization: Bearer $ADMIN_TOKEN")
OK=$(echo "$R" | json_get "['success']")
[ "$OK" = "True" ] && pass "用户详情 #$USER_ID_1" || fail "用户详情"

R=$(curl -s "$BASE/api/admin/merchants?page=1" -H "Authorization: Bearer $ADMIN_TOKEN")
CNT=$(echo "$R" | json_get "['data']['total']")
[ "$CNT" -gt 0 ] 2>/dev/null && pass "商家列表: $CNT 家" || fail "商家列表"

MID=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['list'][0]['id'])" 2>/dev/null)
R=$(curl -s "$BASE/api/admin/merchants/$MID" -H "Authorization: Bearer $ADMIN_TOKEN")
OK=$(echo "$R" | json_get "['success']")
[ "$OK" = "True" ] && pass "商家详情 #$MID" || fail "商家详情"

R=$(curl -s "$BASE/api/admin/coupons?page=1" -H "Authorization: Bearer $ADMIN_TOKEN")
OK=$(echo "$R" | json_get "['success']")
[ "$OK" = "True" ] && pass "消费券列表" || fail "消费券列表"

R=$(curl -s -X POST "$BASE/api/admin/coupons" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"E2E测试券","amount":15,"totalCount":500,"validFrom":"2026-04-15","validTo":"2026-05-30"}')
CID=$(echo "$R" | json_get "['data']['id']")
[ -n "$CID" ] && [ "$CID" != "None" ] && pass "创建消费券 #$CID" || fail "创建消费券"

if [ -n "$CID" ] && [ "$CID" != "None" ]; then
  R=$(curl -s -X PUT "$BASE/api/admin/coupons/$CID" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"E2E测试券-已更新","amount":18}')
  OK=$(echo "$R" | json_get "['success']")
  [ "$OK" = "True" ] && pass "更新消费券" || fail "更新消费券"

  R=$(curl -s -X DELETE "$BASE/api/admin/coupons/$CID" -H "Authorization: Bearer $ADMIN_TOKEN")
  OK=$(echo "$R" | json_get "['success']")
  [ "$OK" = "True" ] && pass "停用消费券" || fail "停用消费券"
fi

R=$(curl -s "$BASE/api/admin/lucky-bag/records?page=1" -H "Authorization: Bearer $ADMIN_TOKEN")
OK=$(echo "$R" | json_get "['success']")
[ "$OK" = "True" ] && pass "福袋记录列表" || fail "福袋记录列表"

R=$(curl -s "$BASE/api/admin/finance/summary" -H "Authorization: Bearer $ADMIN_TOKEN")
OK=$(echo "$R" | json_get "['success']")
[ "$OK" = "True" ] && pass "财务汇总" || fail "财务汇总"

R=$(curl -s "$BASE/api/admin/finance/records?page=1" -H "Authorization: Bearer $ADMIN_TOKEN")
OK=$(echo "$R" | json_get "['success']")
[ "$OK" = "True" ] && pass "财务记录" || fail "财务记录"

R=$(curl -s "$BASE/api/admin/statistics" -H "Authorization: Bearer $ADMIN_TOKEN")
OK=$(echo "$R" | json_get "['success']")
[ "$OK" = "True" ] && pass "数据统计" || fail "数据统计"

R=$(curl -s "$BASE/api/admin/settings" -H "Authorization: Bearer $ADMIN_TOKEN")
OK=$(echo "$R" | json_get "['success']")
[ "$OK" = "True" ] && pass "系统设置读取" || fail "系统设置读取"

R=$(curl -s -X PUT "$BASE/api/admin/settings" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"daily_limit":"3000"}')
OK=$(echo "$R" | json_get "['success']")
[ "$OK" = "True" ] && pass "修改系统设置" || fail "修改系统设置"

curl -s -X PUT "$BASE/api/admin/settings" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"daily_limit":"5000"}' > /dev/null

# ============================================================
section "8. 权限与 RBAC 测试"
# ============================================================

R=$(curl -s "$BASE/api/admin/dashboard" -H "Authorization: Bearer $TOKEN_U1")
OK=$(echo "$R" | json_get "['success']")
[ "$OK" = "False" ] && pass "user → admin: 拒绝" || fail "user → admin 应拒绝"

R=$(curl -s "$BASE/api/user/info" -H "Authorization: Bearer $ADMIN_TOKEN")
OK=$(echo "$R" | json_get "['success']")
[ "$OK" = "False" ] && pass "admin → user: 拒绝" || fail "admin → user 应拒绝"

R2=$(curl -s -X POST "$BASE/api/admin/login" \
  -H "Content-Type: application/json" -d '{"username":"finance","password":"Finance@2026"}')
FIN_TOKEN=$(echo "$R2" | json_get "['data']['token']")
if [ -n "$FIN_TOKEN" ] && [ "$FIN_TOKEN" != "None" ]; then
  R=$(curl -s "$BASE/api/admin/finance/summary" -H "Authorization: Bearer $FIN_TOKEN")
  OK=$(echo "$R" | json_get "['success']")
  [ "$OK" = "True" ] && pass "finance 读取财务" || fail "finance 读取财务"

  R=$(curl -s "$BASE/api/admin/statistics" -H "Authorization: Bearer $FIN_TOKEN")
  OK=$(echo "$R" | json_get "['success']")
  [ "$OK" = "True" ] && pass "finance 读取统计" || fail "finance 读取统计"

  R=$(curl -s -X POST "$BASE/api/admin/coupons" \
    -H "Authorization: Bearer $FIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"不应创建","amount":1,"totalCount":1,"validFrom":"2026-04-15","validTo":"2026-05-30"}')
  OK=$(echo "$R" | json_get "['success']")
  [ "$OK" = "False" ] && pass "finance 无消费券写权限" || fail "finance 不应有写权限"

  R=$(curl -s "$BASE/api/admin/users?page=1" -H "Authorization: Bearer $FIN_TOKEN")
  OK=$(echo "$R" | json_get "['success']")
  [ "$OK" = "False" ] && pass "finance 无用户读权限" || fail "finance 不应有用户权限"
else
  fail "finance 登录失败"
fi

# ============================================================
section "9. 安全修复专项验证"
# ============================================================

RID=$(curl -sD- "$BASE/health" -H "X-Request-Id: <script>alert(1)</script>" 2>&1 | grep -i "x-request-id" | awk '{print $2}' | tr -d '\r')
UUID_RE='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
[[ "$RID" =~ $UUID_RE ]] && pass "X-Request-Id 伪造 → 替换UUID" || fail "X-Request-Id 未拦截" "$RID"

RID=$(curl -sD- "$BASE/health" -H "X-Request-Id: 550e8400-e29b-41d4-a716-446655440000" 2>&1 | grep -i "x-request-id" | awk '{print $2}' | tr -d '\r')
[ "$RID" = "550e8400-e29b-41d4-a716-446655440000" ] && pass "合法 X-Request-Id 放行" || fail "合法 UUID 未放行" "$RID"

TOKEN_ERR=$(curl -s -X POST "$BASE/api/user/h5/login" -H "Content-Type: application/json" -d '{"deviceId":"e2e_err_tester"}' | json_get "['data']['token']")
restart_server
R=$(curl -s -X POST "$BASE/api/user/luckyBag/receive" \
  -H "Authorization: Bearer $TOKEN_ERR" \
  -H "Content-Type: application/json" \
  -d '{"latitude":28.77,"longitude":104.63}')
MSG=$(echo "$R" | json_get "['message']")
HAS_LEAK=$(echo "$MSG" | python3 -c "
import sys
m=sys.stdin.read().lower()
leaks=['sequelize','sql','column','econnrefused','redis','traceback','stack']
print(any(k in m for k in leaks))
" 2>/dev/null)
[ "$HAS_LEAK" = "False" ] && pass "错误消息无内部泄露" || fail "错误消息泄露" "$MSG"

CORS_HDR=$(curl -sD- -H "Origin: https://evil.com" "$BASE/health" 2>&1 | grep -ci "access-control-allow-origin" || true)
[ "$CORS_HDR" = "0" ] && pass "CORS 拒绝 evil.com" || fail "CORS 未拒绝 evil.com"

# ============================================================
section "10. 限流验证"
# ============================================================

restart_server

# H5 login 限流: 20次/分钟
LIMIT_HIT=0
for i in $(seq 1 25); do
  HTTP_CODE=$(curl -so /dev/null -w "%{http_code}" -X POST "$BASE/api/user/h5/login" \
    -H "Content-Type: application/json" -d "{\"deviceId\":\"rate_test_$(printf '%06d' $i)\"}")
  if [ "$HTTP_CODE" = "429" ]; then
    LIMIT_HIT=1
    pass "H5登录限流 429 @ 第${i}次 (max=20)"
    break
  fi
done
[ "$LIMIT_HIT" = "0" ] && fail "H5登录限流未触发(25次)"

# WX login 限流: 10次/分钟
restart_server
LIMIT_HIT2=0
for i in $(seq 1 15); do
  HTTP_CODE=$(curl -so /dev/null -w "%{http_code}" -X POST "$BASE/api/user/login" \
    -H "Content-Type: application/json" -d "{\"code\":\"fake_code_$i\"}")
  if [ "$HTTP_CODE" = "429" ]; then
    LIMIT_HIT2=1
    pass "WX登录限流 429 @ 第${i}次 (max=10)"
    break
  fi
done
[ "$LIMIT_HIT2" = "0" ] && fail "WX登录限流未触发(15次)"

# ============================================================
section "11. 输入验证"
# ============================================================

R=$(curl -s -X POST "$BASE/api/user/h5/bindPhone" \
  -H "Authorization: Bearer $TOKEN_U1" \
  -H "Content-Type: application/json" -d '{"phone":"123"}')
OK=$(echo "$R" | json_get "['success']")
[ "$OK" = "False" ] && pass "手机号格式检查" || fail "手机号格式检查"

R=$(curl -s -X POST "$BASE/api/admin/coupons" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"负","amount":-10,"totalCount":1,"validFrom":"2026-04-15","validTo":"2026-05-30"}')
OK=$(echo "$R" | json_get "['success']")
[ "$OK" = "False" ] && pass "负金额消费券拒绝" || fail "负金额消费券未拒绝"

R=$(curl -s -X POST "$BASE/api/admin/coupons" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" -d '{"name":"缺字段"}')
OK=$(echo "$R" | json_get "['success']")
[ "$OK" = "False" ] && pass "缺字段拒绝" || fail "缺字段未拒绝"

restart_server

R=$(curl -s -X POST "$BASE/api/user/luckyBag/receive" \
  -H "Authorization: Bearer $TOKEN_ERR" \
  -H "Content-Type: application/json" \
  -d '{"latitude":28.77,"longitude":104.63,"slotIndex":999}')
MSG=$(echo "$R" | json_get "['message']")
[[ "$MSG" != *"频繁"* ]] && pass "slotIndex=999: $MSG" || fail "slotIndex 越界被限流" "$MSG"

# ============================================================
section "12. 数据库一致性"
# ============================================================

DUP=$(mysql -u root yibin_youth_festival -sN -e "SELECT COUNT(*) FROM users GROUP BY openid HAVING COUNT(*)>1" 2>/dev/null | head -1)
[ -z "$DUP" ] && pass "用户 openid 无重复" || fail "用户 openid 有重复"

DUP=$(mysql -u root yibin_youth_festival -sN -e "SELECT COUNT(*) FROM lucky_bag_records GROUP BY user_id HAVING COUNT(*)>1" 2>/dev/null | head -1)
[ -z "$DUP" ] && pass "福袋 user_id 无重复" || fail "福袋 user_id 有重复"

USED=$(mysql -u root yibin_youth_festival -sN -e "SELECT COALESCE(SUM(used_count),0) FROM redpacket_pool" 2>/dev/null)
RECORDS=$(mysql -u root yibin_youth_festival -sN -e "SELECT COUNT(*) FROM lucky_bag_records" 2>/dev/null)
[ "$USED" = "$RECORDS" ] && pass "红包池 used_count ($USED) = 记录数 ($RECORDS)" || fail "红包池不一致" "used=$USED records=$RECORDS"

COUPON_USED=$(mysql -u root yibin_youth_festival -sN -e "SELECT COALESCE(SUM(used_count),0) FROM coupons WHERE id IN (SELECT DISTINCT coupon_id FROM user_coupons)" 2>/dev/null)
UC_COUNT=$(mysql -u root yibin_youth_festival -sN -e "SELECT COUNT(*) FROM user_coupons" 2>/dev/null)
[ "$COUPON_USED" = "$UC_COUNT" ] && pass "消费券 used_count ($COUPON_USED) = 发放数 ($UC_COUNT)" || fail "消费券不一致" "used=$COUPON_USED issued=$UC_COUNT"

VERIFIED=$(mysql -u root yibin_youth_festival -sN -e "SELECT COUNT(*) FROM verify_records" 2>/dev/null)
UC_USED=$(mysql -u root yibin_youth_festival -sN -e "SELECT COUNT(*) FROM user_coupons WHERE status=2" 2>/dev/null)
[ "$VERIFIED" = "$UC_USED" ] && pass "核销记录 ($VERIFIED) = 已用券 ($UC_USED)" || fail "核销不一致" "verify=$VERIFIED used=$UC_USED"

# ============================================================
# 汇总
# ============================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  总计: $TOTAL 项 | ✅ $PASS 通过 | ❌ $FAIL 失败"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
