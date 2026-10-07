(() => {
  const data = window.SCHEDULE_DATA;
  const dayNames = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const schedule = document.querySelector("#schedule");
  const weekTitle = document.querySelector("#week-title");
  const weekRange = document.querySelector("#week-range");
  const weekSelect = document.querySelector("#week-select");
  const courseCount = document.querySelector("#course-count");
  const dutyCount = document.querySelector("#duty-count");
  const conflictSummary = document.querySelector("#conflict-summary");
  const eventDialog = document.querySelector("#event-dialog");
  const infoDialog = document.querySelector("#info-dialog");

  const DAY_MS = 86_400_000;
  const termStart = dateFromIso(data.weekOneMonday);
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const todayIso = isoFromDate(todayUtc);
  const calculatedWeek = Math.floor((todayUtc - termStart) / (7 * DAY_MS)) + 1;
  const initialWeek = clamp(calculatedWeek, 1, data.weekCount);
  let selectedWeek = initialWeek;

  for (let week = 1; week <= data.weekCount; week += 1) {
    const option = document.createElement("option");
    option.value = week;
    option.textContent = `第 ${week} 周`;
    weekSelect.append(option);
  }

  document.querySelector("#previous-week").addEventListener("click", () => setWeek(selectedWeek - 1));
  document.querySelector("#next-week").addEventListener("click", () => setWeek(selectedWeek + 1));
  document.querySelector("#today-button").addEventListener("click", () => setWeek(initialWeek));
  weekSelect.addEventListener("change", () => setWeek(Number(weekSelect.value)));
  document.querySelector("#info-button").addEventListener("click", () => infoDialog.showModal());

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function dateFromIso(value) {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  }

  function isoFromDate(value) {
    return new Date(value).toISOString().slice(0, 10);
  }

  function displayDate(value) {
    const date = new Date(value);
    return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
  }

  function weekDayDate(week, day) {
    return termStart + ((week - 1) * 7 + day - 1) * DAY_MS;
  }

  function paletteIndex(name) {
    return [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4;
  }

  function overlaps(a, b) {
    return a.startPeriod <= b.endPeriod && b.startPeriod <= a.endPeriod;
  }

  function withLanes(events) {
    return events.map((event, index) => {
      const peers = events.filter((other, otherIndex) => otherIndex !== index && other.day === event.day && overlaps(event, other));
      if (!peers.length) return { ...event, overlap: false, lane: 0 };
      return { ...event, overlap: true, lane: event.type === "duty" ? 1 : 0 };
    });
  }

  function eventLabel(event) {
    return event.type === "course" ? event.name : event.label;
  }

  function eventMeta(event) {
    if (event.type === "course") return event.room;
    return event.time;
  }

  function setWeek(week) {
    selectedWeek = clamp(week, 1, data.weekCount);
    weekSelect.value = String(selectedWeek);
    render();
  }

  function render() {
    schedule.replaceChildren();
    const start = weekDayDate(selectedWeek, 1);
    const end = weekDayDate(selectedWeek, 7);
    weekTitle.textContent = `第 ${selectedWeek} 周`;
    weekRange.textContent = `${displayDate(start)} — ${displayDate(end)}`;

    const courses = data.courses.filter((event) => selectedWeek >= event.weekStart && selectedWeek <= event.weekEnd);
    const duties = data.duties.filter((event) => event.week === selectedWeek);
    const events = withLanes([...courses, ...duties]);
    const offDays = data.daysOff.filter((item) => item.week === selectedWeek);

    courseCount.textContent = String(courses.length);
    dutyCount.textContent = String(duties.length);
    conflictSummary.hidden = !events.some((event) => event.overlap);

    const corner = document.createElement("div");
    corner.className = "corner";
    corner.style.gridColumn = "1";
    corner.style.gridRow = "1";
    corner.textContent = "节次";
    schedule.append(corner);

    for (let day = 1; day <= 7; day += 1) {
      const dateValue = weekDayDate(selectedWeek, day);
      const iso = isoFromDate(dateValue);
      const dayOff = offDays.find((item) => item.day === day);
      const header = document.createElement("div");
      header.className = `day-header${day >= 6 ? " weekend" : ""}${iso === todayIso ? " today" : ""}`;
      header.style.gridColumn = String(day + 1);
      header.style.gridRow = "1";
      header.innerHTML = `<span>${dayNames[day - 1]}</span><span class="date-number">${new Date(dateValue).getUTCDate()}</span>${dayOff ? `<span class="holiday-label">${dayOff.note.replace("放假", "")}</span>` : ""}`;
      schedule.append(header);
    }

    for (let period = 1; period <= 10; period += 1) {
      const label = document.createElement("div");
      label.className = "period-label";
      label.style.gridColumn = "1";
      label.style.gridRow = String(period + 1);
      label.innerHTML = `<strong>${period}</strong><small>${period <= 4 ? "上午" : period <= 8 ? "下午" : "晚上"}</small>`;
      schedule.append(label);

      for (let day = 1; day <= 7; day += 1) {
        const iso = isoFromDate(weekDayDate(selectedWeek, day));
        const cell = document.createElement("div");
        cell.className = `grid-cell${day >= 6 ? " weekend" : ""}${iso === todayIso ? " today" : ""}`;
        cell.style.gridColumn = String(day + 1);
        cell.style.gridRow = String(period + 1);
        schedule.append(cell);
      }
    }

    for (const event of events) {
      const button = document.createElement("button");
      const palette = event.type === "course" ? ` palette-${paletteIndex(event.name)}` : "";
      const overlap = event.overlap ? ` overlap lane-${event.lane}` : "";
      button.type = "button";
      button.className = `event-card ${event.type}${palette}${overlap}`;
      button.style.gridColumn = String(event.day + 1);
      button.style.gridRow = `${event.startPeriod + 1} / ${event.endPeriod + 2}`;
      button.innerHTML = `<span class="event-name">${eventLabel(event)}</span><span class="event-meta">${eventMeta(event)}</span>`;
      button.setAttribute("aria-label", `${eventLabel(event)}，${eventMeta(event)}`);
      button.addEventListener("click", () => showEvent(event));
      schedule.append(button);
    }
  }

  function showEvent(event) {
    const dateValue = weekDayDate(selectedWeek, event.day);
    const details = [];
    document.querySelector("#dialog-kicker").textContent = event.type === "course" ? "课程" : "工作室值班";
    document.querySelector("#dialog-title").textContent = eventLabel(event);
    if (event.type === "course") {
      details.push(["日期", `${displayDate(dateValue)} · ${dayNames[event.day - 1]}`]);
      details.push(["节次", `第 ${event.startPeriod}—${event.endPeriod} 节`]);
      details.push(["地点", event.room]);
      details.push(["教师", event.teacher]);
      details.push(["周次", event.weekStart === event.weekEnd ? `第 ${event.weekStart} 周` : `第 ${event.weekStart}—${event.weekEnd} 周`]);
    } else {
      details.push(["日期", `${displayDate(dateValue)} · ${dayNames[event.day - 1]}`]);
      details.push(["时间", event.time]);
      details.push(["地点", "工作室"]);
    }
    document.querySelector("#dialog-details").innerHTML = details.map(([term, value]) => `<dt>${term}</dt><dd>${value}</dd>`).join("");
    eventDialog.showModal();
  }

  setWeek(initialWeek);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
})();
