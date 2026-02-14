# STDF Reader 数据库缓存功能使用说明

## 功能概述

已为 STDF Reader 添加了完整的数据库缓存功能，可以自动缓存解析过的文件数据，避免重复解析相同文件。

## 技术实现

- **数据库**: SQLite（轻量级，无需额外配置）
- **ORM**: SQLAlchemy 2.0
- **文件识别**: 使用 SHA256 哈希值准确识别文件
- **缓存内容**: 完整解析结果（summary、wafer_map、test_results、test_list）

## 工作原理

### 1. 文件识别
- 当上传或解析 STDF 文件时，系统会计算文件的 SHA256 哈希值
- 即使文件名不同，只要内容相同就会被识别为同一文件

### 2. 缓存策略
- **首次解析**: 解析文件并将结果存入数据库
- **再次访问**: 直接从数据库读取，跳过解析过程
- **双层缓存**: 内存缓存（快速）+ 数据库缓存（持久）

### 3. 数据库表结构

#### stdf_files 表
存储文件元信息：
- `file_hash`: SHA256 哈希值（唯一索引）
- `filename`: 原始文件名
- `file_size`: 文件大小
- `upload_time`: 上传时间
- `parse_time`: 解析耗时
- `last_accessed`: 最后访问时间

#### stdf_data 表
存储解析数据（JSON 格式）：
- `data_type`: 数据类型（summary/wafer_map/test_results/test_list）
- `data_json`: JSON 格式的完整数据

## 新增 API 端点

### 1. 获取缓存统计
```bash
GET /api/cache/stats
```

响应：
```json
{
  "total_cached_files": 10,
  "total_data_records": 40,
  "total_file_size": 52428800
}
```

### 2. 列出缓存文件
```bash
GET /api/cache/files?limit=100&offset=0
```

响应：
```json
{
  "files": [
    {
      "id": 1,
      "file_hash": "a1b2c3d4...",
      "filename": "test.stdf",
      "file_size": 1048576,
      "upload_time": "2026-02-13T16:00:00",
      "parse_time": 2.5,
      "last_accessed": "2026-02-13T16:30:00"
    }
  ],
  "total": 1
}
```

### 3. 删除指定缓存
```bash
DELETE /api/cache/files/{file_id}
```

### 4. 清空所有缓存
```bash
DELETE /api/cache/clear
```

## 现有 API 的改进

所有现有的 STDF 解析 API 现在都会自动使用缓存：

- `GET /api/stdf/summary/{filename}` - 自动缓存摘要信息
- `GET /api/stdf/results/{filename}` - 自动缓存测试结果
- `GET /api/stdf/wafermap/{filename}` - 自动缓存 Wafer Map
- `GET /api/stdf/test-list/{filename}` - 自动缓存测试列表

## 性能提升

### 首次解析（无缓存）
- 解析文件: ~2-10 秒（取决于文件大小）
- 保存到数据库: ~0.1-0.5 秒

### 后续访问（有缓存）
- 从数据库读取: ~0.01-0.1 秒
- **性能提升**: 20-100 倍 ⚡

## 数据库位置

数据库文件自动创建在：
```
backend/stdf_cache.db
```

该文件已被添加到 `.gitignore`，不会提交到代码库。

## 使用示例

### 1. 启动服务器
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

数据库会在第一次启动时自动初始化。

### 2. 上传并解析文件（首次）
```bash
# 上传文件
curl -X POST http://localhost:8000/api/stdf/upload \
  -F "file=@test.stdf"

# 首次解析（会缓存）
curl http://localhost:8000/api/stdf/summary/test.stdf
```

### 3. 再次访问（从缓存读取）
```bash
# 第二次及以后，直接从数据库读取
curl http://localhost:8000/api/stdf/summary/test.stdf
```

### 4. 查看缓存状态
```bash
# 查看统计
curl http://localhost:8000/api/cache/stats

# 查看缓存文件列表
curl http://localhost:8000/api/cache/files
```

### 5. 管理缓存
```bash
# 删除特定缓存
curl -X DELETE http://localhost:8000/api/cache/files/1

# 清空所有缓存
curl -X DELETE http://localhost:8000/api/cache/clear
```

## 注意事项

1. **自动清理**: 建议定期清理长时间未访问的缓存数据
2. **磁盘空间**: 缓存会占用磁盘空间，根据需要清理
3. **数据一致性**: 使用文件哈希值确保数据一致性
4. **并发安全**: 数据库操作使用事务，支持并发访问

## 故障排除

### 数据库文件损坏
```bash
# 删除数据库文件重新初始化
rm backend/stdf_cache.db
# 重启服务器会自动重建
```

### 查看数据库内容
```bash
cd backend
sqlite3 stdf_cache.db
> SELECT * FROM stdf_files;
> .quit
```

## 下一步计划

- [ ] 添加缓存过期机制（如 30 天自动清理）
- [ ] 添加数据压缩以节省空间
- [ ] 前端缓存管理界面
- [ ] 导出/导入缓存数据功能
