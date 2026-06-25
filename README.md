# 家长简报查看系统

直连飞书多维表格的家长简报查询系统，7x24小时公网可用。

## 功能特性

- ✅ 直连飞书Open API，无需中间服务器
- ✅ 自动缓存，响应速度快
- ✅ 支持按学生姓名查询课堂记录
- ✅ 自动生成家长简报（JSON格式）
- ✅ 七彩配色，打印友好

## 技术栈

- Node.js + Express
- 飞书 Open API (tenant_access_token)
- 纯前端HTML/CSS/JS

## 环境变量

```bash
FEISHU_APP_ID=cli_aab61518b6789cd2
FEISHU_APP_SECRET=your_secret_here
PORT=3456  # 可选，默认3456
```

## 本地运行

```bash
npm install
npm start
```

访问: http://localhost:3456

## 部署

详见 `DEPLOYMENT_GUIDE.md`

## API接口

- `GET /api/health` - 健康检查
- `GET /api/briefing?name=学生姓名` - 查询学生简报
- `GET /api/search?q=关键字` - 搜索学生姓名

## 数据源

飞书多维表格 Base Token: `ETkAbO98zaY8oTsoFoZc7THNnic`
