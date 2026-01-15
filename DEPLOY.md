# 🚀 Hướng Dẫn Deploy IFM Syntax Pro - Miễn Phí & Nhanh Chóng

## 📋 Yêu Cầu Trước Khi Deploy

1. **API Key Gemini**: Lấy từ [Google AI Studio](https://makersuite.google.com/app/apikey)
2. **Git Repository**: Push code lên GitHub/GitLab/Bitbucket
3. **Tài khoản hosting**: Chọn một trong các options bên dưới

---

## 🎯 Các Phương Án Deploy Miễn Phí (Khuyến Nghị)

### 1. ⭐ **Vercel** (Khuyến Nghị Nhất - Tốt Nhất Cho Next.js)

**Ưu điểm:**
- ✅ Hoàn toàn miễn phí cho personal projects
- ✅ Tích hợp sẵn với Next.js (zero config)
- ✅ Auto-deploy từ GitHub
- ✅ SSL tự động, CDN global
- ✅ Preview deployments cho mỗi PR
- ✅ Serverless functions (API routes)
- ✅ Bandwidth: 100GB/tháng miễn phí

**Cách Deploy:**

1. **Cài đặt Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Login và Deploy:**
   ```bash
   vercel login
   vercel
   ```

3. **Hoặc Deploy qua Web UI:**
   - Truy cập [vercel.com](https://vercel.com)
   - Đăng nhập bằng GitHub
   - Click "Add New Project"
   - Import repository
   - Thêm Environment Variable: `GEMINI_API_KEY`
   - Click "Deploy"

4. **Cấu hình Environment Variables:**
   - Vào Project Settings → Environment Variables
   - Thêm: `GEMINI_API_KEY` = `your_api_key_here`
   - Chọn môi trường: Production, Preview, Development

**Giới hạn miễn phí:**
- 100GB bandwidth/tháng
- Unlimited requests
- 100GB-hours serverless function execution

---

### 2. **Netlify**

**Ưu điểm:**
- ✅ Miễn phí cho personal projects
- ✅ Auto-deploy từ Git
- ✅ SSL tự động
- ✅ Form handling, Functions
- ✅ Bandwidth: 100GB/tháng

**Cách Deploy:**

1. **Cài đặt Netlify CLI:**
   ```bash
   npm i -g netlify-cli
   ```

2. **Tạo file `netlify.toml` trong root:**
   ```toml
   [build]
     command = "npm run build"
     publish = ".next"
   
   [[plugins]]
     package = "@netlify/plugin-nextjs"
   ```

3. **Deploy:**
   ```bash
   netlify login
   netlify deploy --prod
   ```

4. **Hoặc qua Web UI:**
   - Truy cập [netlify.com](https://netlify.com)
   - "Add new site" → "Import from Git"
   - Chọn repository
   - Build command: `npm run build`
   - Publish directory: `.next`
   - Thêm Environment Variable: `GEMINI_API_KEY`

---

### 3. **Railway**

**Ưu điểm:**
- ✅ Free tier: $5 credit/tháng (đủ cho small apps)
- ✅ Auto-deploy từ Git
- ✅ Database support
- ✅ Dễ dàng scale

**Cách Deploy:**

1. Truy cập [railway.app](https://railway.app)
2. Login bằng GitHub
3. "New Project" → "Deploy from GitHub repo"
4. Chọn repository
5. Railway tự detect Next.js và build
6. Thêm Environment Variable: `GEMINI_API_KEY`

**Lưu ý:** Free tier có giới hạn, nhưng đủ cho development/testing

---

### 4. **Render**

**Ưu điểm:**
- ✅ Free tier cho static sites
- ✅ Auto-deploy từ Git
- ✅ SSL tự động
- ✅ Web service free tier (có giới hạn)

**Cách Deploy:**

1. Truy cập [render.com](https://render.com)
2. "New" → "Web Service"
3. Connect GitHub repository
4. Build command: `npm run build`
5. Start command: `npm start`
6. Thêm Environment Variable: `GEMINI_API_KEY`

**Lưu ý:** Free tier có thể sleep sau 15 phút không dùng

---

### 5. **Cloudflare Pages**

**Ưu điểm:**
- ✅ Hoàn toàn miễn phí
- ✅ Unlimited bandwidth
- ✅ CDN global
- ✅ Fast build times

**Cách Deploy:**

1. Truy cập [pages.cloudflare.com](https://pages.cloudflare.com)
2. "Create a project" → "Connect to Git"
3. Chọn repository
4. Build command: `npm run build`
5. Build output directory: `.next`
6. Thêm Environment Variable: `GEMINI_API_KEY`

**Lưu ý:** Cần cấu hình Functions cho API routes

---

## 🔧 Cấu Hình Local Development

1. **Copy file `.env.example` thành `.env`:**
   ```bash
   cp .env.example .env
   ```

2. **Thêm API key vào `.env`:**
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```

3. **Chạy development server:**
   ```bash
   npm install
   npm run dev
   ```

---

## 📝 Checklist Trước Khi Deploy

- [ ] Đã thêm `GEMINI_API_KEY` vào environment variables
- [ ] Đã test build local: `npm run build`
- [ ] Đã test production: `npm start`
- [ ] Đã commit và push code lên Git
- [ ] Đã kiểm tra `.gitignore` không commit `.env`

---

## 🎯 Khuyến Nghị

**Cho Next.js apps, Vercel là lựa chọn tốt nhất:**
- Tích hợp native với Next.js
- Zero configuration
- Performance tốt nhất
- Developer experience tuyệt vời
- Miễn phí hoàn toàn cho personal projects

---

## 🆘 Troubleshooting

### Lỗi "GEMINI_API_KEY is not set"
- Kiểm tra đã thêm environment variable chưa
- Đảm bảo tên biến đúng: `GEMINI_API_KEY`
- Restart deployment sau khi thêm env var

### Build failed
- Kiểm tra `package.json` có đầy đủ dependencies
- Chạy `npm install` local để test
- Xem build logs trên hosting platform

### API không hoạt động
- Kiểm tra API key có hợp lệ không
- Kiểm tra rate limits của Gemini API
- Xem server logs trên hosting platform

---

## 📚 Tài Liệu Tham Khảo

- [Vercel Next.js Docs](https://vercel.com/docs/frameworks/nextjs)
- [Netlify Next.js Docs](https://docs.netlify.com/integrations/frameworks/nextjs/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Gemini API Docs](https://ai.google.dev/docs)
