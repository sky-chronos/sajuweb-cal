/* app.js – STEP 4-2 (A안: 사주팔자 4주만 정확 출력 + GPT 복사용 텍스트) */

function $(id) { return document.getElementById(id); }
function pad2(n) { return String(n).padStart(2, "0"); }
function mod(n, m) { return ((n % m) + m) % m; }

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
    throw new Error(
      "KASI 엔진이 로드되지 않았습니다.\n" +
      "vendor/korean-lunar-calendar.min.js 파일을 확인하세요."
    );
  }
  const cal = new KoreanLunarCalendar();
  const ok = cal.setLunarDate(Number(y), Number(m), Number(d), Boolean(isLeap));
  if (!ok) throw new Error("KASI 엔진에서 유효하지 않은 음력 날짜로 판단했습니다.");
  const s = cal.getSolarCalendar();
  return { year: Number(s.year), month: Number(s.month), day: Number(s.day) };
}

function lunarToSolar_UniversalBlocked() {
  throw new Error(
    "범용 음력 변환 엔진은 정확도 이슈로 비활성화되었습니다.\n" +
    "KASI(오프라인) 엔진을 선택하세요."
  );
}

/* ================= 사주 4주 계산(절기/입춘 기준, KST) ================= */
/*
  - 연주 경계: 입춘(태양황경 315°)
  - 월주: 절기 기준(태양황경 30° 단위), 寅월=315°
  - 일주: JD 기반
  - 시주: 2시간 지지, 일간 기준 시천간
*/

const STEMS = ["갑","을","병","정","무","기","경","신","임","계"];
const BRANCHES = ["자","축","인","묘","진","사","오","미","신","유","술","해"];

/* Julian Day (UTC) */
function julianDayUTC(year, month, day, hour=0, minute=0, second=0){
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12*a - 3;
  const JDN = day + Math.floor((153*m + 2)/5) + 365*y + Math.floor(y/4) - Math.floor(y/100) + Math.floor(y/400) - 32045;
  const frac = (hour + (minute + second/60)/60) / 24;
  return (JDN - 0.5) + frac;
}

/* KST → UTC JD */
function kstToUTCJD(y,m,d,hh,mm){
  const date = new Date(Date.UTC(y, m-1, d, hh-9, mm, 0));
  return julianDayUTC(
    date.getUTCFullYear(),
    date.getUTCMonth()+1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    0
  );
}

function kstNoonUTCJD(y,m,d){ return kstToUTCJD(y,m,d,12,0); }

/* Sun ecliptic longitude (approx) */
function sunEclipticLongitudeDeg(jd){
  const T = (jd - 2451545.0) / 36525.0;
  let L0 = 280.46646 + 36000.76983*T + 0.0003032*T*T; L0 = mod(L0,360);
  let M  = 357.52911 + 35999.05029*T - 0.0001537*T*T; M  = mod(M,360);
  const Mr = M*Math.PI/180;
  const C = (1.914602 - 0.004817*T - 0.000014*T*T)*Math.sin(Mr)
          + (0.019993 - 0.000101*T)*Math.sin(2*Mr)
          + 0.000289*Math.sin(3*Mr);
  const omega = (125.04 - 1934.136 * T) * Math.PI/180;
  let lambda = (L0 + C) - 0.00569 - 0.00478*Math.sin(omega);
  return mod(lambda,360);
}

/* Find longitude crossing near centerJd */
function findSolarLongitudeCrossingUTC(centerJd, targetDeg, windowDays=6){
  const target = mod(targetDeg,360);
  function f(jd){
    const lon = sunEclipticLongitudeDeg(jd);
    return mod(lon - target + 180, 360) - 180; // [-180,180)
  }
  const lo0 = centerJd - windowDays, hi0 = centerJd + windowDays;
  const steps = 240;
  let prevJd = lo0, prevF = f(prevJd);
  let bracket = null;

  for(let i=1;i<=steps;i++){
    const jd = lo0 + (hi0-lo0)*i/steps;
    const curF = f(jd);
    if(prevF*curF <= 0 && Math.abs(prevF-curF) < 120){
      bracket = [prevJd, jd];
      break;
    }
    prevJd = jd; prevF = curF;
  }
  if(!bracket) return null;

  let a = bracket[0], b = bracket[1];
  for(let iter=0;iter<60;iter++){
    const mid = (a+b)/2;
    const fa = f(a), fm = f(mid);
    if(fa*fm <= 0) b = mid; else a = mid;
    if(Math.abs(b-a) < 1/86400) break; // ~1s
  }
  return (a+b)/2;
}

