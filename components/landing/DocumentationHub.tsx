'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Code2, BookOpen, ChevronRight, AlertTriangle, Info } from 'lucide-react'

const SECTIONS = [
  { id: 'tong-quan', label: 'Tổng quan' },
  { id: 'section-1', label: '1. Chuẩn bị Dữ liệu đầu vào' },
  { id: 'section-2', label: '2. Từ điển Cú pháp QC' },
  { id: 'section-3', label: '3. Logic & Routing Masterclass' },
  { id: 'section-4', label: '4. Đồng bộ Giao diện & Dữ liệu' },
  { id: 'xuat-ban', label: 'Xuất bản & tích hợp' },
] as const

export default function DocumentationHub() {
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].id)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id)
        })
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    )
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen bg-background-dark text-white">
      <header className="sticky top-0 z-40 border-b border-border-dark bg-background-dark/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex items-center justify-center size-8 rounded-full bg-primary/20 border border-primary/40 text-primary">
              <Code2 className="size-5" />
            </div>
            <span className="font-display font-bold text-lg tracking-wide uppercase">IFM Syntax Pro</span>
          </Link>
          <Link
            href="/projects"
            className="flex items-center gap-2 rounded-lg bg-primary hover:bg-primary-hover text-white px-4 py-2 text-sm font-bold transition-colors"
          >
            Vào Workspace
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-12">
        <aside className="hidden lg:block w-64 shrink-0">
          <nav className="sticky top-24 flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-4 text-muted-foreground">
              <BookOpen className="size-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Mục lục</span>
            </div>
            {SECTIONS.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={() => setActiveSection(id)}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeSection === id ? 'bg-primary/20 text-primary font-medium' : 'text-gray-400 hover:text-white hover:bg-surface-dark'
                }`}
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="lg:hidden mb-8 flex flex-wrap gap-2">
            {SECTIONS.map(({ id, label }) => (
              <a key={id} href={`#${id}`} className="px-3 py-1.5 rounded-lg bg-surface-dark border border-border-dark text-gray-400 hover:text-white text-xs font-medium transition-colors">
                {label}
              </a>
            ))}
          </div>

          <div className="prose-doc max-w-3xl">
            {/* Tổng quan */}
            <section id="tong-quan" className="scroll-mt-24">
              <h1 className="text-3xl font-display font-bold text-white mb-4">Tổng quan hệ thống</h1>
              <p className="text-gray-400 leading-relaxed mb-4">
                <strong className="text-white">IFM Syntax Pro</strong> là công cụ xây dựng logic QC (Quality Control) dạng Node-based trực quan, phục vụ tự động hóa kiểm tra chất lượng dữ liệu khảo sát trên nền tảng IBM SPSS.
              </p>
              <p className="text-gray-400 leading-relaxed mb-4">
                Thay vì gõ thủ công hàng trăm dòng cú pháp SPSS, người dùng kéo thả các kết nối trên Canvas để ánh xạ logic. Hệ thống chuyển đổi từ file Excel Dictionary (định dạng SPSS-Excel) thành file <code className="px-1.5 py-0.5 rounded bg-surface-dark text-primary text-sm">.sps</code> sẵn sàng chạy trong SPSS.
              </p>
            </section>

            {/* SECTION 1: Chuẩn bị Dữ liệu đầu vào */}
            <section id="section-1" className="scroll-mt-24 mt-16">
              <h1 className="text-3xl font-display font-bold text-white mb-4">1. Chuẩn bị Dữ liệu đầu vào (Input Data Formatting)</h1>
              <p className="text-gray-400 leading-relaxed mb-6">
                Parser đọc file Excel theo định dạng SPSS-Excel chuẩn. Cấu trúc gồm <strong className="text-white">Sheet 1</strong> (biến + nhãn) và <strong className="text-white">Sheet 2</strong> (value labels, tùy chọn).
              </p>

              <h2 className="text-xl font-semibold text-gray-200 mt-8 mb-3">1.1. Cấu trúc Sheet 1 — Biến & Nhãn</h2>
              <p className="text-gray-400 leading-relaxed mb-3">
                Sheet đầu tiên phải có <strong className="text-white">ít nhất 2 cột</strong>. Parser đọc từ hàng đầu tiên (có thể bỏ qua hàng tiêu đề nếu cột 1 là &quot;Variable&quot; hoặc &quot;Var&quot;).
              </p>
              <table className="w-full text-sm border-collapse mb-6 rounded-lg overflow-hidden border border-border-dark">
                <thead>
                  <tr className="bg-surface-dark">
                    <th className="text-left py-3 px-4 text-gray-300 font-semibold">Cột</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-semibold">Nội dung</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-semibold">Ví dụ</th>
                  </tr>
                </thead>
                <tbody className="text-gray-400">
                  <tr className="border-b border-border-dark/50">
                    <td className="py-3 px-4 font-medium text-white">Cột 1</td>
                    <td className="py-3 px-4">Tên biến (Variable Name)</td>
                    <td className="py-3 px-4 font-mono text-primary text-xs">var123, var456O789</td>
                  </tr>
                  <tr className="border-b border-border-dark/50">
                    <td className="py-3 px-4 font-medium text-white">Cột 2</td>
                    <td className="py-3 px-4">Nhãn (Label)</td>
                    <td className="py-3 px-4 font-mono text-primary text-xs">Đáp án A:Q7</td>
                  </tr>
                </tbody>
              </table>

              <h2 className="text-xl font-semibold text-gray-200 mt-8 mb-3">1.2. Quy tắc suy luận loại câu hỏi</h2>
              <p className="text-gray-400 leading-relaxed mb-3">
                Parser <strong className="text-white">không</strong> đọc cột &quot;Question Type&quot; hay &quot;Row Code&quot;. Loại câu hỏi được suy từ <strong className="text-white">pattern tên biến</strong> và <strong className="text-white">nội dung nhãn</strong>:
              </p>
              <table className="w-full text-sm border-collapse mb-6 rounded-lg overflow-hidden border border-border-dark">
                <thead>
                  <tr className="bg-surface-dark">
                    <th className="text-left py-3 px-4 text-gray-300 font-semibold">Pattern biến</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-semibold">Pattern nhãn</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-semibold">Loại</th>
                  </tr>
                </thead>
                <tbody className="text-gray-400">
                  <tr className="border-b border-border-dark/50">
                    <td className="py-3 px-4 font-mono text-primary text-xs">var\d+</td>
                    <td className="py-3 px-4">2 segments (Label:QID)</td>
                    <td className="py-3 px-4 font-medium text-white">SA</td>
                  </tr>
                  <tr className="border-b border-border-dark/50">
                    <td className="py-3 px-4 font-mono text-primary text-xs">var\d+O\d+</td>
                    <td className="py-3 px-4">1–2 segments</td>
                    <td className="py-3 px-4 font-medium text-white">MA</td>
                  </tr>
                  <tr className="border-b border-border-dark/50">
                    <td className="py-3 px-4 font-mono text-primary text-xs">var\d+O\d+</td>
                    <td className="py-3 px-4">[RANK] trong label</td>
                    <td className="py-3 px-4 font-medium text-white">Rank</td>
                  </tr>
                  <tr className="border-b border-border-dark/50">
                    <td className="py-3 px-4 font-mono text-primary text-xs">var\d+O\d+</td>
                    <td className="py-3 px-4">[SUM] trong label</td>
                    <td className="py-3 px-4 font-medium text-white">Sum</td>
                  </tr>
                  <tr className="border-b border-border-dark/50">
                    <td className="py-3 px-4 font-mono text-primary text-xs">var\d+O\d+</td>
                    <td className="py-3 px-4">3 segments (Label:Subgroup:QID)</td>
                    <td className="py-3 px-4 font-medium text-white">MA_Grid</td>
                  </tr>
                  <tr className="border-b border-border-dark/50">
                    <td className="py-3 px-4 font-mono text-primary text-xs">var\d+O\d+Othr, _O, _OTHER</td>
                    <td className="py-3 px-4">—</td>
                    <td className="py-3 px-4 font-medium text-white">Other Specify (text companion)</td>
                  </tr>
                </tbody>
              </table>

              <h2 className="text-xl font-semibold text-gray-200 mt-8 mb-3">1.3. Sheet 2 — Value Labels (tùy chọn)</h2>
              <p className="text-gray-400 leading-relaxed mb-3">
                Nếu có Sheet 2, parser đọc từ hàng thứ 3 (index 2). Cột 1 = Variable, Cột 2 = Code, Cột 3 = Label.
              </p>
              <table className="w-full text-sm border-collapse mb-6 rounded-lg overflow-hidden border border-border-dark">
                <thead>
                  <tr className="bg-surface-dark">
                    <th className="text-left py-3 px-4 text-gray-300 font-semibold">Variable</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-semibold">Code</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-semibold">Label</th>
                  </tr>
                </thead>
                <tbody className="text-gray-400">
                  <tr className="border-b border-border-dark/50">
                    <td className="py-3 px-4 font-mono text-primary text-xs">var123</td>
                    <td className="py-3 px-4">1</td>
                    <td className="py-3 px-4">Rất hài lòng</td>
                  </tr>
                  <tr className="border-b border-border-dark/50">
                    <td className="py-3 px-4 font-mono text-primary text-xs">var123</td>
                    <td className="py-3 px-4">2</td>
                    <td className="py-3 px-4">Hài lòng</td>
                  </tr>
                </tbody>
              </table>

              <h2 className="text-xl font-semibold text-gray-200 mt-8 mb-3">1.4. Ví dụ cụ thể: SA vs MA_Grid</h2>
              <ul className="list-disc list-inside text-gray-400 space-y-2 mb-4">
                <li><strong className="text-white">SA (Single Answer):</strong> Một biến <code className="px-1 py-0.5 rounded bg-surface-dark text-primary">var123</code>, nhãn dạng <code className="px-1 py-0.5 rounded bg-surface-dark text-primary">Mức độ hài lòng:Q7</code>.</li>
                <li><strong className="text-white">MA (Multiple Answer):</strong> Nhiều biến <code className="px-1 py-0.5 rounded bg-surface-dark text-primary">var456O1</code>, <code className="px-1 py-0.5 rounded bg-surface-dark text-primary">var456O2</code>, … nhãn <code className="px-1 py-0.5 rounded bg-surface-dark text-primary">Đáp án A:Q8</code>, <code className="px-1 py-0.5 rounded bg-surface-dark text-primary">Đáp án B:Q8</code>.</li>
                <li><strong className="text-white">MA_Grid:</strong> Biến <code className="px-1 py-0.5 rounded bg-surface-dark text-primary">var789O1</code>, nhãn dạng <code className="px-1 py-0.5 rounded bg-surface-dark text-primary">Mức độ hài lòng:1:Q9</code> (Label:Subgroup:QID). Subgroup = cột, Row = nhãn hàng.</li>
              </ul>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 mb-6 flex gap-3">
                <AlertTriangle className="size-5 shrink-0 text-amber-500" />
                <div>
                  <p className="text-amber-200 font-semibold mb-1">Lưu ý</p>
                  <p className="text-gray-400 text-sm">Biến Other Specify có hậu tố <code className="px-1 py-0.5 rounded bg-surface-dark text-primary">Othr</code>, <code className="px-1 py-0.5 rounded bg-surface-dark text-primary">_O</code>, <code className="px-1 py-0.5 rounded bg-surface-dark text-primary">_OTHER</code> hoặc <code className="px-1 py-0.5 rounded bg-surface-dark text-primary">_TEXT</code>. Parser ghép với base variable để tạo option có codeType &quot;Other&quot;.</p>
                </div>
              </div>
            </section>

            {/* SECTION 2: Từ điển Cú pháp QC */}
            <section id="section-2" className="scroll-mt-24 mt-16">
              <h1 className="text-3xl font-display font-bold text-white mb-4">2. Từ điển Cú pháp QC (Syntax Output Dictionary)</h1>
              <p className="text-gray-400 leading-relaxed mb-6">
                Với mỗi loại câu hỏi, engine sinh ra cú pháp SPSS khi <strong className="text-white">không có Edge</strong> kết nối (fallback/standalone). Dưới đây là output chính xác cho từng loại.
              </p>

              {/* SA */}
              <div className="rounded-lg border border-border-dark bg-surface-dark/50 p-5 mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">SA (Single Answer)</h3>
                <p className="text-gray-400 text-sm mb-3"><strong>Mô tả:</strong> Câu hỏi đơn lựa chọn.</p>
                <p className="text-gray-400 text-sm mb-3"><strong>Khai báo trên Tool:</strong> Node type = question, questionType = SA.</p>
                <p className="text-gray-400 text-sm mb-2"><strong>Output SPSS (fallback):</strong></p>
                <pre className="p-4 rounded-lg bg-black/40 border border-border-dark text-sm text-gray-300 overflow-x-auto">
                  <code>{`if mis(Q7) check_mis_Q7 = 1.`}</code>
                </pre>
              </div>

              {/* MA */}
              <div className="rounded-lg border border-border-dark bg-surface-dark/50 p-5 mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">MA (Multiple Answer)</h3>
                <p className="text-gray-400 text-sm mb-3"><strong>Mô tả:</strong> Câu hỏi đa lựa chọn.</p>
                <p className="text-gray-400 text-sm mb-3"><strong>Khai báo trên Tool:</strong> Node type = question, questionType = MA.</p>
                <p className="text-gray-400 text-sm mb-2"><strong>Output SPSS (fallback):</strong></p>
                <pre className="p-4 rounded-lg bg-black/40 border border-border-dark text-sm text-gray-300 overflow-x-auto">
                  <code>{`count count_Q8 = Q8R1 to Q8R5 (1 thru 5).
if count_Q8 = 0 check_mis_Q8 = 1.`}</code>
                </pre>
              </div>

              {/* Sum */}
              <div className="rounded-lg border border-border-dark bg-surface-dark/50 p-5 mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">Sum (Phân bổ 100%)</h3>
                <p className="text-gray-400 text-sm mb-3"><strong>Mô tả:</strong> Câu hỏi phân bổ tổng = 100.</p>
                <p className="text-gray-400 text-sm mb-3"><strong>Khai báo trên Tool:</strong> Node type = question, questionType = Sum.</p>
                <p className="text-gray-400 text-sm mb-2"><strong>Output SPSS (fallback):</strong></p>
                <pre className="p-4 rounded-lg bg-black/40 border border-border-dark text-sm text-gray-300 overflow-x-auto">
                  <code>{`if nvalid(Q10_1 to Q10_5) <> 5 check_mis_Q10 = 1.
if sum(Q10_1 to Q10_5) <> 100 check_sum_Q10 = 1.`}</code>
                </pre>
              </div>

              {/* SA_Grid */}
              <div className="rounded-lg border border-border-dark bg-surface-dark/50 p-5 mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">SA_Grid</h3>
                <p className="text-gray-400 text-sm mb-3"><strong>Mô tả:</strong> Bảng ma trận cột đơn lựa chọn.</p>
                <p className="text-gray-400 text-sm mb-3"><strong>Khai báo trên Tool:</strong> Node type = question, questionType = SA_Grid.</p>
                <p className="text-gray-400 text-sm mb-2"><strong>Output SPSS (fallback):</strong></p>
                <pre className="p-4 rounded-lg bg-black/40 border border-border-dark text-sm text-gray-300 overflow-x-auto">
                  <code>{`if nvalid(Q10_1 to Q10_5) <> 5 check_mis_Q10 = 1.`}</code>
                </pre>
              </div>

              {/* MA_Grid */}
              <div className="rounded-lg border border-border-dark bg-surface-dark/50 p-5 mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">MA_Grid</h3>
                <p className="text-gray-400 text-sm mb-3"><strong>Mô tả:</strong> Bảng ma trận cột đa lựa chọn.</p>
                <p className="text-gray-400 text-sm mb-3"><strong>Khai báo trên Tool:</strong> Node type = question, questionType = MA_Grid.</p>
                <p className="text-gray-400 text-sm mb-2"><strong>Output SPSS (fallback):</strong></p>
                <pre className="p-4 rounded-lg bg-black/40 border border-border-dark text-sm text-gray-300 overflow-x-auto">
                  <code>{`count count_Q8_1 = Q8_1R1 to Q8_1R11 (1 thru 11).
count count_Q8_2 = Q8_2R1 to Q8_2R11 (1 thru 11).
if count_Q8_1 = 0 check_mis_Q8_1 = 1.
if count_Q8_2 = 0 check_mis_Q8_2 = 1.`}</code>
                </pre>
              </div>

              {/* Rank */}
              <div className="rounded-lg border border-border-dark bg-surface-dark/50 p-5 mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">Rank (Rank_Fixed / Rank_Upto)</h3>
                <p className="text-gray-400 text-sm mb-3"><strong>Mô tả:</strong> Câu hỏi xếp hạng.</p>
                <p className="text-gray-400 text-sm mb-3"><strong>Khai báo trên Tool:</strong> Node type = question, questionType = Rank_Fixed hoặc Rank_Upto, limit = số hạng.</p>
                <p className="text-gray-400 text-sm mb-2"><strong>Output SPSS (fallback):</strong></p>
                <pre className="p-4 rounded-lg bg-black/40 border border-border-dark text-sm text-gray-300 overflow-x-auto">
                  <code>{`count count_Q9_rank1 = Q9_1 to Q9_5 (1).
count count_Q9_rank2 = Q9_1 to Q9_5 (2).
if count_Q9_rank1 <> 1 check_Q9_rank1 = 1.
if count_Q9_rank2 <> 1 check_Q9_rank2 = 1.`}</code>
                </pre>
              </div>

              {/* OE */}
              <div className="rounded-lg border border-border-dark bg-surface-dark/50 p-5 mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">OE (Open-Ended)</h3>
                <p className="text-gray-400 text-sm mb-3"><strong>Mô tả:</strong> Câu hỏi mở, nhập text.</p>
                <p className="text-gray-400 text-sm mb-3"><strong>Khai báo trên Tool:</strong> Node type = question, questionType = OE.</p>
                <p className="text-gray-400 text-sm mb-2"><strong>Output SPSS (fallback):</strong></p>
                <pre className="p-4 rounded-lg bg-black/40 border border-border-dark text-sm text-gray-300 overflow-x-auto">
                  <code>{`if Q11 = "" check_mis_Q11 = 1.`}</code>
                </pre>
              </div>
            </section>

            {/* SECTION 3: Logic & Routing Masterclass */}
            <section id="section-3" className="scroll-mt-24 mt-16">
              <h1 className="text-3xl font-display font-bold text-white mb-4">3. Thiết lập Logic & Routing (Logic & Routing Masterclass)</h1>

              <h2 className="text-xl font-semibold text-gray-200 mt-8 mb-3">3.1. F0 (Luồng mặc định)</h2>
              <p className="text-gray-400 leading-relaxed mb-3">
                F0 là edge kết nối <strong className="text-white">Parent Node → Parent Node</strong> (Câu hỏi → Câu hỏi tiếp theo). Cách dùng: kéo từ handle của câu hỏi A sang câu hỏi B.
              </p>
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 mb-6 flex gap-3">
                <Info className="size-5 shrink-0 text-blue-400" />
                <div>
                  <p className="text-blue-200 font-semibold mb-1">Quan trọng</p>
                  <p className="text-gray-400 text-sm">F0 <strong className="text-white">không sinh ra code QC</strong>. Chỉ dùng để sắp xếp luồng hiển thị trên Canvas.</p>
                </div>
              </div>

              <h2 className="text-xl font-semibold text-gray-200 mt-8 mb-3">3.2. Piping (Dẫn hướng dữ liệu)</h2>
              <p className="text-gray-400 leading-relaxed mb-3">
                <strong className="text-white">Cách làm:</strong> Kéo từ Option Node (ví dụ <code className="px-1 py-0.5 rounded bg-surface-dark text-primary">Q7_1R1</code>) sang Target Question Node (ví dụ <code className="px-1 py-0.5 rounded bg-surface-dark text-primary">Q8</code>). Không kéo từ Parent Node.
              </p>
              <p className="text-gray-400 leading-relaxed mb-3">
                Engine sinh hai nhóm kiểm tra, gọi là <strong className="text-white">Forward</strong> và <strong className="text-white">Backward</strong> trong ngữ cảnh DP (Data Processing):
              </p>
              <ul className="list-disc list-inside text-gray-400 space-y-2 mb-4">
                <li><strong className="text-white">Forward:</strong> Đáp viên chọn nguồn (Q7R1) nhưng không trả lời đích (Q8) → lỗi.</li>
                <li><strong className="text-white">Backward:</strong> Đáp viên trả lời đích (Q8) nhưng nguồn (Q7R1) thiếu → lỗi.</li>
              </ul>
              <p className="text-gray-400 leading-relaxed mb-2">
                <strong>Output SPSS (MA piping):</strong>
              </p>
              <pre className="p-4 rounded-lg bg-black/40 border border-border-dark text-sm text-gray-300 overflow-x-auto mb-4">
                <code>{`* Forward: nguồn chọn, đích trống
if Q7R1 = 1 and count_Q8 = 0 check_Q7_Q8_code1 = 1.

* Backward: đích có, nguồn thiếu
if count_Q8 > 0 and mis(Q7R1) check_Q8_Q7_code1 = 1.`}</code>
              </pre>
              <p className="text-gray-400 leading-relaxed mb-4">
                Với MA_Grid piping (Q7R1 → Q8), mỗi cột Q8 có cặp Forward/Backward tương ứng.
              </p>

              <h2 className="text-xl font-semibold text-gray-200 mt-8 mb-3">3.3. Exclusive Options (Logic loại trừ)</h2>
              <p className="text-gray-400 leading-relaxed mb-3">
                Option có <code className="px-1 py-0.5 rounded bg-surface-dark text-primary">codeType: &quot;Exclusive&quot;</code> (ví dụ &quot;Không có / None of the above&quot;, code 99). Nếu đáp viên chọn option này và đồng thời chọn thêm option khác → lỗi.
              </p>
              <pre className="p-4 rounded-lg bg-black/40 border border-border-dark text-sm text-gray-300 overflow-x-auto mb-4">
                <code>{`if Q7R99 = 99 and count_Q7 > 1 check_Q7R99_excl = 1.`}</code>
              </pre>

              <h2 className="text-xl font-semibold text-gray-200 mt-8 mb-3">3.4. Other Specify (Khác, ghi rõ)</h2>
              <p className="text-gray-400 leading-relaxed mb-3">
                Tool đọc hậu tố <code className="px-1 py-0.5 rounded bg-surface-dark text-primary">_O</code> trên biến text companion (ví dụ <code className="px-1 py-0.5 rounded bg-surface-dark text-primary">Q8_1R99_O</code>). Nếu đáp viên chọn option Khác nhưng ô text trống → lỗi.
              </p>
              <pre className="p-4 rounded-lg bg-black/40 border border-border-dark text-sm text-gray-300 overflow-x-auto mb-4">
                <code>{`if Q8_1R99 = 99 and Q8_1R99_O = "" check_Q8_1R99_O = 1.`}</code>
              </pre>
            </section>

            {/* SECTION 4: Đồng bộ Giao diện & Dữ liệu */}
            <section id="section-4" className="scroll-mt-24 mt-16">
              <h1 className="text-3xl font-display font-bold text-white mb-4">4. Đồng bộ Giao diện & Dữ liệu (Bi-directional Sync)</h1>
              <p className="text-gray-400 leading-relaxed mb-6">
                Tính năng đồng bộ hai chiều ngăn <strong className="text-white">orphan syntax</strong> — cú pháp tham chiếu đến cột/biến đã bị xóa.
              </p>

              <h2 className="text-xl font-semibold text-gray-200 mt-8 mb-3">4.1. Xóa Column trong Node Editor</h2>
              <ol className="list-decimal list-inside text-gray-400 space-y-2 mb-4">
                <li>Double-click vào Question Node.</li>
                <li>Trong Properties, mở tab Columns (hoặc Rows cho MA_Grid).</li>
                <li>Bấm Delete / Xóa cho cột cần loại bỏ.</li>
                <li><code className="px-1 py-0.5 rounded bg-surface-dark text-primary">updateField</code> gọi <code className="px-1 py-0.5 rounded bg-surface-dark text-primary">columns.splice(index, 1)</code>.</li>
                <li><code className="px-1 py-0.5 rounded bg-surface-dark text-primary">logicModelConverter</code> khi build lại graph chỉ tạo Piping edges cho các cột còn trong <code className="px-1 py-0.5 rounded bg-surface-dark text-primary">targetQuestion.columns</code>.</li>
                <li>Edge Piping tương ứng với cột đó <strong className="text-white">tự động biến mất</strong> khỏi Canvas.</li>
              </ol>

              <h2 className="text-xl font-semibold text-gray-200 mt-8 mb-3">4.2. Xóa Edge trên Canvas</h2>
              <ol className="list-decimal list-inside text-gray-400 space-y-2 mb-4">
                <li>Chọn Edge (Piping hoặc Ask If) trên Canvas.</li>
                <li>Bấm Delete / Backspace.</li>
                <li><code className="px-1 py-0.5 rounded bg-surface-dark text-primary">handleEdgesDelete</code> gọi <code className="px-1 py-0.5 rounded bg-surface-dark text-primary">updateQuestion</code>.</li>
                <li>Với <strong className="text-white">PIPING:</strong> code đáp án (ví dụ &quot;3&quot; từ Q7R3) được thêm vào <code className="px-1 py-0.5 rounded bg-surface-dark text-primary">piping_excluded_codes</code> của câu hỏi đích.</li>
                <li>Với <strong className="text-white">ASK_IF:</strong> <code className="px-1 py-0.5 rounded bg-surface-dark text-primary">piping_source</code> và <code className="px-1 py-0.5 rounded bg-surface-dark text-primary">ask_if_condition</code> đặt về null.</li>
                <li>Chỉ <strong className="text-white">dây đó</strong> bị loại; các dây anh em (Q7R1→Q8, Q7R2→Q8) giữ nguyên (1-to-1 binding).</li>
              </ol>

              <div className="rounded-lg border border-border-dark bg-surface-dark/50 p-4 mb-6">
                <p className="text-gray-300 text-sm font-medium mb-2">Data model</p>
                <p className="text-gray-400 text-sm"><code className="px-1 py-0.5 rounded bg-surface-dark text-primary">QuestionLogic.piping_excluded_codes?: (string | number)[]</code> — danh sách code bị loại khỏi piping cho câu hỏi đích.</p>
              </div>
            </section>

            {/* Xuất bản */}
            <section id="xuat-ban" className="scroll-mt-24 mt-16">
              <h1 className="text-3xl font-display font-bold text-white mb-4">Xuất bản & tích hợp</h1>
              <h2 className="text-xl font-semibold text-gray-200 mt-8 mb-3">Xem trước</h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                Trên Canvas QC Logic, bấm &quot;Show QC Logic&quot; để mở panel xem trước. Khối cú pháp cập nhật real-time khi bạn thêm/xóa/sửa Edge hoặc Node.
              </p>
              <h2 className="text-xl font-semibold text-gray-200 mt-8 mb-3">Xuất file .sps</h2>
              <p className="text-gray-400 leading-relaxed mb-6">
                Bấm &quot;Export&quot; để tải file <code className="px-1.5 py-0.5 rounded bg-surface-dark text-primary text-sm">.sps</code> với mã hóa UTF-8. Tên file mặc định: <code className="px-1 py-0.5 rounded bg-surface-dark text-primary text-sm">qc_logic_syntax_YYYY-MM-DD.sps</code>.
              </p>
            </section>
          </div>
        </main>
      </div>

      <footer className="border-t border-border-dark mt-16 py-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">Vào Workspace → QC Logic để bắt đầu xây dựng đồ thị.</p>
          <Link href="/qc-logic" className="flex items-center gap-2 rounded-lg bg-primary hover:bg-primary-hover text-white px-5 py-2.5 text-sm font-bold transition-colors">
            Mở Canvas QC Logic
            <ChevronRight className="size-4" />
          </Link>
        </div>
      </footer>
    </div>
  )
}
