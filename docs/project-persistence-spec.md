# Project Persistence — OpenSpec

*Kiểm soát tính năng lưu dữ liệu theo dự án: save, load, auto-sync, lifecycle.*

---

## 1. Hiện trạng (As-Is)

### 1.1 Kiến trúc 2-store

| Store | Loại | Mục đích |
|-------|------|----------|
| `surveyStore` (Zustand) | In-memory (RAM) | Session hiện tại: parsedQuestions, oldVariableMapping, qcLogicGraph, UI state |
| `projectStore` (Zustand + persist) | localStorage | Danh sách projects, mỗi project chứa snapshot data |

**Luồng dữ liệu:**

```
Excel Import → surveyStore (RAM)
                    ↕ useAutoSave (sync)
              projectStore (localStorage)
                    ↕ useAutoLoadProject (restore)
              surveyStore (RAM) ← khi mở app
```

### 1.2 Dữ liệu mỗi Project

```typescript
interface ProjectData {
  id: string                              // project_1710...
  name: string                            // "Dự án ABC"
  description?: string                    // Mô tả ngắn
  createdAt: string                       // ISO timestamp
  updatedAt: string                       // Auto-updated on save
  parsedQuestions: ParsedQuestion[]        // Câu hỏi (đã chỉnh sửa UI)
  oldVariableMapping: OldVariableMapping   // Raw var → question ID mapping
  pristineParsedQuestions?: ParsedQuestion[]       // Data gốc từ Excel
  pristineOldVariableMapping?: OldVariableMapping  // Mapping gốc từ Excel
  qcLogicGraph: QCLogicGraph | null       // Canvas graph state
}
```

### 1.3 Hooks hiện có

| Hook | File | Trigger | Chức năng |
|------|------|---------|-----------|
| `useAutoSave` | `lib/hooks/useAutoSave.ts` | surveyStore thay đổi | Sync surveyStore → projectStore (localStorage) |
| `useAutoLoadProject` | `lib/hooks/useAutoLoadProject.ts` | App mount | Load projectStore → surveyStore |

Cả hai được gọi tại `MainLayout.tsx`.

### 1.4 Actions hiện có

| Action | Nơi gọi | Mô tả |
|--------|---------|-------|
| `createProject(name, desc)` | ProjectManager | Tạo project mới, set currentProjectId |
| `loadProject(id)` | ProjectManager | Load project → surveyStore, redirect /import |
| `deleteProject(id)` | ProjectManager | Xóa project, clear surveyStore nếu đang active |
| `saveCurrentProjectData(data)` | useAutoSave | Ghi data vào project hiện tại |
| `loadProjectData(data)` | useAutoLoadProject, ProjectManager | Load data vào surveyStore |

---

## 2. Lifecycle chi tiết

### 2.1 Tạo dự án mới

```
User → Bấm "New Project" → nhập tên/mô tả
  → createProject(name, desc)
    → projectStore: thêm project mới (parsedQuestions: [], qcLogicGraph: null)
    → set currentProjectId = new id
  → Nếu đang có data (từ project cũ):
    → saveCurrentProjectData() lưu data hiện tại vào project CŨ trước
  → surveyStore KHÔNG bị reset (data cũ vẫn ở RAM)
```

### 2.2 Chuyển dự án (Load)

```
User → Bấm vào project card
  → loadProject(id)
    → set currentProjectId = id
    → return ProjectData
  → loadProjectData({...project})
    → surveyStore: replace toàn bộ data (questions, mapping, graph)
  → router.push('/import')
```

### 2.3 Auto-save (realtime)

```
useAutoSave (useEffect):
  Watch: parsedQuestions, oldVariableMapping, pristine*, qcLogicGraph
  On change → saveCurrentProjectData({...}) → projectStore.updateProject()
  → localStorage key: 'ifm-projects-storage'
```

### 2.4 Auto-load (app start)

```
useAutoLoadProject (useEffect):
  If currentProjectId exists in localStorage:
    → getCurrentProject()
    → loadProjectData({...})
    → surveyStore restored from last session
```

### 2.5 Xóa dự án

```
User → Bấm Delete → Confirm
  → deleteProject(id)
  → Nếu id === currentProjectId:
    → setCurrentProject(null)
    → loadProjectData({ empty })
    → surveyStore reset về trạng thái trống
```

---

## 3. Vấn đề đã biết & Giới hạn

### 3.1 localStorage quota (~5MB)

| Vấn đề | Mô tả |
|---------|-------|
| **Giới hạn 5MB** | localStorage chỉ chứa ~5MB. Dự án lớn (500+ câu hỏi, graph phức tạp) có thể vượt quota |
| **Tất cả projects = 1 key** | Mọi project lưu trong 1 key `ifm-projects-storage`. Nhiều project = dễ hết quota |
| **Không có error handling** | Nếu localStorage full, save sẽ thất bại thầm lặng (no user feedback) |

