# ConvertAPI Setup Guide

## Bước 1: Lấy API Key

1. Đăng ký tài khoản miễn phí tại: https://www.convertapi.com/
2. Vào Dashboard → API Keys
3. Copy Secret Key của bạn

## Bước 2: Tạo file .env.local

Tạo file `.env.local` trong thư mục gốc của project với nội dung:

```
CONVERTAPI_SECRET=your_secret_key_here
```

Thay `your_secret_key_here` bằng Secret Key bạn đã copy.

## Bước 3: Restart Dev Server

Sau khi tạo file `.env.local`, restart dev server:

```bash
npm run dev
```

## Lưu ý

- File `.env.local` đã được thêm vào `.gitignore`, không commit lên git
- ConvertAPI có free tier với giới hạn số lượng conversions
- Để production, bạn cần thêm `CONVERTAPI_SECRET` vào environment variables của hosting (Vercel, etc.)
