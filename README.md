# GCDB Telegram Worker

从 [GCDB](https://gcdb.com.au/offers/) 拉取当前有效的礼品卡优惠，增量推送到 Telegram 频道。运行在 Cloudflare Workers + D1 上。

## 功能

- 每 2 小时自动检查 GCDB 新优惠（Cron Trigger）
- 仅推送未发送过的优惠（D1 去重）
- 标题加粗，附带类型、有效期、详情正文与链接
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

## 部署到 Cloudflare

### 一次性配置

1. 配置 Telegram Bot（@BotFather）并将 Bot 设为频道管理员
2. 设置 Cloudflare Secrets：

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHANNEL_ID
# 可选：保护 /run 端点
npx wrangler secret put RUN_SECRET
```

3. 确认 `wrangler.toml` 中 D1 `database_id` 已填写

### 方式 A：GitHub → Cloudflare Git 集成（推荐）

1. 将本项目推送到 GitHub
2. Cloudflare Dashboard → Workers & Pages → Create → Connect to Git
3. 选择仓库与 `main` 分支
4. Deploy command 填写：`npx wrangler deploy`
5. 之后每次 `git push` 自动部署

### 方式 B：GitHub Actions

仓库已包含 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)。

在 GitHub Repository → Settings → Secrets 中添加：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

推送到 `main` 分支后自动部署。Telegram Token 仍配置在 Cloudflare Secrets，不要放进 GitHub。

### 手动部署

```bash
npm run deploy
```

部署后访问：

```text
https://<worker-name>.<subdomain>.workers.dev/run
```

## Telegram 消息格式

```
<b>6% off Amazon gift cards in the Samsung Wallet app</b>

类型: Discount
有效期: While stocks last

Save 6% on $50-500 Amazon gift cards when you purchase them...

<a href="https://gcdb.com.au/offer/12382/">查看详情</a>
```

有配图时，上述文字作为图片 caption 显示。

## 环境变量

| 变量 | 说明 |
|------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token |
| `TELEGRAM_CHANNEL_ID` | 频道 ID，如 `@channel` 或 `-100xxxxxxxxxx` |
| `RUN_SECRET` | 可选，保护 `/run` 端点 |
| `DB` | D1 数据库绑定（在 `wrangler.toml` 中配置） |

## 许可证

MIT