/* 연주: 입춘(315°) 이전이면 전년도 */
function calcYearPillar(y,m,d,hh,mm){
  const jdUTC = kstToUTCJD(y,m,d,hh,mm);

  // 입춘은 대략 2/4 근처
  const approx = julianDayUTC(y,2,4,0,0,0);
  const lichun = findSolarLongitudeCrossingUTC(approx, 315, 6);

  const useYear = (lichun && jdUTC < lichun) ? (y-1) : y;

  // 1984년=갑자 기준의 표준식
  const stemIdx = 1 + mod(useYear + 6, 10);
  const brIdx   = 1 + mod(useYear + 8, 12);

  return { useYear, stemIdx, branchIdx: brIdx };
}

/* 월주: 절기 기준, 寅월 시작=315° */
function firstMonthStemForYearStem(ys){
  if(ys===1 || ys===6) return 3;   // 甲/己 -> 丙
  if(ys===2 || ys===7) return 5;   // 乙/庚 -> 戊
  if(ys===3 || ys===8) return 7;   // 丙/辛 -> 庚
  if(ys===4 || ys===9) return 9;   // 丁/壬 -> 壬
  if(ys===5 || ys===10) return 1;  // 戊/癸 -> 甲
  return 1;
}

function calcMonthPillar(y,m,d,hh,mm, yearStemIdx){
  const jdUTC = kstToUTCJD(y,m,d,hh,mm);
  const lon = sunEclipticLongitudeDeg(jdUTC);

  // 315°~345°: 1(寅), 345°~15°: 2(卯) ... 30° 단위
  const monthIndex = 1 + Math.floor(mod(lon - 315, 360) / 30); // 1..12
  const monthBranchIdx = 1 + mod((2 + (monthIndex-1)), 12);    // 寅=3
  const firstStem = firstMonthStemForYearStem(yearStemIdx);
  const monthStemIdx = 1 + mod((firstStem-1) + (monthIndex-1), 10);

  return { monthStemIdx, monthBranchIdx, solarLon: lon };
}

/* 일주: JD 기반(정오 JD 사용) */
function calcDayPillar(y,m,d){
  const jdNoonUTC = kstNoonUTCJD(y,m,d);
  const JD_noon = Math.floor(jdNoonUTC + 0.5);
  const dayStemIdx = 1 + mod(JD_noon - 1, 10);
  const dayBranchIdx = 1 + mod(JD_noon + 1, 12);
  return { dayStemIdx, dayBranchIdx };
}

/* 시주: 지지 + 일간 기준 시천간 */
function calcHourPillar(dayStemIdx, hh, mm){
  const total = hh*60 + mm;
  let br;
  if(total >= 23*60 || total < 1*60) br = 1;       // 子
  else if(total < 3*60) br = 2;                    // 丑
  else if(total < 5*60) br = 3;                    // 寅
  else if(total < 7*60) br = 4;                    // 卯
  else if(total < 9*60) br = 5;                    // 辰
  else if(total < 11*60) br = 6;                   // 巳
  else if(total < 13*60) br = 7;                   // 午
  else if(total < 15*60) br = 8;                   // 未
  else if(total < 17*60) br = 9;                   // 申
  else if(total < 19*60) br = 10;                  // 酉
  else if(total < 21*60) br = 11;                  // 戌
  else br = 12;                                    // 亥

  const lateRat = (hh === 23); // 23시를 다음날 子로 세는 유파 고려(간단보정)
  const raw = (dayStemIdx*2 - 1) + (br - 1) + (lateRat ? 12 : 0);
  const hs = 1 + mod(raw, 10);

  return { hourStemIdx: hs, hourBranchIdx: br };
}

