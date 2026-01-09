/* app.js – STEP 4-2 (사주 계산 + GPT 복사용 텍스트 생성) */

function $(id) {
  return document.getElementById(id);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/* ================= UI ================= */

function getCalendarType() {
  return document.querySelector('input[name="calendarType"]:checked').value;
}

function updateUI() {
  const isLunar = getCalendarType() === "lunar";
  $("engineRow").classList.toggle("hidden", !isLunar);
  $("leapRow").classList.toggle("hidden", !isLunar);

  const engine = $("lunarEngine").value;
  $("engineBadge").textContent =
    engine === "kasi" ? "엔진: KASI(오프라인)" : "엔진: 범용";
}

/* ================= KASI 음력 → 양력 ================= */

function lunarToSolar_KASI(y, m, d, isLeap) {
  if (typeof KoreanLunarCalendar === "undefined") {
    throw new Error("KASI 엔진 로드 실패");
  }
  const cal = new KoreanLunarCalendar();
  const ok = cal.setLunarDate(y, m, d, isLeap);
  if (!ok) throw new Error("유효하지 않은 음력 날짜");
  const s = cal.getSolarCalendar();
  return { year: s.year, month: s.month, day: s.day };
}

function lunarToSolar_UniversalBlocked() {
  throw new Error("범용 음력 엔진은 비활성화됨. KASI 사용 권장.");
}

/* ================= 사주 계산(간단·안정판) ================= */

const STEMS = ["갑","을","병","정","무","기","경","신","임","계"];
const BRANCHES = ["자","축","인","묘","진","사","오","미","신","유","술","해"];

function mod(n, m) {
  return ((n % m) + m) % m;
}

/* 연주 (입춘 경계 단순판: 2/4 기준) */
function yearPillar(y, m, d) {
  const adjYear = (m < 2 || (m === 2 && d < 4)) ? y - 1 : y;
  return {
    stem: STEMS[mod(adjYear - 4, 10)],
    branch: BRANCHES[mod(adjYear - 4, 12)]
  };
}

/* 월주 (간단 절기판: 양력 월 기준) */
function monthPillar(y, m) {
  return {
    stem: STEMS[mod(y * 12 + m, 10)],
    branch: BRANCHES[mod(m + 1, 12)]
  };
}

/* 일주 (1900-01-01 기준) */
function dayPillar(y, m, d) {
  const base = new Date(1900, 0, 1);
  const cur = new Date(y, m - 1, d);
  const diff = Math.floor((cur - base) / 86400000);
  return {
    stem: STEMS[mod(diff + 0, 10)],
    branch: BRANCHES[mod(diff + 0, 12)]
  };
}

/* 시주 */
function hourPillar(dayStem, hour) {
  const branchIndex = Math.floor((hour + 1) / 2) % 12;
  const stemIndex = mod(STEMS.indexOf(dayStem) * 2 + branchIndex, 10);
  return {
    stem: STEMS[stemIndex],
    branch: BRANCHES[branchIndex]
  };
}

/* ================= STEP 4-2 핵심 ================= */

function computeSajuWithSolarDate(solar) {
  const hour = Number($("hour").value);
  const minute = Number($("minute").value);

  const yP = yearPillar(solar.year, solar.month, solar.day);
  const mP = monthPillar(solar.year, solar.month);
  const dP = dayPillar(solar.year, solar.month, solar.day);
  const hP = hourPillar(dP.stem, hour);

  const sajuText =
`[사주 계산 결과 – 사주도사 웹계산기]

[출생 정보]
- 양력: ${solar.year}-${pad2(solar.month)}-${pad2(solar.day)} ${pad2(hour)}:${pad2(minute)} (KST)
- 음력 변환 기준: KASI(한국천문연구원)

[사주 팔자]
- 년주: ${yP.stem}${yP.branch}
- 월주: ${mP.stem}${mP.branch}
- 일주: ${dP.stem}${dP.branch}
- 시주: ${hP.stem}${hP.branch}

※ 위 사주값은 “웹 계산 결과”이며,
GPT(사주도사)는 계산을 변경하지 말고
해석만 수행하세요.
`;

  return {
    solarResolved: `${solar.year}-${pad2(solar.month)}-${pad2(solar.day)}`,
    pillars: { year: yP, month: mP, day: dP, hour: hP },
    gptText: sajuText
  };
}

/* ================= 실행 ================= */

function onCalc() {
  $("err").textContent = "";
  $("msg").textContent = "";
  $("debug").textContent = "";

  try {
    const calendarType = getCalendarType();
    const engine = $("lunarEngine").value;
    const isLeap = $("isLeapMonth").value === "true";

    const y = Number($("year").value);
    const m = Number($("month").value);
    const d = Number($("day").value);

    let solar = { year: y, month: m, day: d };

    if (calendarType === "lunar") {
      solar = (engine === "kasi")
        ? lunarToSolar_KASI(y, m, d, isLeap)
        : lunarToSolar_UniversalBlocked();
    }

    const result = computeSajuWithSolarDate(solar);

    $("msg").textContent =
      `사주 계산 완료 → ${result.solarResolved}`;

    $("debug").textContent = result.gptText;

  } catch (e) {
    $("err").textContent = e.message;
  }
}

/* ================= 초기화 ================= */

function init() {
  document
    .querySelectorAll('input[name="calendarType"]')
    .forEach(el => el.addEventListener("change", updateUI));

  $("lunarEngine").addEventListener("change", updateUI);
  $("btnCalc").addEventListener("click", onCalc);
  updateUI();
}

init();
