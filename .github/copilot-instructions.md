# STDF Reader Development Guide

This is a full-stack STDF (Standard Test Data Format) file analysis and visualization application with intelligent database caching.

## Project Structure

```
stdf_reader/
├── backend/           # Python FastAPI backend with SQLAlchemy
│   ├── app/
│   │   ├── routers/       # API endpoints (stdf.py, cache.py)
│   │   ├── services/      # Business logic (stdf_parser.py, cache_service.py)
│   │   ├── models/        # Data models (stdf_models.py, db_models.py)
│   │   ├── database.py    # SQLAlchemy setup
│   │   └── main.py        # FastAPI app entry
│   └── stdf_cache.db      # SQLite database (auto-created, gitignored)
├── frontend/          # React + Vite + Ant Design
│   └── src/
│       ├── pages/         # Home.jsx, FileDetail.jsx
│       ├── components/    # Reusable UI components
│       └── services/      # API client services
└── data/              # STDF files storage (gitignored)
```

## Build, Test, and Run

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Backend runs on http://localhost:8000

### Frontend
```bash
cd frontend
npm install
npm run dev        # Development server
npm run build      # Production build
npm run preview    # Preview production build
```

Frontend runs on http://localhost:5173

**Note**: No test suites are configured in this project.

## Architecture

### Database Caching System

The application implements a **dual-layer caching strategy** (memory + SQLite) for parsed STDF files:

1. **File Identification**: Uses SHA256 hash of file content (not filename) to identify files
2. **Memory Cache**: Fast in-memory cache in `StdfParserService._cache` dictionary
3. **Database Cache**: Persistent SQLite cache with two tables:
   - `stdf_files`: File metadata (hash, size, parse time, last accessed)
   - `stdf_data`: Parsed JSON data by type (summary, wafer_map, test_results, test_list)

**Cache Flow**:
- First request → Parse file with pystdf → Save to both caches → 2-10s
- Subsequent requests → Read from memory or database → ~0.01-0.1s (20-100x faster)

### Backend Pattern: Router → Service → Model

- **Routers** (`routers/`): FastAPI endpoints, handle HTTP, call services
- **Services** (`services/`): Core business logic, parsing, caching
  - `StdfParserService`: Wraps pystdf library, collects records via `StdfRecordCollector`
  - `CacheService`: Database operations for caching
- **Models** (`models/`): Pydantic models for validation and SQLAlchemy models for ORM

### Frontend Pattern: Pages → Components → Services

- **Pages**: Route-level components (Home for file list, FileDetail for analysis)
- **Components**: Reusable UI (AppLayout, WaferMap, charts)
- **Services**: Axios-based API clients for backend communication

### pystdf Integration

The backend uses the `pystdf` library for STDF parsing:
- `StdfRecordCollector` class implements callback pattern via `after_send()` method
- Collects various record types (MIR, MRR, PTR, FTR, PRR, PIR, WRR, WIR, TSR, HBR, SBR)
- Parser created with: `Parser(inp=file_path).addSink(collector)`

## Key Conventions

### File Paths and Data Directory

- STDF files are stored in `data/` directory (relative to project root)
- Backend resolves data directory as: `Path(__file__).resolve().parent.parent.parent.parent / "data"`
- Database file is at: `backend/stdf_cache.db`

### API Patterns

All STDF parsing endpoints automatically use caching:
```
GET  /api/stdf/files                    # List uploaded files
POST /api/stdf/upload                   # Upload new file
GET  /api/stdf/summary/{filename}       # Get summary (cached)
GET  /api/stdf/results/{filename}       # Get test results (cached)
GET  /api/stdf/wafermap/{filename}      # Get wafer map (cached)
GET  /api/stdf/test-list/{filename}     # Get test list (cached)

GET  /api/cache/stats                   # Cache statistics
GET  /api/cache/files                   # List cached files
DELETE /api/cache/files/{file_id}       # Delete specific cache
DELETE /api/cache/clear                 # Clear all cache
```

### Database Session Management

- Use `get_db()` dependency in routers to get SQLAlchemy session
- Session auto-closes after request via try/finally pattern
- Database initialized on app startup via `init_db()` in main.py

### CORS Configuration

Frontend is allowed from `http://localhost:5173` and `http://localhost:3000` (see `main.py`)

### Threading Safety

- `StdfParserService` uses `threading.Lock()` for cache access
- Memory cache keyed by file path with signature (size:mtime) for invalidation
- Database transactions handle concurrent access

## API Response Models

Backend uses Pydantic models (defined in `models/stdf_models.py`):
- `StdfSummaryResponse`: MIR/MRR info, site yield, bin statistics
- `TestResultsResponse`: PTR/FTR test measurements
- `WaferMapResponse`: Die-level pass/fail coordinates
- `TestInfo`: Individual test metadata from TSR records

## Cache Management

When modifying cache behavior:
1. Update `CacheService` methods in `services/cache_service.py`
2. File hash calculation uses `calculate_file_hash()` with SHA256
3. Cache data stored as JSON strings in `STDFData.data_json` field
4. Last accessed time updated automatically on cache reads

## Internationalization

- Frontend uses Ant Design with Chinese locale (`zhCN`)
- API messages and descriptions are in Chinese
- Consider this when adding new user-facing text