function formatPillar(stemIdx, branchIdx){
  return STEMS[stemIdx-1] + BRANCHES[branchIdx-1];
}

/* ================= STEP 4-2 (A안) 결과 생성 ================= */

function computeFourPillarsFromSolar(solar, hh, mm) {
  const year = calcYearPillar(solar.year, solar.month, solar.day, hh, mm);
  const month = calcMonthPillar(solar.year, solar.month, solar.day, hh, mm, year.stemIdx);
  const day = calcDayPillar(solar.year, solar.month, solar.day);
  const hour = calcHourPillar(day.dayStemIdx, hh, mm);

  const pillars = {
    year: { stemIdx: year.stemIdx, branchIdx: year.branchIdx, text: formatPillar(year.stemIdx, year.branchIdx) },
    month:{ stemIdx: month.monthStemIdx, branchIdx: month.monthBranchIdx, text: formatPillar(month.monthStemIdx, month.monthBranchIdx) },
    day:  { stemIdx: day.dayStemIdx, branchIdx: day.dayBranchIdx, text: formatPillar(day.dayStemIdx, day.dayBranchIdx) },
    hour: { stemIdx: hour.hourStemIdx, branchIdx: hour.hourBranchIdx, text: formatPillar(hour.hourStemIdx, hour.hourBranchIdx) }
  };

  return { pillars, debug: { useYear: year.useYear, solarLon: Number(month.solarLon.toFixed(3)) } };
}

function buildGPTText(inputMeta, solar, hh, mm, pillars, extraDebug){
  const calText = inputMeta.calendarType === "lunar"
    ? `음력 (윤달: ${inputMeta.isLeap ? "예" : "아니오"})`
    : "양력";

  const engineText = (inputMeta.calendarType === "lunar")
    ? (inputMeta.engine === "kasi" ? "KASI(한국천문연구원) 오프라인" : "범용")
    : "-";

  return (
`[사주도사 웹계산 결과 | STEP 4-2(A)]
※ GPT는 아래 ‘확정값’을 변경하지 말고 해석만 하세요.

[기준]
- 시간대: KST
- 연주 경계: 입춘(315°) 기준
- 월주 기준: 절기(태양황경 30°) 기준
- 음력 입력 시: 선택 엔진으로 양력 변환 후 계산

[입력]
- 달력: ${calText}
- 음력 변환 엔진: ${engineText}

[출생 정보(계산 기준 양력)]
- ${solar.year}-${pad2(solar.month)}-${pad2(solar.day)} ${pad2(hh)}:${pad2(mm)} (KST)

[사주 팔자]
- 년주: ${pillars.year.text}
- 월주: ${pillars.month.text}
- 일주: ${pillars.day.text}
- 시주: ${pillars.hour.text}

[디버그(검증용)]
- 사용 연도(useYear): ${extraDebug.useYear}
- 태양황경(출생시각): ${extraDebug.solarLon}°
`
  );
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
    const hh = Number($("hour").value);
    const mm = Number($("minute").value);

    let solar = { year: y, month: m, day: d };

    if (calendarType === "lunar") {
      if (engine === "kasi") solar = lunarToSolar_KASI(y, m, d, isLeap);
      else solar = lunarToSolar_UniversalBlocked();
    }

    const { pillars, debug } = computeFourPillarsFromSolar(solar, hh, mm);

    const gptText = buildGPTText(
      { calendarType, engine, isLeap },
      solar,
      hh,
      mm,
      pillars,
      debug
    );

    $("msg").textContent =
      `STEP 4-2(A) 완료: 4주 산출됨 → ${solar.year}-${pad2(solar.month)}-${pad2(solar.day)}`;

    // 결과창(pre#debug)에 GPT 복사용 텍스트 출력
    $("debug").textContent = gptText;

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
