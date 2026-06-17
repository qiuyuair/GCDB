# GCDB Telegram Worker

从 [GCDB](https://gcdb.com.au/offers/) 拉取当前有效的礼品卡优惠，增量推送到 Telegram Bot 私聊。运行在 Cloudflare Workers + D1 上。

## 功能

- 每 2 小时自动检查 GCDB 新优惠（Cron Trigger）
- 仅推送未发送过的优惠（D1 去重）
- Bold title with type, validity, blockquoted body, and link (all in English)
- 有配图时使用 `sendPhoto`，无配图时使用 `sendMessage`

## 项目结构

```
src/
  index.ts      # Worker 入口，Cron + /run 手动触发
  gcdb.ts       # GCDB WordPress REST API 客户端
  telegram.ts   # Telegram 消息格式化与发送
  db.ts         # D1 去重逻辑
schema.sql      # D1 建表脚本
wrangler.toml   # Worker、D1、Cron 配置
```

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置本地 Secrets

复制示例文件并填入真实值：

```bash
cp .dev.vars.example .dev.vars
```

`.dev.vars` 不会提交到 Git。

### 3. 创建 D1 数据库并建表

```bash
npx wrangler d1 create gcdb-offers
```

将命令输出中的 `database_id` 写入 `wrangler.toml` 的 `database_id` 字段，然后执行：

```bash
npx wrangler d1 execute gcdb-offers --remote --file=schema.sql
```

本地开发可使用：

```bash
npx wrangler d1 execute gcdb-offers --local --file=schema.sql
```

### 4. 启动本地 Worker

```bash
npm run dev
```

手动触发同步：

```bash
curl http://127.0.0.1:8787/run
```

若设置了 `RUN_SECRET`：

```bash
curl -H "Authorization: Bearer <RUN_SECRET>" http://127.0.0.1:8787/run
```

## 部署方式（GitHub → Cloudflare 自动部署）

日常流程：**改代码 → `git push` → Cloudflare 自动从 GitHub 拉取并部署**。

```
本地开发 → git push → GitHub (qiuyuair/GCDB) → Cloudflare 自动构建部署 → Worker 上线
```

不再使用本地 `wrangler deploy` 或 GitHub Actions 作为主流程；Cloudflare Secrets（Token 等）保留在云端，Git 部署不会覆盖它们。

### 第一步：一次性配置 Secrets 和 D1

1. 在 Telegram 中找到你的 Bot，发送 `/start` 建立私聊
2. 在 Cloudflare 配置 Secrets（只需一次）：

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
```

也可在 Dashboard → **gcdb-telegram** → **Settings** → **Variables and Secrets** 中添加。

3. D1 数据库已创建（`gcdb-offers`），`wrangler.toml` 中已绑定

### 第二步：连接 GitHub 仓库（只需一次）

Worker 已存在，需在 Dashboard 把 Git 仓库连上去：

1. 打开 [Cloudflare Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
2. 点击 Worker：**gcdb-telegram**
3. 进入 **Settings** → **Builds**
4. 点击 **Connect to Git**（或 **Connect**）
5. 授权 GitHub，选择仓库：**qiuyuair/GCDB**
6. 构建设置：
   - **Production branch**：`main`
   - **Root directory**：`/`（留空即可）
   - **Build command**：留空
   - **Deploy command**：`npx wrangler deploy`
7. 保存

> Worker 名称必须与 `wrangler.toml` 中的 `name = "gcdb-telegram"` 一致，否则构建会失败。

### 第三步：日常更新

```bash
git add .
git commit -m "你的修改说明"
git push
```

推送后 Cloudflare 会自动：
- 从 GitHub 拉取最新代码
- 执行 `npm install` 和 `npx wrangler deploy`
- 在 Dashboard → **Deployments** 显示构建日志

### 验证

```text
https://gcdb-telegram.qiuyuair.workers.dev/run
```

### 获取 Telegram Chat ID

向 Bot 发送 `/start` 后，可用以下命令查看你的 chat_id：

```bash
curl "https://api.telegram.org/bot<TOKEN>/getUpdates"
```

在返回的 `message.chat.id` 字段中查找（私聊时通常与用户 ID 相同）。

### 手动部署（仅调试用）

```bash
npm run deploy
```

Git 已连接后，建议以 `git push` 为准，避免与自动部署冲突。

## Telegram message format

```
<b>6% off Amazon gift cards in the Samsung Wallet app</b>

Type: Discount
Valid: While stocks last

<blockquote expandable>Save 6% on $50-500 Amazon gift cards when you purchase them...</blockquote>
<a href="https://gcdb.com.au/offer/12382/">View details</a>
```

The body uses an expandable blockquote (collapsed by default, tap to expand).

## 环境变量

| 变量 | 说明 |
|------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token |
| `TELEGRAM_CHAT_ID` | 你的 Telegram 用户 ID（与 Bot 私聊的 chat_id） |
| `RUN_SECRET` | 可选，保护 `/run` 端点 |
| `DB` | D1 数据库绑定（在 `wrangler.toml` 中配置） |

## 许可证

MIT
