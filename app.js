// app_cn.js — SRS Tiếng Trung (localStorage riêng, SpeechSynthesis zh-CN)
(() => {
  const STORAGE_KEY = "quin_srs_cn_v1";
  const msPerDay = 24 * 60 * 60 * 1000;
  const todayDays = () => Math.floor(Date.now() / msPerDay);

  // SM-2 update (q values used: 0,2,3,4)
  function sm2Update(w, q) {
    if (!w) return;
    if (q < 3) {
      w.reps = 0;
      w.interval = 1;
    } else {
      w.reps = (w.reps || 0) + 1;
      if (w.reps === 1) w.interval = 1;
      else if (w.reps === 2) w.interval = 6;
      else w.interval = Math.round((w.interval || 1) * (w.ef || 2.5));
    }
    w.ef = Math.max(
      1.3,
      (w.ef || 2.5) + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    );
    w.next = todayDays() + (w.interval || 1);
  }

  // storage
  let db = { words: [] };
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) db = JSON.parse(raw);
    } catch (e) {
      console.error("load err", e);
      db = { words: [] };
    }
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    updateStats();
  }

  // DOM helpers
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // elements
  const tabBtns = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab");

  const inpHanzi = $("#inp-hanzi");
  const inpPinyin = $("#inp-pinyin");
  const inpMeaning = $("#inp-meaning");
  const inpExample = $("#inp-example");
  const inpImage = $("#inp-image");
  const btnAdd = $("#btn-add");
  const addMsg = $("#addMsg");

  const dueCountEl = $("#dueCount");
  const noDueEl = $("#noDue");
  const cardEl = $("#card");
  const cardHanzi = $("#card-hanzi");
  const cardPinyin = $("#card-pinyin");
  const cardMeaning = $("#card-meaning");
  const cardExample = $("#card-example");
  const cardImageContainer = $("#card-image-container");
  const queueMeta = $("#queueMeta");
  const showMeaningBtn = $("#showMeaningBtn");
  const playAudioBtn = $("#playAudioBtn");

  const gradeBtns = document.querySelectorAll(".grade-btn");

  const wordTableBody = $("#wordTable tbody");
  const searchBox = $("#searchBox");
  const refreshListBtn = $("#refreshList");

  const statTotal = $("#statTotal");
  const statDue = $("#statDue");
  const chartEl = $("#chart");

  const exportBtn = $("#exportBtn");
  const importBtn = $("#importBtn");
  const importFile = $("#importFile");
  const clearAllBtn = $("#clearAll");

  let queue = [],
    idx = 0;

  // init
  load();
  bindTabs();
  updateStats();
  renderList();
  startLeafFall();

  // speech
  function speakChinese(text) {
    if (!text) return;
    if (!("speechSynthesis" in window)) {
      console.warn("SpeechSynthesis không được hỗ trợ trên trình duyệt này.");
      return;
    }
    // cancel any ongoing speech to avoid overlap
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN"; // dùng Mandarin (Trung Quốc). đổi 'zh-TW' nếu muốn giọng Đài Loan
    u.rate = 0.98;
    u.pitch = 1.0;
    // prefer a voice that matches lang if available
    const voices = speechSynthesis.getVoices();
    if (voices && voices.length) {
      const v =
        voices.find((vv) => vv.lang && vv.lang.startsWith("zh")) || null;
      if (v) u.voice = v;
    }
    speechSynthesis.speak(u);
  }

  // tab handling
  function bindTabs() {
    tabBtns.forEach((b) => {
      b.addEventListener("click", () => {
        tabBtns.forEach((x) => x.classList.remove("active"));
        panels.forEach((p) => p.classList.remove("active"));
        b.classList.add("active");
        document.getElementById(b.dataset.target).classList.add("active");
        if (b.dataset.target === "tab-list") renderList();
        if (b.dataset.target === "tab-stats") drawChart();
        if (b.dataset.target === "tab-review") prepareReview();
      });
    });
  }

  // add
  btnAdd.addEventListener("click", () => {
    const hanzi = inpHanzi.value.trim();
    const meaning = inpMeaning.value.trim();
    if (!hanzi || !meaning) {
      addMsg.textContent = "Hán tự và Ý nghĩa là bắt buộc";
      setTimeout(() => (addMsg.textContent = ""), 1800);
      return;
    }
    const item = {
      id: Date.now(),
      hanzi,
      pinyin: inpPinyin.value.trim(),
      meaning,
      example: inpExample.value.trim(),
      imageUrl: inpImage.value.trim(),
      ef: 2.5,
      reps: 0,
      interval: 1,
      next: todayDays(),
    };
    db.words.push(item);
    save();
    inpHanzi.value =
      inpPinyin.value =
      inpMeaning.value =
      inpExample.value =
      inpImage.value =
        "";
    addMsg.textContent = "Đã lưu ✓";
    setTimeout(() => (addMsg.textContent = ""), 1400);
  });

  // review prepare
  function prepareReview() {
    queue = db.words.filter((w) => (w.next || 0) <= todayDays());
    updateDueCount();
    if (!queue.length) {
      noDueEl.style.display = "block";
      cardEl.classList.add("hidden");
      return;
    }
    noDueEl.style.display = "none";
    idx = 0;
    showCard();
  }

  function showCard() {
    const w = queue[idx];
    if (!w) return;
    cardHanzi.textContent = w.hanzi;
    cardPinyin.textContent = w.pinyin || "";
    cardMeaning.textContent = w.meaning || "";
    cardExample.textContent = w.example || "";
    cardPinyin.classList.add("hidden");
    cardMeaning.classList.add("hidden");
    cardExample.classList.add("hidden");
    cardImageContainer.innerHTML = "";
    if (w.imageUrl) {
      const img = document.createElement("img");
      img.src = w.imageUrl;
      img.alt = "img";
      img.style.width = "120px";
      img.style.height = "90px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "8px";
      img.classList.add("hidden");
      cardImageContainer.appendChild(img);
    }

    // ensure play button present and uses speechSynthesis
    playAudioBtn.classList.remove("hidden");
    playAudioBtn.onclick = () => {
      const text = w.pinyin || w.hanzi || "";
      speakChinese(text);
    };

    queueMeta.textContent = `Từ ${idx + 1}/${queue.length}`;
    cardEl.classList.remove("hidden");
  }

  // reveal meaning & auto speak
  showMeaningBtn.addEventListener("click", () => {
    cardPinyin.classList.remove("hidden");
    cardMeaning.classList.remove("hidden");
    cardExample.classList.remove("hidden");
    const img = cardImageContainer.querySelector("img");
    if (img) img.classList.remove("hidden");

    const w = queue[idx];
    if (!w) return;
    speakChinese(w.pinyin || w.hanzi || "");
  });

  // grading
  gradeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const q = Number(btn.dataset.q);
      gradeCurrent(q);
    });
  });

  function gradeCurrent(q) {
    const w = queue[idx];
    if (!w) return;
    sm2Update(w, q);
    const pos = db.words.findIndex((x) => x.id === w.id);
    if (pos >= 0) db.words[pos] = w;
    save();
    idx++;
    if (idx < queue.length) showCard();
    else {
      alert("Hoàn thành phiên ôn hôm nay 🎉");
      prepareReview();
    }
  }

  // list render & search
  function renderList(filter = "") {
    wordTableBody.innerHTML = "";
    const f = filter.trim().toLowerCase();
    const words = db.words
      .slice()
      .sort((a, b) => (a.hanzi || "").localeCompare(b.hanzi || ""));
    if (!words.length) {
      wordTableBody.innerHTML =
        '<tr><td colspan="8" class="muted">Chưa có từ nào.</td></tr>';
      return;
    }
    for (const w of words) {
      if (
        f &&
        !(
          (w.hanzi || "").toLowerCase().includes(f) ||
          (w.pinyin || "").toLowerCase().includes(f) ||
          (w.meaning || "").toLowerCase().includes(f)
        )
      )
        continue;
      const tr = document.createElement("tr");
      const nextDate = new Date((w.next || todayDays()) * msPerDay);
      const nextStr = `${nextDate.getDate()}/${
        nextDate.getMonth() + 1
      }/${nextDate.getFullYear()}`;
      tr.innerHTML = `
        <td>${escapeHtml(w.hanzi)}</td>
        <td>${escapeHtml(w.pinyin || "")}</td>
        <td>${escapeHtml(w.meaning || "")}</td>
        <td>${escapeHtml(w.example || "")}</td>
        <td>${
          w.imageUrl ? `<img src="${escapeHtml(w.imageUrl)}" alt="img">` : ""
        }</td>
        <td>${nextStr}</td>
        <td><button class="icon-btn small play-row" data-id="${
          w.id
        }">🔊</button></td>
        <td><button class="danger delete-row" data-id="${
          w.id
        }">Xóa</button></td>
      `;
      wordTableBody.appendChild(tr);
    }

    // attach play events
    $$(".play-row").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        const w = db.words.find((x) => x.id === id);
        if (!w) return;
        speakChinese(w.pinyin || w.hanzi || "");
      });
    });

    // attach delete events
    $$(".delete-row").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.id);
        if (!confirm("Xóa từ này?")) return;
        const pos = db.words.findIndex((x) => x.id === id);
        if (pos >= 0) {
          db.words.splice(pos, 1);
          save();
          renderList(searchBox.value);
        }
      });
    });
  }

  refreshListBtn.addEventListener("click", () => renderList(searchBox.value));
  searchBox.addEventListener("input", () => renderList(searchBox.value));

  // stats
  function updateStats() {
    statTotal.textContent = db.words.length;
    const due = db.words.filter((w) => (w.next || 0) <= todayDays()).length;
    statDue.textContent = due;
    dueCountEl.textContent = `(${due} từ đến hạn)`;
  }

  function drawChart() {
    const days = Array.from({ length: 7 }, (_, i) => todayDays() - (6 - i));
    const counts = days.map(
      (d) => db.words.filter((w) => (w.next || 0) === d).length
    );
    chartEl.innerHTML = "";
    const max = Math.max(...counts, 1);
    counts.forEach((c) => {
      const bar = document.createElement("div");
      bar.className = "bar";
      bar.style.height = `${(c / max) * 100}%`;
      bar.style.background = `linear-gradient(180deg, var(--main), var(--main-dark))`;
      bar.textContent = c || "";
      chartEl.appendChild(bar);
    });
  }

  // export / import / clear
  exportBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "quin_srs_cn_backup.json";
    a.click();
  });

  importBtn.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const text = await f.text();
    try {
      const data = JSON.parse(text);
      if (data.words && Array.isArray(data.words)) {
        db = data;
        save();
        renderList();
        alert("Nhập JSON thành công");
      } else alert('File không đúng định dạng (cần key "words")');
    } catch (err) {
      alert("Không đọc được file JSON");
    }
  });

  clearAllBtn.addEventListener("click", () => {
    if (!confirm("Xoá toàn bộ từ? (không thể undo)")) return;
    db.words = [];
    save();
    renderList();
    prepareReview();
  });

  // helpers
  function escapeHtml(s) {
    return String(s || "").replace(
      /[&<>"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[m])
    );
  }

  function updateDueCount() {
    updateStats();
  }

  // decorative leaf
  function startLeafFall() {
    const container = document.querySelector(".rose-container");
    if (!container) return;
    const leafImg = "img/maple-leaf.png";
    setInterval(() => {
      if (container.childElementCount > 30) return;
      const d = document.createElement("div");
      d.className = "rose";
      d.style.left = Math.random() * 100 + "vw";
      d.style.width = 14 + Math.random() * 20 + "px";
      d.style.height = d.style.width;
      d.style.backgroundImage = `url("${leafImg}")`;
      d.style.animationDuration = 4 + Math.random() * 5 + "s";
      container.appendChild(d);
      setTimeout(() => d.remove(), 9000);
    }, 450);
  }

  // initial renders
  renderList();
  updateStats();
})();
// 🌗 Theme toggle (day/night)
(() => {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;

  // load trạng thái từ localStorage
  const saved = localStorage.getItem("quin_theme_cn") || "light";
  if (saved === "dark") {
    document.body.classList.add("dark");
    btn.textContent = "☀️ Chế độ ngày";
  }

  btn.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark");
    localStorage.setItem("quin_theme_cn", isDark ? "dark" : "light");
    btn.textContent = isDark ? "☀️ Chế độ ngày" : "🌙 Chế độ đêm";
  });
})();
