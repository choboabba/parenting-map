import { db } from "./firebase";
import {
  collection,
  getDocs,
  query,
  where,
  limit,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

export interface Place {
  id?: string;
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  nursingRoom: boolean;
  familyRestroom: boolean;
  freeParking: boolean;
  strollerRental: boolean;
  kidsZone: boolean;
  phone: string;
  website: string;
  hours: string;
  closedDays: string;
  rating: number;
  review: string;
  createdAt: Date;
}

export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// =====================
// 지도 영역 + 필터로 장소 조회
// =====================
export const getPlacesByBounds = async (
  bounds: MapBounds,
  facilityFilters?: { [key: string]: boolean }
): Promise<Place[]> => {
  const q = query(
    collection(db, "places"),
    where("lat", ">=", bounds.minLat),
    where("lat", "<=", bounds.maxLat),
    limit(300)
  );

  const snapshot = await getDocs(q);
  let places = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as Place[];

  // 경도 범위 필터 (JS)
  places = places.filter(
    (p) => p.lng >= bounds.minLng && p.lng <= bounds.maxLng
  );

  // 시설 필터 (JS)
  if (facilityFilters) {
    const activeFilters = Object.entries(facilityFilters)
      .filter(([, v]) => v)
      .map(([k]) => k);

    if (activeFilters.length > 0) {
      places = places.filter((p) =>
        activeFilters.every((f) => p[f as keyof Place] === true)
      );
    }
  }

  return places;
};

// =====================
// 검색어로 장소 조회
// =====================
export const searchPlaces = async (
  keyword: string,
  facilityFilters?: { [key: string]: boolean }
): Promise<Place[]> => {
  const q = query(
    collection(db, "places"),
    limit(500)
  );

  const snapshot = await getDocs(q);
  let places = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as Place[];

  if (keyword.trim()) {
    places = places.filter(
      (p) =>
        p.name.includes(keyword) ||
        p.address.includes(keyword)
    );
  }

  if (facilityFilters) {
    const activeFilters = Object.entries(facilityFilters)
      .filter(([, v]) => v)
      .map(([k]) => k);

    if (activeFilters.length > 0) {
      places = places.filter((p) =>
        activeFilters.every((f) => p[f as keyof Place] === true)
      );
    }
  }

  return places;
};

export const updatePlace = async (id: string, place: Partial<Place>) => {
  await updateDoc(doc(db, "places", id), place);
};

export const deletePlace = async (id: string) => {
  await deleteDoc(doc(db, "places", id));
};
