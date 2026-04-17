# STDF Reader

全栈 STDF (Standard Test Data Format) 文件分析与可视化应用。

## ✨ 新功能：数据库缓存

现已支持智能缓存功能！首次解析的文件会自动缓存到数据库，再次访问时直接读取，**性能提升 20-100 倍**。

- 📦 使用 SQLite 数据库持久化缓存
- 🔐 SHA256 哈希值准确识别文件
- ⚡ 双层缓存（内存 + 数据库）
- 🎯 完整的缓存管理 API

详见 [缓存功能使用说明](./CACHE_GUIDE.md)

## 项目结构

```
stdf_reader/
├── frontend/          # React 前端 (Vite)
├── backend/           # Python FastAPI 后端
├── data/              # STDF 数据文件存放目录
├── .gitignore
└── README.md
```

## 快速开始

### 后端

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

前端默认运行在 http://localhost:5173，后端 API 运行在 http://localhost:8000

## 功能

- 上传和解析 STDF 文件
- 查看测试摘要 (MIR/MRR)
- 查看测试结果数据 (PTR/FTR)
- Wafer Map 可视化
- 测试数据图表分析
- 数据导出

## 部署方式

### Linux 环境部署（Docker Compose）

1. 安装并启动 Docker（需包含 Docker Compose v2）。
2. 进入项目根目录。
3. 首次执行时赋予脚本权限：

```bash
chmod +x start-linux.sh
```

4. 一键启动：

```bash
./start-linux.sh
```

5. 查看服务状态：

```bash
docker compose ps
```

6. 停止服务：

```bash
docker compose down
```

启动后访问：

- 前端: http://localhost:5173
- 后端: http://localhost:8000

### Windows 环境部署（Docker Desktop + Docker Compose）

1. 安装 Docker Desktop。
2. 打开 Docker Desktop，确认 Engine 为 Running。
3. 在项目根目录打开 PowerShell。
4. 一键构建并启动：

```powershell
docker compose up --build -d
```

5. 查看服务状态：

```powershell
docker compose ps
```

6. 停止服务：

```powershell
docker compose down
```

启动后访问：

- 前端: http://localhost:5173
- 后端: http://localhost:8000
