(function () {
  const d = window.ADC_PAGES[window.ADC_PAGE];
  const asset = (name) => `assets/${name}`;
  const hero = d.hero === false ? null : (d.hero || (d.page >= 4 ? "source-061.png" : "source-000.png"));
  const rows = (items, classes = "") => items.map((row, index) => `<tr>${row.map((cell, i) => `<td class="${classes && i > 0 && index < 2 ? classes : ""}">${cell}</td>`).join("")}</tr>`).join("");
  const list = (items) => `<ul class="data-list">${items.map(x => `<li>${x}</li>`).join("")}</ul>`;
  const panel = (title, content, cls = "") => `<section class="panel ${cls}"><div class="bar">${title}</div>${content}</section>`;
  const velocity = [["Ceiling", ...(d.ceiling || (d.page === 1 || d.page === 3 ? ["62","50","42"] : ["60","48","40"])), ""], ...d.velocity];
  const gunSight = d.gun.find(item => item.startsWith("Gunsight"));
  const shots = d.gun.find(item => item.startsWith("Shots"));
  const rollToHit = d.gun.find(item => item.startsWith("Roll to Hit"));
  const radarRanging = gunSight ? gunSight.replace(/^Gunsight\s*&nbsp;&nbsp;\s*/, "") : d.gun.find(item => item.startsWith("Radar Ranging"));
  const shotsValue = shots?.replace("Shots :", "").trim();
  const hasShots = d.shots?.length || (shotsValue && shotsValue !== "-");
  const gunSummary = d.gun.filter(item => item !== gunSight && item !== shots && item !== rollToHit && item !== radarRanging);
  const technology = [...(d.technology || []), ...(d.technologyLabels || [])];
  const radarImages = d.radarImages || (d.radarImage ? [d.radarImage] : []);
  document.title = `${d.title} | Aircraft ADC`;
  document.body.innerHTML = `<main class="sheet page-${d.page} ${d.theme === "soviet" ? "theme-soviet" : ""}">
    <section class="content-box upper-box">
    <section class="top-region">
      <section class="panel title"><h1 class="${d.title.length > 18 ? "long-title" : ""}">${d.title}</h1><div class="crew">Crew : ${d.crew}</div></section>
      <section class="panel hero">${hero ? `<img src="${asset(hero)}" alt="${d.title} aircraft">` : ""}<div class="hero-facts"><div>Cruise Speed <b>${d.cruise}</b></div><div><span class="down">Blind/Rest. Arcs</span></div><div>Visibility <b>${d.visibility}</b></div></div><div class="hero-icons"><div>Size<img src="${asset(d.size)}" alt="Aircraft size icon"></div><div>Vulnerability<img src="${asset(d.vulnerability)}" alt="Aircraft vulnerability icon"></div><div>Blind / Restricted Arcs${d.arc ? `<img src="${asset(d.arc)}" alt="Blind and restricted arcs diagram">` : ""}</div></div></section>
      ${panel("MANEUVER COSTS : HFP/Decel", d.maneuver.slice(1).map(x => `<div>${x}</div>`).join(""), "maneuver")}
      ${panel("POWER CHART", `<table><caption>Power chart</caption><thead><tr><th>Power</th><th>CL</th><th>1/2</th><th>DT</th><th>Fuel</th></tr></thead><tbody>${d.power.map((row, rowIndex) => `<tr>${row.map((cell, cellIndex) => `<td class="${cellIndex > 0 ? (rowIndex < 2 ? "up" : rowIndex > 2 ? "down" : "") : ""}">${cell}</td>`).join("")}</tr>`).join("")}</tbody></table><div class="note">Smoker at MIL power</div>`, "power")}
      ${panel("TURN DRAG CHART", `<table><caption>Turn drag chart</caption><thead><tr><th>Rate</th><th>CL</th><th>1/2</th><th>DT</th></tr></thead><tbody>${rows(d.drag)}</tbody></table><div class="note">${d.note}</div>`, "drag")}
    </section>
    <section class="middle-region">
      ${panel("MINIMUM-MAXIMUM VELOCITY CHART", `<table><caption>Minimum-maximum velocity chart</caption><thead><tr><th>Configuration</th><th>CL</th><th>1/2</th><th>DT</th><th>Dive Speed</th></tr></thead><tbody>${rows(velocity)}</tbody></table>`, "velocity")}
      ${panel("CLIMB CAPABILITY CHART", `<table><caption>Climb capability chart</caption><thead><tr><th>Config</th><th colspan="2">CL</th><th colspan="2">1/2</th><th colspan="2">DT</th></tr><tr><th>Climb Speed : ${d.climbSpeed}</th><th>AB</th><th>Other</th><th>AB</th><th>Other</th><th>AB</th><th>Other</th></tr></thead><tbody>${rows(d.climb)}</tbody></table>`, "climb")}
    </section>
    </section>
    <section class="content-box lower-box">
      <section class="lower-region">
       <section class="details"><div class="detail-stack">${panel("RADAR DATA", `<div class="radar-type">${d.radar[0]}</div><div class="diagram radar-diagram radar-count-${radarImages.length}">${radarImages.map(name => `<img src="${asset(name)}" alt="Radar arcs diagram">`).join("")}</div><div class="radar-keys">${d.radar.slice(1).map(x => `<div>${x}</div>`).join("")}</div>`, "radar")}${panel("INTERNAL GUN DATA", `${list(gunSummary)}${d.rollToHit ? `<table class="gun-table"><thead><tr><th>Roll to Hit</th><th>Range 0</th><th>Range 1</th><th>Range 2</th></tr></thead><tbody><tr><td></td><td class="range-0">${d.rollToHit[0]}</td><td class="range-1">${d.rollToHit[1]}</td><td class="range-2">${d.rollToHit[2]}</td></tr></tbody></table>` : ""}${radarRanging ? `<div class="radar-ranging">${radarRanging}</div>` : ""}<div class="gun-visuals">${gunSight ? `<div><span>Gunsight</span>${d.gunsight ? `<img src="${asset(d.gunsight)}" alt="Gunsight diagram">` : ""}</div>` : ""}${hasShots ? `<div><span>Shots</span>${d.shots?.length ? d.shots.map(name => `<img src="${asset(name)}" alt="Shot marker">`).join("") : `<small>${shotsValue}</small>`}</div>` : ""}</div>`, "guns")}</div><div class="detail-stack">${panel("ECM DATA", list(d.ecm))}${panel("TECHNOLOGY", `<div class="tech-art tech-count-${technology.length}">${technology.map(item => item.includes(".") ? `<img src="${asset(item)}" alt="Technology indicator">` : `<span>${item}</span>`).join("")}</div>`, "tech")}${panel("BOMB SYSTEM", `<div class="note bomb-value">${d.bomb}</div>`, "bomb")}</div></section>
    <section class="weapon"><section class="panel weapon-diagram"><div class="bar">WEAPON STATIONS DIAGRAM</div><img src="${asset(d.station)}" alt="Weapon stations diagram"></section><section class="panel limits"><div class="bar">CONFIGURATION POINTS LIMITS</div><div class="limit-grid"><div class="a">CL<br><b>${d.limits[0]}</b></div><div class="b">1/2<br><b>${d.limits[1]}</b></div><div class="c">DT<br><b>${d.limits[2]}</b></div></div><p><b>Load Limit :</b> ${d.loadLimit}<br><b>Internal Fuel :</b> ${d.fuel}</p><p><b>Station Limits :</b><br>${d.stations}</p></section></section>
       ${panel("NOTES AND VARIANTS", `<ol>${d.notes.map(x => `<li>${x}</li>`).join("")}</ol>${d.noteImages?.length ? `<div class="note-images">${d.noteImages.map(name => `<img src="${asset(name)}" alt="Variant note indicator">`).join("")}</div>` : ""}`, "notes")}
      ${panel("ALLOWED STATIONS LOADS", d.loads.map(x => `<p>${x}</p>`).join(""), "loads")}
      </section>
    </section>
    <footer class="source"><span>Aircraft ADC V4 · Source PDF page ${d.page}</span><span>Redesigned HTML · Offline A4 card</span></footer>
  </main>`;

  const notesPanel = document.querySelector(".notes");
  const sheet = document.querySelector(".sheet");
  const pageHeightMarker = document.createElement("div");
  pageHeightMarker.style.cssText = "position:absolute;height:297mm;visibility:hidden";
  document.body.append(pageHeightMarker);
  const pageHeight = pageHeightMarker.getBoundingClientRect().height;
  pageHeightMarker.remove();

  if (notesPanel && sheet) {
    const contentBottom = () => Math.max(...[...notesPanel.querySelectorAll("ol, .note-images")].map(item => item.getBoundingClientRect().bottom));
    const panelBottom = () => notesPanel.getBoundingClientRect().bottom;
    if (panelBottom() - contentBottom() > 18) {
      notesPanel.classList.add("roomy");
      if (contentBottom() > panelBottom() - 2 || sheet.getBoundingClientRect().height > pageHeight + 1) {
        notesPanel.classList.remove("roomy");
      }
    }
  }
}());
