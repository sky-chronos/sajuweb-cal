/* =========================================================
   app.js – STEP 4-4 (대운·세운·월운 자동 계산)
   기존:
   - KASI 음력 → 양력
   - 사주 4주
   - 보조 메모
   추가:
   - 대운 / 세운 / 월운
========================================================= */

function $(id){ return document.getElementById(id); }
function pad2(n){ return String(n).padStart(2,"0"); }
function mod(n,m){ return ((n%m)+m)%m; }

/* ================= UI ================= */
function getCalendarType(){
  return document.querySelector('input[name="calendarType"]:checked').value;
}
function updateUI(){
  const isLunar = getCalendarType()==="lunar";
  $("engineRow").classList.toggle("hidden", !isLunar);
  $("leapRow").classList.toggle("hidden", !isLunar);
  $("engineBadge").textContent =
    $("lunarEngine").value==="kasi" ? "엔진: KASI(오프라인)" : "엔진: 범용";
}

/* ================= KASI ================= */
function lunarToSolar_KASI(y,m,d,isLeap){
  if(typeof KoreanLunarCalendar==="undefined")
    throw new Error("KASI 엔진 로드 실패");
  const cal=new KoreanLunarCalendar();
  if(!cal.setLunarDate(y,m,d,isLeap))
    throw new Error("유효하지 않은 음력 날짜");
  const s=cal.getSolarCalendar();
  return {year:s.year, month:s.month, day:s.day};
}
function lunarToSolar_UniversalBlocked(){
  throw new Error("범용 음력 엔진은 비활성화됨. KASI 사용");
}

/* ================= 기본 상수 ================= */
const STEMS=["갑","을","병","정","무","기","경","신","임","계"];
const BRANCHES=["자","축","인","묘","진","사","오","미","신","유","술","해"];

const STEM_INFO={
  "갑":{el:"목",yy:"양"},"을":{el:"목",yy:"음"},
  "병":{el:"화",yy:"양"},"정":{el:"화",yy:"음"},
  "무":{el:"토",yy:"양"},"기":{el:"토",yy:"음"},
  "경":{el:"금",yy:"양"},"신":{el:"금",yy:"음"},
  "임":{el:"수",yy:"양"},"계":{el:"수",yy:"음"}
};
const GEN={"목":"화","화":"토","토":"금","금":"수","수":"목"};
const CON={"목":"토","토":"수","수":"화","화":"금","금":"목"};

const HIDDEN={
  "자":["임","계"],"축":["기","계","신"],"인":["갑","병","무"],
  "묘":["을"],"진":["무","을","계"],"사":["병","무","경"],
  "오":["정","기"],"미":["기","정","을"],"신":["경","임","무"],
  "유":["신"],"술":["무","신","정"],"해":["임","갑"]
};

/* ================= 사주 4주 ================= */
function yearPillar(y,m,d){
  const useYear = (m<2 || (m===2 && d<4)) ? y-1 : y;
  return { stem: STEMS[mod(useYear-4,10)], branch: BRANCHES[mod(useYear-4,12)] };
}
function monthPillar(y,m){
  return { stem: STEMS[mod(y*12+m,10)], branch: BRANCHES[mod(m+1,12)] };
}
function dayPillar(y,m,d){
  const base=new Date(1900,0,1);
  const cur=new Date(y,m-1,d);
  const diff=Math.floor((cur-base)/86400000);
  return { stem: STEMS[mod(diff,10)], branch: BRANCHES[mod(diff,12)] };
}
function hourPillar(dayStem,hour){
  const br=Math.floor((hour+1)/2)%12;
  const st=mod(STEMS.indexOf(dayStem)*2+br,10);
  return { stem: STEMS[st], branch: BRANCHES[br] };
}

/* ================= 보조 메모 ================= */
function fiveCounts(p){
  const c={목:0,화:0,토:0,금:0,수:0};
  ["year","month","day","hour"].forEach(k=>{
    c[STEM_INFO[p[k].stem].el]++;
    HIDDEN[p[k].branch].forEach(s=>c[STEM_INFO[s].el]++);
  });
  return c;
}
function strength(dayStem, counts){
  const el=STEM_INFO[dayStem].el;
  const sup=counts[el]+counts[GEN[el]];
  const tot=Object.values(counts).reduce((a,b)=>a+b,0);
  if(sup*2>=tot+2) return "신강";
  if(sup*2<=tot-2) return "신약";
  return "중간";
}
function yongshin(dayStem, str){
  const el=STEM_INFO[dayStem].el;
  if(str==="신강") return {p:GEN[el], s:CON[el]};
  if(str==="신약") return {p:el, s:GEN[el]};
  return {p:el, s:GEN[el]};
}

