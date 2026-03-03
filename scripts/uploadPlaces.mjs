import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { createReadStream } from "fs";
import { createInterface } from "readline";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const toBoolean = (value) => value?.trim().toUpperCase() === "Y";

const cleanValue = (value) => {
  const trimmed = value?.trim() || "";
  return trimmed === "정보없음" ? "" : trimmed;
};

async function uploadPlaces() {
  const fileStream = createReadStream("data/places_utf8.csv");
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let isFirstLine = true;
  let count = 0;
  const errors = [];

  console.log("🚀 업로드 시작...");

  for await (const line of rl) {
    if (isFirstLine) { isFirstLine = false; continue; }
    if (!line.trim()) continue;

    // 탭으로 분리
    const cols = line.split(",");

    if (cols.length < 5) {
      errors.push(`건너뜀 (컬럼 부족): ${cols[0]}`);
      continue;
    }

    const lat = parseFloat(cols[3]);
    const lng = parseFloat(cols[4]);

    if (isNaN(lat) || isNaN(lng)) {
      errors.push(`건너뜀 (위도/경도 오류): ${cols[0]}`);
      continue;
    }

    try {
      await addDoc(collection(db, "places"), {
        name:           cleanValue(cols[0]),
        category:       cleanValue(cols[1]),
        address:        cleanValue(cols[2]),
        lat,
        lng,
        nursingRoom:    toBoolean(cols[5]),
        familyRestroom: toBoolean(cols[6]),
        freeParking:    toBoolean(cols[7]),
        strollerRental: toBoolean(cols[8]),
        kidsZone:       toBoolean(cols[9]),
        phone:          cleanValue(cols[10]),
        website:        cleanValue(cols[11]),
        hours:          cleanValue(cols[12]),
        closedDays:     cleanValue(cols[13]),
        rating:         0,
        review:         "",
        createdAt:      new Date(),
      });

      count++;
      if (count % 50 === 0) {
        console.log(`✅ ${count}개 업로드 완료...`);
      }
    } catch (error) {
      errors.push(`오류: ${cols[0]} - ${error.message}`);
    }
  }

  console.log(`\n🎉 업로드 완료! 총 ${count}개`);
  if (errors.length > 0) {
    console.log(`\n⚠️ 오류 ${errors.length}개:`);
    errors.forEach((e) => console.log(e));
  }

  process.exit(0);
}

uploadPlaces();
