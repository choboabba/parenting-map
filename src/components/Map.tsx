"use client";

import { useEffect, useRef } from "react";
import { Place, MapBounds } from "@/lib/firestore";

interface MapProps {
  places: Place[];
  onMarkerClick: (place: Place) => void;
  onBoundsChange: (bounds: MapBounds) => void;
  userLocation: { lat: number; lng: number } | null;
}

declare global {
  interface Window { naver: any; }
}

export default function Map(props: MapProps) {
  // 구조분해 대신 props로 받기 (undefined 방지)
  const places         = props.places         ?? [];
  const onMarkerClick  = props.onMarkerClick;
  const onBoundsChange = props.onBoundsChange;
  const userLocation   = props.userLocation;

  const mapRef         = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef     = useRef<any[]>([]);
  const userMarkerRef  = useRef<any>(null);
  const boundsTimerRef = useRef<any>(null);
  const isReadyRef     = useRef(false); // 지도 준비 여부

  // =====================
  // 지도 초기화 (최초 1회)
  // =====================
  useEffect(() => {
    if (!mapRef.current) return;
    if (typeof window === "undefined" || !window.naver) return;

    const map = new window.naver.maps.Map(mapRef.current, {
      center: new window.naver.maps.LatLng(37.5665, 126.978),
      zoom: 13,
      zoomControl: false,
    });

    mapInstanceRef.current = map;
    isReadyRef.current = true;

    // 지도 이동/줌 끝날 때 bounds 전달
    window.naver.maps.Event.addListener(map, "idle", () => {
      if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
      boundsTimerRef.current = setTimeout(() => {
        sendBounds(map);
      }, 500);
    });

    // 초기 bounds 전달
    setTimeout(() => sendBounds(map), 800);

    return () => {
      if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
    };
  }, []);

  // =====================
  // 현재 지도 영역 전달
  // =====================
  const sendBounds = (map: any) => {
    if (!map || !onBoundsChange) return;
    try {
      const bounds = map.getBounds();
      const sw = bounds.getSW();
      const ne = bounds.getNE();
      onBoundsChange({
        minLat: sw.lat(),
        maxLat: ne.lat(),
        minLng: sw.lng(),
        maxLng: ne.lng(),
      });
    } catch (e) {
      console.error("bounds 오류:", e);
    }
  };

  // =====================
  // 내 위치 마커
  // =====================
  useEffect(() => {
    if (!mapInstanceRef.current || !userLocation) return;
    if (!isReadyRef.current) return;

    try {
      if (userMarkerRef.current) userMarkerRef.current.setMap(null);

      userMarkerRef.current = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(
          userLocation.lat, userLocation.lng
        ),
        map: mapInstanceRef.current,
        icon: {
          content: `
            <div style="position:relative;width:20px;height:20px;">
              <div style="
                position:absolute;top:-10px;left:-10px;
                width:40px;height:40px;
                background:rgba(255,107,53,0.2);
                border-radius:50%;
              "></div>
              <div style="
                width:20px;height:20px;
                background:#FF6B35;
                border:3px solid white;
                border-radius:50%;
                box-shadow:0 2px 8px rgba(255,107,53,0.5);
              "></div>
            </div>
          `,
          anchor: new window.naver.maps.Point(10, 10),
        },
      });

      mapInstanceRef.current.setCenter(
        new window.naver.maps.LatLng(userLocation.lat, userLocation.lng)
      );
      mapInstanceRef.current.setZoom(14);

      // 위치 이동 후 bounds 전달
      setTimeout(() => sendBounds(mapInstanceRef.current), 600);

    } catch (e) {
      console.error("내 위치 마커 오류:", e);
    }
  }, [userLocation]);

  // =====================
  // 장소 마커 렌더링
  // places 변경될 때마다 실행
  // =====================
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (!isReadyRef.current) return;
    if (!Array.isArray(places)) return;

    try {
      // 기존 마커 전체 제거
      markersRef.current.forEach((m) => {
        try { m.setMap(null); } catch {}
      });
      markersRef.current = [];

      // 새 마커 생성
      places.forEach((place) => {
        if (!place?.lat || !place?.lng) return;

        const isHighlight = place.kidsZone && place.nursingRoom;
        const color = isHighlight ? "#FFD93D" : "#FF6B35";

        const marker = new window.naver.maps.Marker({
          position: new window.naver.maps.LatLng(place.lat, place.lng),
          map: mapInstanceRef.current,
          icon: {
            content: `
              <div style="
                position:relative;
                width:28px;height:36px;
                cursor:pointer;
              ">
                <svg width="28" height="36" viewBox="0 0 28 36"
                  xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 0C6.27 0 0 6.27 0 14
                    C0 24.5 14 36 14 36
                    C14 36 28 24.5 28 14
                    C28 6.27 21.73 0 14 0Z"
                    fill="${color}"/>
                  <circle cx="14" cy="14" r="7" fill="white"/>
                </svg>
              </div>
            `,
            anchor: new window.naver.maps.Point(14, 36),
          },
        });

        window.naver.maps.Event.addListener(marker, "click", () => {
          onMarkerClick(place);
        });

        markersRef.current.push(marker);
      });

    } catch (e) {
      console.error("마커 렌더링 오류:", e);
    }
  }, [places]);

  return (
    <div
      ref={mapRef}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
