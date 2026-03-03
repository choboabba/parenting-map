"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import Map from "@/components/Map";
import { Place, MapBounds, getPlacesByBounds, searchPlaces } from "@/lib/firestore";

const FACILITIES = [
  { key: "nursingRoom",    label: "수유실",    emoji: "🍼" },
  { key: "familyRestroom", label: "가족화장실", emoji: "🚻" },
  { key: "freeParking",    label: "무료주차",   emoji: "🅿️" },
  { key: "strollerRental", label: "유모차대여", emoji: "🛒" },
  { key: "kidsZone",       label: "키즈존",    emoji: "🧸" },
];

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function FacilityIcon({ label, emoji, available }: {
  label: string; emoji: string; available: boolean;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        width: "44px", height: "44px", borderRadius: "12px",
        background: available ? "#6BCB77" : "#E0E0E0",
        display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: "20px",
        margin: "0 auto 4px",
      }}>{emoji}</div>
      <span style={{ fontSize: "11px", color: available ? "#2C3E50" : "#aaa" }}>
        {label}
      </span>
    </div>
  );
}

export default function Home() {
  const [places, setPlaces]               = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [userLocation, setUserLocation]   = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery]     = useState("");
  const [activeTab, setActiveTab]         = useState<"explore" | "saved" | "profile">("explore");
  const [isLoading, setIsLoading]         = useState(false);
  const [currentBounds, setCurrentBounds] = useState<MapBounds | null>(null);
  const [facilityFilters, setFacilityFilters] = useState<{ [key: string]: boolean }>({
    nursingRoom: false, familyRestroom: false,
    freeParking: false, strollerRental: false, kidsZone: false,
  });

  // =====================
  // 항상 최신 값 유지하는 Ref
  // 클로저 문제 해결 핵심!
  // =====================
  const facilityFiltersRef = useRef(facilityFilters);
  const searchQueryRef     = useRef(searchQuery);
  const currentBoundsRef   = useRef(currentBounds);

  // Ref 항상 최신 상태로 동기화
  useEffect(() => {
    facilityFiltersRef.current = facilityFilters;
  }, [facilityFilters]);

  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    currentBoundsRef.current = currentBounds;
  }, [currentBounds]);

  // =====================
  // 앱 시작 시 내 위치 가져오기
  // =====================
  useEffect(() => {
    getUserLocation();
  }, []);

  // =====================
  // 거리 계산 캐싱
  // =====================
  const distanceMap = useMemo(() => {
    if (!userLocation || !places || !Array.isArray(places)) {
      return {} as Record<string, number>;
    }
    const distMap: Record<string, number> = {};
    places.forEach((p) => {
      if (p?.id) {
        distMap[p.id] = getDistance(
          userLocation.lat, userLocation.lng, p.lat, p.lng
        );
      }
    });
    return distMap;
  }, [places, userLocation]);

  // =====================
  // 거리 텍스트
  // =====================
  const getDistanceText = useCallback((place: Place) => {
    if (!userLocation || !place?.id) return "";
    const d = distanceMap[place.id] ?? 0;
    return d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`;
  }, [distanceMap, userLocation]);

  // =====================
  // 데이터 로드 공통 함수
  // Ref 사용 → 항상 최신 필터/검색어 반영
  // =====================
  const loadData = useCallback(async (bounds?: MapBounds) => {
    const latestFilters = facilityFiltersRef.current;
    const latestSearch  = searchQueryRef.current;
    const latestBounds  = bounds ?? currentBoundsRef.current;

    setIsLoading(true);
    try {
      if (latestSearch.trim()) {
        // 검색어 있으면 검색 쿼리
        const data = await searchPlaces(latestSearch, latestFilters);
        setPlaces(data);
      } else if (latestBounds) {
        // 검색어 없으면 bounds 쿼리
        const data = await getPlacesByBounds(latestBounds, latestFilters);
        setPlaces(data);
      }
    } finally {
      setIsLoading(false);
    }
  }, []); // 의존성 없음 → Ref로 최신값 참조

  // =====================
  // 지도 영역 변경 시
  // =====================
  const handleBoundsChange = useCallback((bounds: MapBounds) => {
    setCurrentBounds(bounds);
    currentBoundsRef.current = bounds;

    // 검색 중이면 bounds 로드 안 함
    if (searchQueryRef.current.trim()) return;

    loadData(bounds);
  }, [loadData]);

  // =====================
  // 검색어 변경 시 (500ms 디바운스)
  // =====================
  useEffect(() => {
    if (!searchQuery.trim()) {
      // 검색어 지우면 bounds 기반으로 복귀
      loadData();
      return;
    }

    const timer = setTimeout(() => {
      loadData();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // =====================
  // 필터 변경 시 즉시 재로드
  // =====================
  useEffect(() => {
    loadData();
  }, [facilityFilters]);

  // =====================
  // 내 위치 가져오기
  // =====================
  const getUserLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      }),
      () => setUserLocation({ lat: 37.5665, lng: 126.978 })
    );
  };

  // =====================
  // 시설 필터 토글
  // =====================
  const toggleFacility = (key: string) => {
    setFacilityFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const activeFilterCount = Object.values(facilityFilters).filter(Boolean).length;

  // =====================
  // 거리순 정렬
  // =====================
  const sortedPlaces = useMemo(() => {
    if (!places || !Array.isArray(places)) return [];
    if (!userLocation) return places;
    return [...places].sort((a, b) =>
      (distanceMap[a.id ?? ""] ?? 0) -
      (distanceMap[b.id ?? ""] ?? 0)
    );
  }, [places, distanceMap, userLocation]);

  return (
    <div style={{
      width: "100%",
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      background: "#FFF3E0",
      fontFamily: "'Noto Sans KR', sans-serif",
      maxWidth: "430px",
      margin: "0 auto",
      overflow: "hidden",
      position: "relative",
    }}>

      {/* ===== 탐색 탭 ===== */}
      {activeTab === "explore" && (
        <>
          {/* 상단 헤더 */}
          <div style={{
            flexShrink: 0,
            background: "#FFF3E0",
            padding: "14px 20px 0",
            zIndex: 20,
          }}>
            {/* 로고 */}
            <div style={{
              display: "flex", alignItems: "center",
              gap: "8px", marginBottom: "10px",
            }}>
              <span style={{ fontSize: "24px", fontWeight: "700", color: "#FF6B35" }}>
                육아지도
              </span>
              <span style={{ fontSize: "11px", color: "#aaa" }}>PARENTING MAP</span>
            </div>

            {/* 검색바 */}
            <div style={{
              display: "flex", alignItems: "center",
              background: "white", borderRadius: "50px",
              padding: "9px 16px",
              border: "2px solid #FF6B35",
              gap: "8px", marginBottom: "10px",
            }}>
              <span style={{ fontSize: "15px" }}>🔍</span>
              <input
                placeholder="주변 육아 장소를 찾아보세요"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1, border: "none", outline: "none",
                  fontSize: "14px", color: "#2C3E50",
                  background: "transparent",
                  fontFamily: "'Noto Sans KR', sans-serif",
                }}
              />
              {searchQuery && (
                <span
                  onClick={() => setSearchQuery("")}
                  style={{ cursor: "pointer", color: "#aaa", fontSize: "16px" }}
                >✕</span>
              )}
            </div>

            {/* 시설 필터 버튼 */}
            <div
              style={{
                display: "flex", gap: "8px",
                overflowX: "auto", paddingBottom: "10px",
              }}
              className="hide-scrollbar"
            >
              {FACILITIES.map((f) => (
                <button
                  key={
                    f.key}
                    onClick={() => toggleFacility(f.key)}
                    style={{
                      display: "flex", alignItems: "center",
                      gap: "4px", padding: "7px 12px",
                      borderRadius: "50px", border: "none",
                      background: facilityFilters[f.key] ? "#FF6B35" : "white",
                      color: facilityFilters[f.key] ? "white" : "#2C3E50",
                      fontSize: "12px", fontWeight: "700",
                      whiteSpace: "nowrap",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                      flexShrink: 0, cursor: "pointer",
                    }}
                  >
                    <span>{f.emoji}</span>
                    {f.label}
                    {facilityFilters[f.key] && <span>✕</span>}
                  </button>
                ))}
              </div>
  
              {/* 활성 필터 + 로딩 상태 */}
              <div style={{
                display: "flex", alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: "6px", minHeight: "24px",
              }}>
                {activeFilterCount > 0 && (
                  <div style={{
                    fontSize: "12px", fontWeight: "700", color: "#FF6B35",
                  }}>
                    {FACILITIES.filter(f => facilityFilters[f.key])
                      .map(f => f.label).join(" + ")} ({sortedPlaces.length}개)
                  </div>
                )}
                {isLoading && (
                  <div style={{
                    fontSize: "12px", color: "#aaa",
                    display: "flex", alignItems: "center", gap: "4px",
                  }}>
                    <span>⏳</span> 로딩 중...
                  </div>
                )}
              </div>
            </div>
  
            {/* 지도 영역 */}
            <div style={{
              flexShrink: 0,
              height: "340px",
              position: "relative",
              zIndex: 1,
            }}>
              <Map
                places={sortedPlaces}
                onMarkerClick={(place) => setSelectedPlace(place)}
                onBoundsChange={handleBoundsChange}
                userLocation={userLocation}
              />
  
              {/* 지도 위 로딩 표시 */}
              {isLoading && (
                <div style={{
                  position: "absolute",
                  top: "12px", left: "50%",
                  transform: "translateX(-50%)",
                  background: "rgba(255,255,255,0.95)",
                  padding: "8px 16px",
                  borderRadius: "20px",
                  fontSize: "12px", fontWeight: "700",
                  color: "#FF6B35", zIndex: 10,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                }}>
                  🔍 장소 검색 중...
                </div>
              )}
  
              {/* 내 위치 버튼 */}
              <button
                onClick={getUserLocation}
                style={{
                  position: "absolute", bottom: "12px", right: "12px",
                  width: "40px", height: "40px", borderRadius: "50%",
                  background: "white", border: "none",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  fontSize: "18px", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  zIndex: 5,
                }}
              >📍</button>
            </div>
  
            {/* 하단 카드 목록 */}
            <div style={{
              flex: 1, background: "#FFF3E0",
              overflowY: "auto", padding: "12px 0 8px",
            }}
              className="hide-scrollbar"
            >
              <h3 style={{
                fontSize: "14px", fontWeight: "700",
                color: "#2C3E50", padding: "0 20px", marginBottom: "10px",
              }}>
                {searchQuery
                  ? `"${searchQuery}" 검색 결과 (${sortedPlaces.length}개)`
                  : activeFilterCount > 0
                  ? `필터 결과 (${sortedPlaces.length}개)`
                  : `주변 장소 (${sortedPlaces.length}개)`}
              </h3>
  
              {/* 가로 스크롤 카드 */}
              <div
                className="hide-scrollbar"
                style={{
                  display: "flex", gap: "12px",
                  overflowX: "auto", padding: "0 20px 8px",
                }}
              >
                {sortedPlaces.length === 0 && !isLoading ? (
                  <div style={{
                    padding: "20px", color: "#aaa",
                    fontSize: "14px", textAlign: "center", width: "100%",
                  }}>
                    조건에 맞는 장소가 없어요 😢
                  </div>
                ) : (
                  sortedPlaces.slice(0, 20).map((place) => (
                    <div
                      key={place.id}
                      onClick={() => setSelectedPlace(place)}
                      style={{
                        minWidth: "140px", maxWidth: "140px",
                        background: "white", borderRadius: "14px",
                        overflow: "hidden",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                        cursor: "pointer", flexShrink: 0,
                      }}
                    >
                      <div style={{
                        width: "100%", height: "80px",
                        background: "linear-gradient(135deg, #FF6B35, #4ECDC4)",
                        display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: "28px",
                      }}>🗺️</div>
  
                      <div style={{ padding: "8px" }}>
                        <h4 style={{
                          fontSize: "12px", fontWeight: "700",
                          color: "#2C3E50", marginBottom: "4px",
                          whiteSpace: "nowrap", overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}>{place.name}</h4>
  
                        <div style={{
                          display: "flex", gap: "3px",
                          flexWrap: "wrap", marginBottom: "4px",
                        }}>
                          {place.nursingRoom && (
                            <span style={{
                              fontSize: "9px", background: "#E8F5E9",
                              color: "#6BCB77", padding: "1px 5px", borderRadius: "4px",
                            }}>수유실</span>
                          )}
                          {place.kidsZone && (
                            <span style={{
                              fontSize: "9px", background: "#E3F2FD",
                              color: "#4ECDC4", padding: "1px 5px", borderRadius: "4px",
                            }}>키즈존</span>
                          )}
                          {place.freeParking && (
                            <span style={{
                              fontSize: "9px", background: "#FFF8E1",
                              color: "#FFB300", padding: "1px 5px", borderRadius: "4px",
                            }}>무료주차</span>
                          )}
                        </div>
  
                        {userLocation && (
                          <p style={{
                            fontSize: "10px", color: "#FF6B35", fontWeight: "700",
                          }}>📍 {getDistanceText(place)}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
  
              {/* 검색/필터 결과 세로 목록 */}
              {(searchQuery || activeFilterCount > 0) && sortedPlaces.length > 0 && (
                <div style={{ padding: "12px 20px 0" }}>
                  <h3 style={{
                    fontSize: "14px", fontWeight: "700",
                    color: "#2C3E50", marginBottom: "10px",
                  }}>전체 목록</h3>
  
                  {sortedPlaces.map((place) => (
                    <div
                      key={place.id}
                      onClick={() => setSelectedPlace(place)}
                      style={{
                        display: "flex", gap: "12px",
                        background: "white", borderRadius: "14px",
                        padding: "12px", marginBottom: "8px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{
                        width: "70px", height: "70px", flexShrink: 0,
                        borderRadius: "10px",
                        background: "linear-gradient(135deg, #FF6B35, #4ECDC4)",
                        display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: "24px",
                      }}>🗺️</div>
  
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          display: "flex", justifyContent: "space-between",
                          alignItems: "flex-start", marginBottom: "4px",
                        }}>
                          <h4 style={{
                            fontSize: "13px", fontWeight: "700", color: "#2C3E50",
                            whiteSpace: "nowrap", overflow: "hidden",
                            textOverflow: "ellipsis", maxWidth: "160px",
                          }}>{place.name}</h4>
                          {userLocation && (
                            <span style={{
                              fontSize: "11px", color: "#FF6B35",
                              fontWeight: "700", flexShrink: 0,
                            }}>📍 {getDistanceText(place)}</span>
                          )}
                        </div>
  
                        <p style={{
                          fontSize: "11px", color: "#aaa", marginBottom: "6px",
                          whiteSpace: "nowrap", overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}>{place.address}</p>
  
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          {place.nursingRoom && (
                            <span style={{
                              fontSize: "10px", background: "#E8F5E9",
                              color: "#6BCB77", padding: "2px 6px", borderRadius: "4px",
                            }}>🍼 수유실</span>
                          )}
                          {place.familyRestroom && (
                            <span style={{
                              fontSize: "10px", background: "#E3F2FD",
                              color: "#4ECDC4", padding: "2px 6px", borderRadius: "4px",
                            }}>🚻 가족화장실</span>
                          )}
                          {place.freeParking && (
                            <span style={{
                              fontSize: "10px", background: "#FFF8E1",
                              color: "#FFB300", padding: "2px 6px", borderRadius: "4px",
                            }}>🅿️ 무료주차</span>
                          )}
                          {place.strollerRental && (
                            <span style={{
                              fontSize: "10px", background: "#FCE4EC",
                              color: "#E91E63", padding: "2px 6px", borderRadius: "4px",
                            }}>🛒 유모차대여</span>
                          )}
                          {place.kidsZone && (
                            <span style={{
                              fontSize: "10px", background: "#F3E5F5",
                              color: "#9C27B0", padding: "2px 6px", borderRadius: "4px",
                            }}>🧸 키즈존</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
  
        {/* ===== 저장 탭 ===== */}
        {activeTab === "saved" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
            <h2 style={{
              fontSize: "22px", fontWeight: "700",
              color: "#2C3E50", marginBottom: "20px",
            }}>내가 저장한 장소</h2>
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: "60px", marginBottom: "16px" }}>👶</div>
              <p style={{ fontSize: "15px", color: "#aaa", marginBottom: "20px" }}>
                아직 저장한 장소가 없어요
              </p>
              <button
                onClick={() => setActiveTab("explore")}
                style={{
                  padding: "14px 32px", background: "#FF6B35",
                  color: "white", border: "none", borderRadius: "12px",
                  fontSize: "15px", fontWeight: "700", cursor: "pointer",
                }}
              >장소를 탐색하러 가기</button>
            </div>
          </div>
        )}
  
        {/* ===== 프로필 탭 ===== */}
        {activeTab === "profile" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
            <h2 style={{
              fontSize: "22px", fontWeight: "700",
              color: "#2C3E50", marginBottom: "20px",
            }}>프로필</h2>
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: "60px", marginBottom: "16px" }}>👤</div>
              <p style={{ fontSize: "15px", color: "#aaa" }}>로그인이 필요해요</p>
            </div>
          </div>
        )}
  
        {/* ===== 장소 상세 모달 ===== */}
        {selectedPlace && (
          <div
            onClick={() => setSelectedPlace(null)}
            style={{
              position: "absolute", inset: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 100,
              display: "flex", alignItems: "flex-end",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%", background: "white",
                borderRadius: "24px 24px 0 0",
                maxHeight: "85vh", overflowY: "auto",
              }}
              className="hide-scrollbar"
            >
              <div style={{
                width: "40px", height: "4px", background: "#E0E0E0",
                borderRadius: "2px", margin: "12px auto 0",
              }} />
  
              <div style={{
                width: "100%", height: "200px",
                background: "linear-gradient(135deg, #FF6B35, #4ECDC4)",
                display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: "60px",
                marginTop: "12px",
              }}>🗺️</div>
  
              <div
                            style={{ padding: "20px" }}>

                            {/* 장소명 */}
                            <h2 style={{
                              fontSize: "20px", fontWeight: "700",
                              color: "#2C3E50", marginBottom: "8px",
                            }}>{selectedPlace.name}</h2>
              
                            {/* 해시태그 */}
                            <div style={{
                              display: "flex", gap: "6px",
                              flexWrap: "wrap", marginBottom: "14px",
                            }}>
                              {selectedPlace.kidsZone && (
                                <span style={{
                                  padding: "4px 10px", background: "#F3E5F5",
                                  color: "#9C27B0", borderRadius: "20px",
                                  fontSize: "12px", fontWeight: "700",
                                }}>#키즈존</span>
                              )}
                              {selectedPlace.nursingRoom && (
                                <span style={{
                                  padding: "4px 10px", background: "#E8F5E9",
                                  color: "#6BCB77", borderRadius: "20px",
                                  fontSize: "12px", fontWeight: "700",
                                }}>#수유시설</span>
                              )}
                              {selectedPlace.freeParking && (
                                <span style={{
                                  padding: "4px 10px", background: "#FFF8E1",
                                  color: "#FFB300", borderRadius: "20px",
                                  fontSize: "12px", fontWeight: "700",
                                }}>#무료주차</span>
                              )}
                              {selectedPlace.strollerRental && (
                                <span style={{
                                  padding: "4px 10px", background: "#FCE4EC",
                                  color: "#E91E63", borderRadius: "20px",
                                  fontSize: "12px", fontWeight: "700",
                                }}>#유모차대여</span>
                              )}
                              {selectedPlace.familyRestroom && (
                                <span style={{
                                  padding: "4px 10px", background: "#E3F2FD",
                                  color: "#4ECDC4", borderRadius: "20px",
                                  fontSize: "12px", fontWeight: "700",
                                }}>#가족화장실</span>
                              )}
                            </div>
              
                            {/* 주소 */}
                            <div style={{
                              display: "flex", gap: "6px",
                              alignItems: "flex-start", marginBottom: "6px",
                            }}>
                              <span>📍</span>
                              <p style={{ fontSize: "13px", color: "#666" }}>
                                {selectedPlace.address}
                              </p>
                            </div>
              
                            {/* 운영시간 */}
                            {selectedPlace.hours && (
                              <div style={{
                                display: "flex", gap: "6px",
                                alignItems: "center", marginBottom: "6px",
                              }}>
                                <span>🕐</span>
                                <p style={{ fontSize: "13px", color: "#666" }}>
                                  {selectedPlace.hours}
                                </p>
                              </div>
                            )}
              
                            {/* 휴무일 */}
                            {selectedPlace.closedDays && (
                              <div style={{
                                display: "flex", gap: "6px",
                                alignItems: "center", marginBottom: "6px",
                              }}>
                                <span>🚫</span>
                                <p style={{ fontSize: "13px", color: "#e53935" }}>
                                  휴무: {selectedPlace.closedDays}
                                </p>
                              </div>
                            )}
              
                            {/* 거리 */}
                            {userLocation && (
                              <div style={{
                                display: "flex", gap: "6px",
                                alignItems: "center", marginBottom: "16px",
                              }}>
                                <span>🗺️</span>
                                <p style={{
                                  fontSize: "13px", color: "#FF6B35", fontWeight: "700",
                                }}>
                                  내 위치에서 {getDistanceText(selectedPlace)}
                                </p>
                              </div>
                            )}
              
                            {/* 액션 버튼 4개 */}
                            <div style={{
                              display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
                              gap: "8px", marginBottom: "20px",
                            }}>
                              <a
                                href={selectedPlace.phone ? `tel:${selectedPlace.phone}` : undefined}
                                style={{ textDecoration: "none" }}
                              >
                                <div style={{
                                  background: selectedPlace.phone ? "#4ECDC4" : "#E0E0E0",
                                  borderRadius: "12px", padding: "12px 8px", textAlign: "center",
                                }}>
                                  <div style={{ fontSize: "20px", marginBottom: "4px" }}>📞</div>
                                  <p style={{
                                    fontSize: "11px", color: "white", fontWeight: "700",
                                  }}>전화하기</p>
                                </div>
                              </a>
              
                              <a
                                href={`https://map.naver.com/v5/search/${encodeURIComponent(selectedPlace.name)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ textDecoration: "none" }}
                              >
                                <div style={{
                                  background: "#4ECDC4", borderRadius: "12px",
                                  padding: "12px 8px", textAlign: "center",
                                }}>
                                  <div style={{ fontSize: "20px", marginBottom: "4px" }}>🗺️</div>
                                  <p style={{
                                    fontSize: "11px", color: "white", fontWeight: "700",
                                  }}>길찾기</p>
                                </div>
                              </a>
              
                              <div style={{
                                background: "#FF6B35", borderRadius: "12px",
                                padding: "12px 8px", textAlign: "center", cursor: "pointer",
                              }}>
                                <div style={{ fontSize: "20px", marginBottom: "4px" }}>❤️</div>
                                <p style={{
                                  fontSize: "11px", color: "white", fontWeight: "700",
                                }}>저장하기</p>
                              </div>
              
                              <div
                                onClick={() => {
                                  if (navigator.share) {
                                    navigator.share({
                                      title: selectedPlace.name,
                                      text: selectedPlace.address,
                                      url: window.location.href,
                                    });
                                  }
                                }}
                                style={{
                                  background: "#E0E0E0", borderRadius: "12px",
                                  padding: "12px 8px", textAlign: "center", cursor: "pointer",
                                }}
                              >
                                <div style={{ fontSize: "20px", marginBottom: "4px" }}>📤</div>
                                <p style={{
                                  fontSize: "11px", color: "#666", fontWeight: "700",
                                }}>공유하기</p>
                              </div>
                            </div>
              
                            {/* 시설 정보 */}
                            <div style={{ marginBottom: "20px" }}>
                              <h3 style={{
                                fontSize: "15px", fontWeight: "700",
                                color: "#2C3E50", marginBottom: "14px",
                              }}>시설 정보</h3>
                              <div style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(5, 1fr)",
                                gap: "8px",
                              }}>
                                {FACILITIES.map((f) => (
                                  <FacilityIcon
                                    key={f.key}
                                    label={f.label}
                                    emoji={f.emoji}
                                    available={selectedPlace[f.key as keyof Place] as boolean}
                                  />
                                ))}
                              </div>
                            </div>
              
                            {/* 웹사이트 */}
                            {selectedPlace.website && (
                              <a
                                href={selectedPlace.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: "block", padding: "14px",
                                  background: "#FFF3E0", borderRadius: "12px",
                                  textAlign: "center", color: "#FF6B35",
                                  fontWeight: "700", fontSize: "14px",
                                  textDecoration: "none", marginBottom: "12px",
                                  border: "1px solid #FF6B35",
                                }}
                              >🔗 웹사이트 바로가기</a>
                            )}
              
                            {/* 닫기 버튼 */}
                            <button
                              onClick={() => setSelectedPlace(null)}
                              style={{
                                width: "100%", padding: "14px",
                                background: "#E0E0E0", border: "none",
                                borderRadius: "12px", fontSize: "15px",
                                fontWeight: "700", color: "#666",
                                cursor: "pointer", marginBottom: "8px",
                              }}
                            >닫기</button>
                          </div>
                        </div>
                      </div>
                    )}
              
                    {/* ===== 하단 탭바 ===== */}
                    <div style={{
                      flexShrink: 0,
                      display: "flex",
                      background: "white",
                      borderTop: "1px solid #E0E0E0",
                      padding: "8px 0 16px",
                      zIndex: 50,
                    }}>
                      {[
                        { key: "explore", label: "탐색",  emoji: "🧭" },
                        { key: "saved",   label: "저장",  emoji: "🔖" },
                        { key: "profile", label: "프로필", emoji: "👤" },
                      ].map((tab) => (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key as "explore" | "saved" | "profile")}
                          style={{
                            flex: 1,
                            display: "flex", flexDirection: "column",
                            alignItems: "center", gap: "4px",
                            background: "none", border: "none", padding: "8px",
                            color: activeTab === tab.key ? "#FF6B35" : "#aaa",
                            fontSize: "11px",
                            fontWeight: activeTab === tab.key ? "700" : "400",
                            cursor: "pointer",
                          }}
                        >
                          <span style={{ fontSize: "22px" }}>{tab.emoji}</span>
                          {tab.label}
                        </button>
                      ))}
                    </div>
              
                  </div>
                );
              }
              