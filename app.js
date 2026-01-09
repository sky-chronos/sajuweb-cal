/* app.js – STEP 4-3 (보조 메모 자동 생성: 십성·오행·신강·용신) */

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
  if(typeof KoreanLunarCalendar==="undefined") throw new Error("KASI 엔진 로드 실패");
  const cal=new KoreanLunarCalendar();
  if(!cal.setLunarDate(y,m,d,isLeap)) throw new Error("유효하지 않은 음력");
  const s=cal.getSolarCalendar();
  return {year:s.year, month:s.month, day:s.day};
}
function lunarToSolar_UniversalBlocked(){
  throw new Error("범용 음력 엔진은 비활성화됨. KASI 사용");
}

/* ================= 사주 기본 ================= */
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

/* ================= 십성 ================= */
function tenGod(day, target){
  const d=STEM_INFO[day], t=STEM_INFO[target];
  const sameYY = d.yy===t.yy;
  if(d.el===t.el) return sameYY?"비견":"겁재";
  if(GEN[d.el]===t.el) return sameYY?"식신":"상관";
  if(CON[d.el]===t.el) return sameYY?"편재":"정재";
  if(CON[t.el]===d.el) return sameYY?"칠살":"정관";
  if(GEN[t.el]===d.el) return sameYY?"편인":"정인";
  return "-";
}

/* ================= 오행 분포 ================= */
function fiveCounts(pillars){
  const c={목:0,화:0,토:0,금:0,수:0};
  // 천간
  ["year","month","day","hour"].forEach(k=>{
    c[STEM_INFO[pillars[k].stem].el]+=1;
  });
  // 지장간
  ["year","month","day","hour"].forEach(k=>{
    HIDDEN[pillars[k].branch].forEach(s=>{
      c[STEM_INFO[s].el]+=1;
    });
  });
  return c;
}

/* ================= 신강/신약 ================= */
function strength(dayStem, counts){
  const dmEl = STEM_INFO[dayStem].el;
  const my = counts[dmEl] + counts[Object.keys(GEN).find(k=>GEN[k]===dmEl)];
  const other = Object.values(counts).reduce((a,b)=>a+b,0)-my;
  if(my-other>=2) return "신강";
  if(other-my>=2) return "신약";
  return "중간";
}

/* ================= 용신 후보 ================= */
function yongshin(dayStem, strengthVal){
  const el=STEM_INFO[dayStem].el;
  if(strengthVal==="신강") return {p:GEN[el], s:CON[el]};
  if(strengthVal==="신약") return {p:el, s:Object.keys(GEN).find(k=>GEN[k]===el)};
  return {p:el, s:GEN[el]};
}

/* ================= STEP 4-3 ================= */
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
      solar = engine==="kasi" ? lunarToSolar_KASI(y,m,d,isLeap) : lunarToSolar_UniversalBlocked();
    }

    // 🔒 이미 계산된 4주(기존 STEP 4-2 결과와 동일 로직 가정)
    const pillars = window.__LAST_PILLARS__; // STEP 4-2에서 생성된 값
    if(!pillars) throw new Error("사주 4주 정보가 없습니다. (STEP 4-2 확인)");

    const dayStem=pillars.day.stem;
    const tg={
      year:tenGod(dayStem,pillars.year.stem),
      month:tenGod(dayStem,pillars.month.stem),
      hour:tenGod(dayStem,pillars.hour.stem)
    };
    const hiddenTG={
      year:HIDDEN[pillars.year.branch].map(s=>`${s}(${tenGod(dayStem,s)})`).join(", "),
      month:HIDDEN[pillars.month.branch].map(s=>`${s}(${tenGod(dayStem,s)})`).join(", "),
      day:HIDDEN[pillars.day.branch].map(s=>`${s}(${tenGod(dayStem,s)})`).join(", "),
      hour:HIDDEN[pillars.hour.branch].map(s=>`${s}(${tenGod(dayStem,s)})`).join(", ")
    };

    const counts=fiveCounts(pillars);
    const str=strength(dayStem,counts);
    const ys=yongshin(dayStem,str);

    const memo =
`[보조 메모 – 해석 안정화용]

[십성(천간)]
- 년간: ${tg.year}
- 월간: ${tg.month}
- 시간: ${tg.hour}

[지장간 십성]
- 년지: ${hiddenTG.year}
- 월지: ${hiddenTG.month}
- 일지: ${hiddenTG.day}
- 시지: ${hiddenTG.hour}

[오행 분포]
- 목:${counts.목} 화:${counts.화} 토:${counts.토} 금:${counts.금} 수:${counts.수}

[신강·신약]
- 판정: ${str}

[용신 후보]
- 1순위: ${ys.p}
- 2순위: ${ys.s}

※ GPT는 위 보조 메모를 참고하여 해석 일관성을 유지하세요.
`;

    $("msg").textContent="STEP 4-3 완료: 보조 메모 생성됨";
    $("debug").textContent=memo;

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
