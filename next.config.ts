import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 외부 이미지 도메인 허용 설정
  images: {
    domains: ["firebasestorage.googleapis.com"], // Firebase 이미지 허용
  },
};

export default nextConfig;
