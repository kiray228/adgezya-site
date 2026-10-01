(() => {
  const S = window.SITE;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ---------- откуда пришёл посетитель (Instagram, TikTok, Threads…) — запоминаем на 30 дней
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* приватный режим */ } },
  };
  const REF = [[/instagram\./, "instagram"], [/threads\.(net|com)/, "threads"], [/tiktok\./, "tiktok"],
    [/facebook\.|fb\.com/, "facebook"], [/google\./, "google"], [/yandex\.|ya\.ru/, "yandex"],
    [/2gis\./, "2gis"], [/wa\.me|whatsapp\./, "whatsapp"], [/t\.me|telegram\./, "telegram"]];
  const src = (() => {
    const p = new URLSearchParams(location.search);
    let ref = "", host = "";
    try { host = document.referrer ? new URL(document.referrer).hostname : ""; } catch (_) {}
    if (host && host !== location.hostname) ref = document.referrer; else host = "";
    const fromRef = (REF.find(([re]) => re.test(host)) || [])[1] || host.replace(/^www\./, "");
    const click = p.get("ttclid") ? "tiktok" : p.get("fbclid") ? (fromRef === "facebook" ? "facebook" : "instagram") : "";
    const source = p.get("utm_source") || click || fromRef;
    if (source) {
      const s = { source, medium: p.get("utm_medium") || "", campaign: p.get("utm_campaign") || "", referrer: ref.slice(0, 300),
        landing: (location.pathname + location.search).slice(0, 300),
        click_id: p.get("ttclid") || p.get("fbclid") || p.get("gclid") || "", t: Date.now() };
      store.set("adg_src", s);
      return s;
    }
    const saved = store.get("adg_src");
    if (saved && Date.now() - saved.t < 30 * 864e5) return saved;
    return { source: "direct", landing: location.pathname };
  })();
  let visitor = store.get("adg_v");
  if (!visitor) { visitor = Math.random().toString(36).slice(2, 12); store.set("adg_v", visitor); }

  // ---------- заявки: короткий номер уходит и в WhatsApp, и в базу — по нему CRM свяжет переписку с заявкой
  const ABC = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => ABC[b % ABC.length]).join("");
  function sendLead(lead) {
    if (!S.api) return;
    fetch(`${S.api}/lead`, {
      method: "POST", keepalive: true, headers: { "content-type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ ...lead, visitor, src }),
    }).catch(() => { /* заявка всё равно уйдёт в WhatsApp */ });
  }
  const withCode = (text, code) => `${text}\n\nЗаявка №${code}`;

  // ---------- WhatsApp
  const waUrl = (text) => `https://wa.me/${S.wa}?text=${encodeURIComponent(text)}`;
  const seriesOf = (m) => S.series[S.models[m]] || "";
  const MSG = {
    top: "Здравствуйте! Пишу с сайта «Адгезия». Хочу узнать о ваших услугах.",
    photo: "Здравствуйте! Хочу заказать изделие по фото — сейчас пришлю.",
  };

  // кнопки «Написать в WhatsApp»: на одно и то же сообщение за визит — один номер заявки
  const waCodes = {};
  document.addEventListener("click", (ev) => {
    const a = ev.target.closest("[data-wa]");
    if (!a) return;
    const text = MSG[a.dataset.wa] || MSG.top;
    if (!waCodes[text]) {
      waCodes[text] = newCode();
      sendLead({ code: waCodes[text], kind: "wa", message: withCode(text, waCodes[text]) });
    }
    a.href = waUrl(withCode(text, waCodes[text]));
    a.target = "_blank";
    a.rel = "noopener";
  });

  // ---------- фильтры каталога
  const sections = $$(".series");
  const chips = $("#chips"), sub = $("#subchips"), q = $("#q"), empty = $("#empty");
  const state = { cat: "all", series: "", q: "" };
  const stem = (w) => w.slice(0, Math.max(3, w.length - 2));

  function apply() {
    const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    const nums = words.filter((w) => /^\d+$/.test(w));
    const text = words.filter((w) => !/^\d+$/.test(w)).map(stem);
    let shown = 0;
    for (const sec of sections) {
      const ok = (state.cat === "all" || sec.dataset.cat === state.cat) && (!state.series || sec.id === state.series)
        && text.every((w) => sec.dataset.name.includes(w));
      let n = 0;
      for (const c of sec.querySelectorAll(".card")) {
        const vis = ok && nums.every((d) => c.dataset.m.includes(d));
        c.hidden = !vis;
        n += vis;
      }
      sec.hidden = !n;
      shown += n;
    }
    empty.hidden = shown > 0;
  }

  function setCat(cat) {
    state.cat = cat;
    state.series = "";
    $$(".chip", chips).forEach((c) => c.classList.toggle("on", c.dataset.cat === cat));
    if (cat === "all") {
      sub.hidden = true;
      sub.innerHTML = "";
    } else {
      const list = sections.filter((s) => s.dataset.cat === cat);
      sub.innerHTML = `<button class="chip on" data-s="">Все серии</button>` + list.map((s) =>
        `<button class="chip" data-s="${s.id}">${$("h3", s).textContent} <b>${s.querySelectorAll(".card").length}</b></button>`).join("");
      sub.hidden = list.length < 2;
    }
    apply();
  }

  const toCatalog = () => $("#catalog .filters").scrollIntoView({ behavior: "smooth", block: "start" });

  chips.addEventListener("click", (ev) => {
    const b = ev.target.closest(".chip");
    if (!b) return;
    setCat(b.dataset.cat);
    b.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    toCatalog();
  });
  sub.addEventListener("click", (ev) => {
    const b = ev.target.closest(".chip");
    if (!b) return;
    state.series = b.dataset.s;
    $$(".chip", sub).forEach((c) => c.classList.toggle("on", c === b));
    apply();
    toCatalog();
  });
  $$(".cat").forEach((t) => t.addEventListener("click", (ev) => {
    ev.preventDefault();
    q.value = state.q = "";
    setCat(t.dataset.cat);
    toCatalog();
  }));
  let timer;
  q.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.q = q.value.trim(); apply(); }, 120);
  });

  // ---------- просмотр фото
  const lb = $("#lb"), lbImg = $("#lb-img"), share = $("#lb-share");
  let cur = null, keepScroll = false;
  const visible = () => $$(".card").filter((c) => !c.hidden && !c.closest(".series").hidden);

  function show(m) {
    cur = m;
    // сразу миниатюра, крупное фото подменяет её, когда загрузится
    lbImg.src = `img/${m}.webp`;
    const big = new Image();
    big.onload = () => { if (cur === m) lbImg.src = big.src; };
    big.src = `img/full/${m}.webp`;
    lbImg.alt = `${seriesOf(m)} — модель ${m}`;
    $("#lb-model").textContent = m;
    $("#lb-series").textContent = seriesOf(m);
    share.textContent = "Ссылка";
    history.replaceState(null, "", `#m-${m}`);
  }
  function open(m) {
    show(m);
    if (!lb.open) lb.showModal();
  }
  function step(d) {
    const list = visible();
    const i = list.findIndex((c) => c.dataset.m === cur);
    const next = list[(i + d + list.length) % list.length];
    if (next) show(next.dataset.m);
  }
  // после закрытия (кнопкой, фоном или Esc) убираем #m-… из адреса и возвращаемся к карточке
  function closed() {
    if (!location.hash.startsWith("#m-")) return;
    history.replaceState(null, "", location.pathname + location.search);
    if (keepScroll) { keepScroll = false; return; }
    const card = document.getElementById(`m-${cur}`);
    if (card) card.scrollIntoView({ block: "center" });
  }
  function close() {
    lb.close();
    closed();
  }
  lb.addEventListener("close", closed);

  $("#list").addEventListener("click", (ev) => {
    const ph = ev.target.closest(".ph");
    if (ph) open(ph.closest(".card").dataset.m);
    const pr = ev.target.closest("[data-price]");
    if (pr) toForm(pr.dataset.price);
  });
  $("#lb-price").addEventListener("click", () => {
    keepScroll = true;
    close();
    toForm(cur);
  });
  lb.addEventListener("click", (ev) => {
    if (ev.target === lb || ev.target.closest("[data-close]")) close();
    else if (ev.target.closest(".prev")) step(-1);
    else if (ev.target.closest(".next")) step(1);
  });
  lb.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowLeft") step(-1);
    if (ev.key === "ArrowRight") step(1);
  });
  let x0 = null;
  $(".lb-img").addEventListener("touchstart", (ev) => { x0 = ev.touches[0].clientX; }, { passive: true });
  $(".lb-img").addEventListener("touchend", (ev) => {
    if (x0 === null) return;
    const dx = ev.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
    x0 = null;
  });
  share.addEventListener("click", async () => {
    const url = `${location.origin}${location.pathname}#m-${cur}`;
    const title = `Модель ${cur} — ${seriesOf(cur)}`;
    try {
      if (navigator.share) return await navigator.share({ title, url });
      await navigator.clipboard.writeText(url);
      share.textContent = "Скопировано";
    } catch (_) { /* пользователь отменил */ }
  });

  // ---------- форма расчёта
  const form = $("#calcform"), picked = $("#picked");

  // «Цена» у модели: переносим к заявке и заполняем модель и раздел
  function toForm(m) {
    form.model.value = m;
    const cat = S.cats[S.models[m]];
    if (cat) form.type.value = cat;
    picked.innerHTML = `<img src="img/${m}.webp" alt=""><span>Модель <b>${m}</b> — ${seriesOf(m)}<br>`
      + `<small>Укажите размеры и район — и отправьте заявку</small></span>`;
    picked.hidden = false;
    // мгновенно: плавная прокрутка через весь каталог слишком долгая
    const top = $("#calc").getBoundingClientRect().top + scrollY - 64;
    window.scrollTo({ top, behavior: "instant" });
    form.classList.remove("flash");
    void form.offsetWidth;
    form.classList.add("flash");
    setTimeout(() => form.len.focus({ preventScroll: true }), 700);
  }
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const v = (k) => (f.get(k) || "").toString().trim();
    const lines = ["Здравствуйте! Хочу рассчитать стоимость.", `Что нужно: ${v("type")}`];
    if (v("len")) lines.push(`Длина: ${v("len")} м`);
    if (v("h")) lines.push(`Высота: ${v("h")} м`);
    if (v("model")) lines.push(`Модель из каталога: ${v("model")}${S.models[v("model")] ? ` (${seriesOf(v("model"))})` : ""}`);
    if (f.get("gate")) lines.push("Нужны ворота или калитка");
    if (v("addr")) lines.push(`Объект: ${v("addr")}`);
    if (v("name")) lines.push(`Меня зовут ${v("name")}`);
    const code = newCode();
    const message = withCode(lines.join("\n"), code);
    sendLead({ code, kind: "form", model: v("model"), category: v("type"), len: v("len"), h: v("h"), gate: !!f.get("gate"),
      addr: v("addr"), name: v("name"), message, website: v("website") });
    window.open(waUrl(message), "_blank", "noopener");
  });

  // ---------- ссылки вида #m-8046 (модель) и #s12 (серия) из постов
  function fromHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    const m = h.match(/^m-(\d+)$/);
    if (m && S.models[m[1]]) {
      document.getElementById(h).scrollIntoView({ block: "center" });
      open(m[1]);
    } else if (S.series[h]) {
      const sec = document.getElementById(h);
      setCat(sec.dataset.cat);
      state.series = h;
      $$(".chip", sub).forEach((c) => c.classList.toggle("on", c.dataset.s === h));
      apply();
      sec.scrollIntoView();
    }
  }
  fromHash();
})();