### 3.2 Race condition

| Vấn đề | Mô tả |
|---------|-------|
| **Auto-save khi chuyển project** | Khi loadProject(), surveyStore bị overwrite → trigger useAutoSave → có thể ghi data project B vào project A trong 1-2 render cycle |
| **Mitigation hiện tại** | `useAutoSave` check `currentProjectId` trước khi save → giảm thiểu nhưng chưa triệt để |

### 3.3 Data không được lưu

| Data | Lưu? | Ghi chú |
|------|------|---------|
| parsedQuestions | ✅ | Bao gồm chỉnh sửa UI (row codes, labels, types) |
| oldVariableMapping | ✅ | Raw var mapping |
| pristineParsedQuestions | ✅ | Data gốc Excel |
| qcLogicGraph | ✅ | Canvas nodes, edges, positions |
| Excel file gốc | ❌ | Không lưu binary. Nếu muốn re-import phải upload lại |
| Generated syntax | ❌ | Compute on demand, không cần lưu |
| UI state (search, filters, expanded) | ❌ | Reset khi reload |

---

## 4. Luồng UX mong muốn (To-Be)

### 4.1 Happy path

```
1. User mở app lần đầu → trang Projects trống
2. Bấm "New Project" → nhập tên "Dự án ABC" → tạo xong
3. Redirect sang /import → Upload Excel → Data parsed vào surveyStore
4. useAutoSave tự động lưu data vào projectStore (localStorage)
5. User chỉnh sửa questions (đổi type, row codes, labels, piping...)
6. Mỗi thay đổi → useAutoSave sync → localStorage updated
7. User đóng browser
8. Mở lại app → useAutoLoadProject → load "Dự án ABC" → data restored
9. Mọi thứ y hệt lần cuối chỉnh sửa
```

### 4.2 Multi-project

```
1. User đang ở "Dự án ABC" (đã có data)
2. Bấm Projects → thấy danh sách
3. Bấm "Dự án XYZ" → loadProject("xyz")
   → surveyStore overwrite bằng data XYZ
   → redirect /import
4. User chỉnh sửa → auto-save vào XYZ
5. Bấm quay lại "Dự án ABC" → load lại data ABC
   → Mọi chỉnh sửa ABC vẫn còn
```

---

## 5. Cấu trúc file

```
store/
  projectStore.ts          # Zustand + persist (localStorage)
  surveyStore.ts           # Zustand (in-memory session)

lib/hooks/
  useAutoSave.ts           # surveyStore → projectStore sync
  useAutoLoadProject.ts    # projectStore → surveyStore on mount

components/
  Layout/MainLayout.tsx    # Gọi useAutoSave + useAutoLoadProject
  pages/ProjectManager.tsx # UI: create, load, delete, edit projects
```

---

## 6. Bảng kiểm tra (Test Matrix)

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 1 | Tạo project mới | Project xuất hiện trong danh sách, currentProjectId set | ✅ Hoạt động |
| 2 | Import Excel vào project | parsedQuestions populated, auto-save to localStorage | ✅ Hoạt động |
| 3 | Chỉnh sửa row code (11→99) | parsedQuestions updated, syntax reflect code 99 | ✅ Đã sửa |
| 4 | Đổi question type | Type change saved, persist across reload | ✅ Hoạt động |
| 5 | Chỉnh sửa piping/logic | Logic changes saved in qcLogicGraph | ✅ Hoạt động |
| 6 | Đóng browser, mở lại | Data restored from localStorage | ✅ Hoạt động |
| 7 | Chuyển giữa 2 projects | Data A preserved khi load B, quay lại A vẫn đúng | ✅ Hoạt động |
| 8 | Xóa project đang active | surveyStore reset, UI trống | ✅ Hoạt động |
| 9 | localStorage full (>5MB) | ⚠️ Cần error handling + user notification | ❌ Chưa có |
| 10 | Export/Import project file | ⚠️ Không hỗ trợ (chỉ có localStorage) | ❌ Chưa có |
| 11 | Lưu Excel file gốc trong project | ⚠️ Không lưu binary | ❌ Chưa có |

---

## 7. Roadmap cải tiến (Future)

| Priority | Feature | Mô tả |
|----------|---------|-------|
| P1 | **Quota warning** | Kiểm tra localStorage usage, cảnh báo khi gần 5MB |
| P1 | **Export project JSON** | Download project data dạng .json để backup/share |
| P1 | **Import project JSON** | Upload .json để restore project |
| P2 | **IndexedDB storage** | Chuyển từ localStorage sang IndexedDB (50MB+) |
| P2 | **Per-project storage** | Mỗi project 1 key thay vì tất cả trong 1 key |
| P3 | **Cloud sync** | Supabase/Firebase để đồng bộ giữa các máy |
| P3 | **Project templates** | Template dự án mẫu để tạo nhanh |
