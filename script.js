const calendar = document.getElementById("calendar");
const titleEl = document.getElementById("title");

let myName = localStorage.getItem("myName") || "";
let titleText = localStorage.getItem("title") || "参加カレンダー";

const ADMIN_PASS = "1234";

// ===== 名前ごとの色 =====
let nameColors = JSON.parse(localStorage.getItem("nameColors") || "{}");

const colorPalette = [
  "#e74c3c","#3498db","#2ecc71","#9b59b6",
  "#f39c12","#1abc9c","#e67e22","#34495e"
];

function getColor(name) {
  if (!nameColors[name]) {
    const index = Object.keys(nameColors).length % colorPalette.length;
    nameColors[name] = colorPalette[index];
    localStorage.setItem("nameColors", JSON.stringify(nameColors));
  }
  return nameColors[name];
}

// ===== 月管理 =====
let currentDate = new Date();
currentDate.setDate(1);

render();

// ===== UI =====
document.getElementById("prev").onclick = () => {
  currentDate.setMonth(currentDate.getMonth() - 2);
  render();
};

document.getElementById("next").onclick = () => {
  currentDate.setMonth(currentDate.getMonth() + 2);
  render();
};

document.getElementById("editTitle").onclick = () => {
  const t = prompt("タイトル入力", titleText);
  if (t) {
    titleText = t;
    localStorage.setItem("title", t);
    render();
  }
};

document.getElementById("adminClear").onclick = async () => {
  const pass = prompt("管理者パスワード");
  if (pass !== ADMIN_PASS) return alert("NG");

  if (!confirm("全削除しますか？")) return;

  const y = currentDate.getFullYear();
  const m = currentDate.getMonth();

  for (let i = 0; i < 2; i++) {
    const last = new Date(y, m + i + 1, 0).getDate();
    for (let d = 1; d <= last; d++) {
      const key = `${y}-${m+i+1}-${d}`;
      await deleteDoc(doc(db, "dates", key));
    }
  }

  alert("削除完了");
};

// ===== 描画 =====
function render() {
  calendar.innerHTML = "";

  const y = currentDate.getFullYear();
  const m = currentDate.getMonth();

  titleEl.textContent = `${titleText}（${y}年 ${m+1}月〜${m+2}月）`;

  createMonth(y, m);
  createMonth(y, m + 1);
}

function createMonth(year, month) {
  const lastDay = new Date(year, month + 1, 0).getDate();

  for (let d = 1; d <= lastDay; d++) {
    const dateObj = new Date(year, month, d);
    const key = `${year}-${month+1}-${d}`;
    const day = dateObj.getDay();

    const row = document.createElement("div");
    row.className = "day-row";

    if (day === 0) row.classList.add("sun");
    if (day === 6) row.classList.add("sat");

    const holiday = getHoliday(year, month+1, d);
    if (holiday) row.classList.add("holiday");

    const date = document.createElement("div");
    date.className = "date";
    date.textContent = `${month+1}/${d} ${holiday || ""}`;
    row.appendChild(date);

    const namesDiv = document.createElement("div");
    namesDiv.className = "names";
    row.appendChild(namesDiv);

    const addBtn = document.createElement("div");
    addBtn.className = "add-btn";
    addBtn.textContent = "+参加";
    row.appendChild(addBtn);

    calendar.appendChild(row);

    const ref = doc(db, "dates", key);

    onSnapshot(ref, (snap) => {
      namesDiv.innerHTML = "";
      if (!snap.exists()) return;

      snap.data().names?.forEach(name => {
        const span = document.createElement("span");
        span.className = "name-tag";
        span.textContent = name;

        // ★色適用
        span.style.backgroundColor = getColor(name);

        span.onclick = async () => {
          if (name !== myName) return alert("自分のみ削除可能");
          await updateDoc(ref, { names: arrayRemove(name) });
        };

        namesDiv.appendChild(span);
      });
    });

    addBtn.onclick = async () => {
      if (!myName) {
        myName = prompt("名前入力");
        localStorage.setItem("myName", myName);
      }

      await setDoc(ref, {
        names: arrayUnion(myName)
      }, { merge: true });
    };
  }
}

// ===== 祝日関数（前回の完全版そのまま） =====
function getHoliday(year, month, day) {

  const date = new Date(year, month - 1, day);
  const w = date.getDay();

  const fixed = {
    "1-1": "元日",
    "2-11": "建国記念の日",
    "2-23": "天皇誕生日",
    "4-29": "昭和の日",
    "5-3": "憲法記念日",
    "5-4": "みどりの日",
    "5-5": "こどもの日",
    "8-11": "山の日",
    "11-3": "文化の日",
    "11-23": "勤労感謝の日"
  };

  if (fixed[`${month}-${day}`]) return fixed[`${month}-${day}`];

  function nthMonday(n) {
    let count = 0;
    for (let i = 1; i <= 31; i++) {
      const d = new Date(year, month - 1, i);
      if (d.getMonth() !== month - 1) break;
      if (d.getDay() === 1) count++;
      if (count === n) return i;
    }
  }

  if (month === 1 && day === nthMonday(2)) return "成人の日";
  if (month === 7 && day === nthMonday(3)) return "海の日";
  if (month === 9 && day === nthMonday(3)) return "敬老の日";
  if (month === 10 && day === nthMonday(2)) return "スポーツの日";

  function getShunbun(year) {
    return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980)/4));
  }
  function getShubun(year) {
    return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980)/4));
  }

  if (month === 3 && day === getShunbun(year)) return "春分の日";
  if (month === 9 && day === getShubun(year)) return "秋分の日";

  const yesterday = new Date(year, month - 1, day - 1);
  if (getHolidaySimple(yesterday) && yesterday.getDay() === 0) {
    return "振替休日";
  }

  const prev = new Date(year, month - 1, day - 1);
  const next = new Date(year, month - 1, day + 1);

  if (getHolidaySimple(prev) && getHolidaySimple(next) && w !== 0 && w !== 6) {
    return "国民の休日";
  }

  return "";
}

function getHolidaySimple(date) {
  return getHoliday(date.getFullYear(), date.getMonth()+1, date.getDate());
}