/* ================= STEP 4-4 핵심 ================= */
function buildLuckText(pillars, solarYear){
  const baseStemIdx = STEMS.indexOf(pillars.month.stem);
  const baseBranchIdx = BRANCHES.indexOf(pillars.month.branch);

  let daewoon = "[대운]\n";
  for(let i=1;i<=6;i++){
    const s = STEMS[mod(baseStemIdx+i,10)];
    const b = BRANCHES[mod(baseBranchIdx+i,12)];
    daewoon += `- ${i*10}세: ${s}${b}\n`;
  }

  let sewoon = "\n[세운(연운)]\n";
  for(let y=solarYear-3; y<=solarYear+3; y++){
    sewoon += `- ${y}: ${STEMS[mod(y-4,10)]}${BRANCHES[mod(y-4,12)]}\n`;
  }

  let wolwoon = "\n[월운]\n";
  for(let m=1;m<=12;m++){
    wolwoon += `- ${m}월: ${STEMS[mod(solarYear*12+m,10)]}${BRANCHES[mod(m+1,12)]}\n`;
  }

  return daewoon + sewoon + wolwoon;
}

/* ================= 실행 ================= */
function onCalc(){
  $("err").textContent=""; $("msg").textContent=""; $("debug").textContent="";
  try{
    const calType=getCalendarType();
    const engine=$("lunarEngine").value;
    const isLeap=$("isLeapMonth").value==="true";

    const y=Number($("year").value);
    const m=Number($("month").value);
    const d=Number($("day").value);
    const hh=Number($("hour").value);
    const mm=Number($("minute").value);

    let solar={year:y,month:m,day:d};
    if(calType==="lunar"){
      solar = engine==="kasi"
        ? lunarToSolar_KASI(y,m,d,isLeap)
        : lunarToSolar_UniversalBlocked();
    }

    const pillars={
      year: yearPillar(solar.year,solar.month,solar.day),
      month: monthPillar(solar.year,solar.month),
      day: dayPillar(solar.year,solar.month,solar.day),
      hour: hourPillar(dayPillar(solar.year,solar.month,solar.day).stem, hh)
    };

    const counts=fiveCounts(pillars);
    const str=strength(pillars.day.stem, counts);
    const ys=yongshin(pillars.day.stem, str);
    const luckText = buildLuckText(pillars, solar.year);

    const out =
`[사주도사 웹계산 결과 – STEP 4-4]

[출생 정보]
- 양력: ${solar.year}-${pad2(solar.month)}-${pad2(solar.day)} ${pad2(hh)}:${pad2(mm)} (KST)

[사주 팔자]
- 년주: ${pillars.year.stem}${pillars.year.branch}
- 월주: ${pillars.month.stem}${pillars.month.branch}
- 일주: ${pillars.day.stem}${pillars.day.branch}
- 시주: ${pillars.hour.stem}${pillars.hour.branch}

[보조 메모]
- 일간: ${pillars.day.stem}
- 오행 분포: 목${counts.목} 화${counts.화} 토${counts.토} 금${counts.금} 수${counts.수}
- 신강/신약: ${str}
- 용신 후보: 1순위 ${ys.p}, 2순위 ${ys.s}

${luckText}

※ GPT(사주도사)는 위 계산 결과를 변경하지 말고 해석만 수행하세요.
`;

    $("msg").textContent = `STEP 4-4 완료 → 대운·세운·월운 계산됨`;
    $("debug").textContent = out;

  }catch(e){
    $("err").textContent=e.message;
  }
}

/* ================= init ================= */
function init(){
  document.querySelectorAll('input[name="calendarType"]').forEach(el=>{
    el.addEventListener("change",updateUI);
  });
  $("lunarEngine").addEventListener("change",updateUI);
  $("btnCalc").addEventListener("click",onCalc);
  updateUI();
}
init();
