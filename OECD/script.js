
let allData = [];
let years = [];
let measures = [];
let currentYear = '';
let currentMeasure = 'STRI';
let gdpData = {};
let populationData = {};
let hoveredCountry = null;
let selectedCountries = [];

const svg = d3.select("#map")
  .attr("preserveAspectRatio", "xMidYMid meet")
  .attr("viewBox", "0 0 960 500");

const width = 960;
const height = 500;

const projection = d3.geoNaturalEarth1().scale(160).translate([width / 2, height / 2]);
const path = d3.geoPath().projection(projection);
const g = svg.append("g");

const zoom = d3.zoom()
  .scaleExtent([1, 8])
  .on("zoom", (event) => {
    g.attr("transform", event.transform);
  });

svg.call(zoom);

const measureLabels = {
  "CLAS1_9": "Intellectual property rights",
  "CLAS1_8": "Payment system",
  "CLAS1_7": "Electronic transactions",
  "CLAS1_6": "Infrastructure and connectivity",
  "CLAS1_10": "Other barriers affecting trade in digitally enabled services",
  "STRI": "Services trade restrictiveness index"
};

function updateCountryList() {
  const tbody = document.querySelector("#countryTable tbody");
  tbody.innerHTML = "";

  const filtered = allData
    .filter(d => d.MEASURE === currentMeasure && +d.TIME_PERIOD === currentYear)
    .map(d => ({
      country: countryCodeData[d.REF_AREA]?.name || d.REF_AREA,
      value: +d.OBS_VALUE
    }))
    .sort((a, b) => a.country.localeCompare(b.country));
    console.log("Filtered rows", filtered);

    filtered.forEach(row => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${row.country}</td><td style="text-align:right;">${row.value.toFixed(2)}</td>`;
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => {
        const code = Object.keys(countryCodeData).find(k => countryCodeData[k].name === row.country);
        if (code && !selectedCountries.includes(code)) {
          selectedCountries.push(code);
          selectedCountries = [...new Set(selectedCountries)];  // 重複除去の保険
          updateLineChart();
        }
      });
      tbody.appendChild(tr);
    });
}

function initMeasureSelect(uniqueMeasures) {
  const select = document.getElementById('measureSelect');
  uniqueMeasures.forEach(m => {
    const option = document.createElement('option');
    option.value = m;
    option.textContent = measureLabels[m] || m;
    select.appendChild(option);
  });
  select.value = currentMeasure;
  select.addEventListener('change', function () {
    currentMeasure = this.value;
    //selectedCountries = [];          // 🟢 折れ線グラフ対象国リストをリセット
    updateMapColors();
    updateLegend();
    updateCountryList(); // 🟢 追加！
    updateLineChart();              // 🟢 グラフをリセットして再描画（空）
    // 凡例描画
    const legend = svgLC.append("g").attr("transform", `translate(${width - 100}, 10)`);
  });
}

function getMeasureValue(alpha3) {
  if (!alpha3) return null;
  const entry = allData.find(d =>
    d.REF_AREA === alpha3 &&
    +d.TIME_PERIOD === currentYear &&
    d.MEASURE === currentMeasure
  );
  return entry && entry.OBS_VALUE ? +entry.OBS_VALUE : null;
}

function showTooltip(countryId, event = null) {
  if (!countryId) return;
  const code = countryId;
  const name = countryCodeData[code]?.name || code;
  const flag = countryCodeData[code]?.alpha2
    ? `<img src="https://flagcdn.com/w40/${countryCodeData[code].alpha2}.png">`
    : "";
  const value = getMeasureValue(code);
  const gdp = gdpData[code] ? `$${(+gdpData[code]).toLocaleString()}` : "N/A";
  const pop = populationData[code] ? (+populationData[code]).toLocaleString() : "N/A";

  const tooltip = d3.select("#tooltip")
    .html(`${flag}<br><b>${name}</b><br>GDP: ${gdp}<br>POP: ${pop}<br>MEASURE: ${value !== null ? value.toFixed(2) : "N/A"}`)
    .style("opacity", 1);

  const x = event?.pageX ?? 100;
  const y = event?.pageY ?? 100;

  tooltip.style("left", (x + 15) + "px")
         .style("top", (y - 28) + "px");
}

function hideTooltip() {
  d3.select("#tooltip").style("opacity", 0);
}

function updateMapColors() {
  const filtered = allData.filter(d => d.MEASURE === currentMeasure && +d.TIME_PERIOD === currentYear);
  const values = filtered.map(d => +d.OBS_VALUE).filter(v => !isNaN(v));
  const extent = d3.extent(values);
  const colorScale = d3.scaleSequential(d3.interpolateBlues).domain(extent);

  g.selectAll("path")
    .transition()
    .duration(300)
    .attr("fill", d => {
      if (!d || !d.id) return "#ccc";
      if (d.id === hoveredCountry) return "yellow";
      const val = getMeasureValue(d.id);
      return val != null ? colorScale(val) : "#ccc";
    })
    .attr("stroke", "#999")
    .attr("stroke-width", 0.5);
}

function updateLegend() {
  d3.select("#legend").remove();
  const filtered = allData.filter(d => d.MEASURE === currentMeasure && +d.TIME_PERIOD === currentYear);
  const values = filtered.map(d => +d.OBS_VALUE).filter(v => !isNaN(v));
  const extent = d3.extent(values);
  const colorScale = d3.scaleSequential(d3.interpolateBlues).domain(extent);

  const legendHeight = 200;
  const legendWidth = 10;

  const legendSvg = svg.append("g")
    .attr("id", "legend")
    .attr("transform", `translate(40, ${height - legendHeight - 50})`);

  const defs = legendSvg.append("defs");
  const linearGradient = defs.append("linearGradient")
    .attr("id", "legend-gradient")
    .attr("x1", "0%").attr("y1", "100%")
    .attr("x2", "0%").attr("y2", "0%");

  linearGradient.selectAll("stop")
    .data(d3.range(0, 1.01, 0.01))
    .enter().append("stop")
    .attr("offset", d => `${d * 100}%`)
    .attr("stop-color", d => colorScale(d * (extent[1] - extent[0]) + extent[0]));

  legendSvg.append("rect")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .style("fill", "url(#legend-gradient)");

  const legendScale = d3.scaleLinear()
    .domain(extent)
    .range([legendHeight, 0]);

  const legendAxis = d3.axisRight(legendScale).ticks(5).tickFormat(d3.format(".2f"));

  legendSvg.append("g")
    .attr("transform", `translate(${legendWidth}, 0)`)
    .call(legendAxis);
}

const initialTransform = d3.zoomIdentity;
svg.call(zoom).call(zoom.transform, initialTransform);


document.getElementById("resetZoomButton").onclick = () => {
  svg.transition().duration(750).call(zoom.transform, initialTransform);
};

async function fetchWorldBankData(indicator, targetObj) {
  for (const alpha3 in countryCodeData) {
    const url = `https://api.worldbank.org/v2/country/${alpha3.toLowerCase()}/indicator/${indicator}?format=json&per_page=1&date=2022`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (Array.isArray(json) && json[1] && json[1][0]) {
        targetObj[alpha3] = json[1][0].value;
      }
    } catch {
      console.warn(`Failed to load ${indicator} for ${alpha3}`);
    }
  }
}

function wrapText(text, width) {
  text.each(function () {
    const textEl = d3.select(this);
    const words = textEl.text().split(/\s+/).reverse();
    let word, line = [], lineNumber = 0;
    const lineHeight = 1.1; // em
    const y = textEl.attr("y");
    const dy = parseFloat(textEl.attr("dy") || 0);

    let tspan = textEl.text(null)
      .append("tspan")
      .attr("x", textEl.attr("x"))
      .attr("y", y)
      .attr("dy", dy + "em");

    while (word = words.pop()) {
      line.push(word);
      tspan.text(line.join(" "));
      if (tspan.node().getComputedTextLength() > width) {
        line.pop();
        tspan.text(line.join(" "));
        line = [word];
        tspan = textEl.append("tspan")
          .attr("x", textEl.attr("x"))
          .attr("y", y)
          .attr("dy", ++lineNumber * lineHeight + dy + "em")
          .text(word);
      }
    }
  });
}

function updateLineChart() {
  console.log("🟡 selectedCountries", selectedCountries);

  const chartData = selectedCountries.flatMap(code => {
    const raw = allData
      .filter(d => d.REF_AREA === code && d.MEASURE === currentMeasure && !isNaN(+d.OBS_VALUE));

      console.log(`📦 Raw data for ${code}:`, raw.map(d => [d.TIME_PERIOD, d.OBS_VALUE]));

      const deduped = new Map();
      raw.forEach(d => {
        const year = +d.TIME_PERIOD;
        const value = +d.OBS_VALUE;
        if (!isNaN(value)) {
          const key = `${d.REF_AREA}_${year}`;
          if (!deduped.has(key)) {
            deduped.set(key, {
              year: year,
              value: value,
              country: code
            });
          }
        }
      });

    return Array.from(deduped.values());
  });

  // ✅ ここに追記！
  console.log("🔍 chartData", chartData);
  const countryGroup = d3.group(chartData, d => d.country);
  console.log("📊 countryGrouped keys", Array.from(countryGroup.keys()));

  // すべてのデータから年と値の範囲を取得
  const fallbackYears = [...new Set(allData.map(d => +d.TIME_PERIOD))].sort();
  const fallbackYearRange = d3.extent(fallbackYears);
  const fallbackValueRange = d3.extent(allData.map(d => +d.OBS_VALUE).filter(v => !isNaN(v)));
  // データがない場合にも軸を表示するための fallback 範囲
  const xDomain = chartData.length > 0
    ? d3.extent(chartData, d => d.year)
    : fallbackYearRange;

  console.log("📈 xDomain:", xDomain);

  const yDomain = chartData.length > 0
    ? d3.extent(chartData, d => d.value)
    : fallbackValueRange;

  const svgLC = d3.select("#lineChart");
  const margin = { top: 40, right: 80, bottom: 40, left: 60 }; // グラフを描くサイズの調整
  const svgLCNode = document.getElementById("lineChart");
  const width = svgLCNode.getBoundingClientRect().width - margin.left - margin.right;
  const height = +svgLC.attr("height") - margin.top - margin.bottom;
  // ✅ グラフ部分のみ削除（<g>ごと）
  svgLC.select("g").remove();

  const x = d3.scaleLinear()
    .domain(xDomain)
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain([Math.min(0, yDomain[0]), yDomain[1]]).nice()
    .range([height, 0]);

  const g = svgLC.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  g.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(5).tickFormat(d3.format("d")));
  g.append("g").call(d3.axisLeft(y));
  // X軸ラベル
  g.append("text")
    .attr("x", width / 2)
    .attr("y", height + margin.bottom - 6)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .text("Year");

  // Y軸ラベル
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 20)
    .attr("x", -height / 2)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .text("Index Value");

  const line = d3.line()
    .defined(d => d.value !== undefined && !isNaN(d.value))
    .x(d => x(d.year))
    .y(d => y(d.value));

  console.log("🟡 chartData years:", chartData.map(d => d.year));
  console.log("🟡 chartData sample:", chartData.slice(0, 5)); // 確認用に少し出す

  const countryGrouped = d3.group(chartData, d => d.country);
  Array.from(countryGrouped.entries()).forEach(([country, values], i) => {
    const sortedValues = values.sort((a, b) => a.year - b.year);  // ⬅️ ソートを追加

    g.append("path")
      .datum(sortedValues)  // ← 正しくソート済みのデータを使う
      .attr("fill", "none")
      .attr("stroke", d3.schemeCategory10[i % 10])
      .attr("stroke-width", 2)
      .attr("d", line)
      .attr("stroke-dasharray", function() {
        const length = this.getTotalLength();
        return `${length} ${length}`;
      })
      .attr("stroke-dashoffset", function() {
        return this.getTotalLength();
      })
      .transition()
      .duration(1000)
      .attr("stroke-dashoffset", 0);
    
    // ✅ 各点に丸を描画
    sortedValues.forEach((d, j) => {
      const color = d3.schemeCategory10[i % 10];
      const cx = x(d.year);
      const cy = y(d.value);

        // 国名ラベル（上段）
      const labelName = g.append("text")
        .attr("x", cx + 10)
        .attr("y", cy - 22)
        .attr("text-anchor", "start")
        .attr("font-size", "11px")
        .attr("fill", color)
        .style("opacity", 0)
        .style("pointer-events", "none")
        .text(`${countryCodeData[d.country]?.name || d.country}`).call(wrapText, 60);
    
      // ラベル（最初は非表示）※ pointer-events: none を追加
      //const label = g.append("text")
      //  .attr("x", cx + 14)
      //  .attr("y", cy - 14)
      //  .attr("text-anchor", "middle")
      //  .attr("font-size", "12px")
      //  .attr("fill", color)
      //  .style("opacity", 0)
      //  .style("pointer-events", "none") // ← 重要
      //  .text(`${countryCodeData[d.country]?.name || d.country}`);
        //.text(`${countryCodeData[d.country]?.name || d.country}: ${d.value.toFixed(2)}`);

      // 国名の行数に応じて y位置をずらす
      //const lineCount = (countryCodeData[d.country]?.name || d.country).split(" ").length;
      const tspans = labelName.selectAll("tspan");
      const lineCount = tspans.size();
      const lineSpacing = 12;  // 1行あたりの高さ

      // 値用ラベル（下段）
      const labelValue = g.append("text")
        .attr("x", cx + 10)
        .attr("y", cy - 22 + lineCount * lineSpacing)  // ← 国名の行数に応じて下にずらす
        .attr("text-anchor", "start")
        .attr("font-size", "11px")
        .attr("fill", color)
        .style("opacity", 0)
        .style("pointer-events", "none")
        .text(`${d.value.toFixed(2)}`);
      
      // 点（マウスホバー時にラベル表示）
      const circle = g.append("circle")
        .attr("cx", cx)
        .attr("cy", cy)
        .attr("r", 4)
        .attr("fill", color)
        .attr("stroke", "white")
        .attr("stroke-width", 3)
        .style("pointer-events", "all") // 念のため明示
        .on("mouseover", function (event) {
          d3.select(this).raise().transition().duration(100).attr("r", 8);
          labelName.transition().duration(100).style("opacity", 1);
          labelValue.transition().duration(100).style("opacity", 1);
          //showTooltip(d.country, event);
        })
        .on("mouseout", function () {
          d3.select(this).transition().duration(100).attr("r", 4);
          labelName.transition().duration(100).style("opacity", 0);
          labelValue.transition().duration(100).style("opacity", 0);
          //hideTooltip();
        });
        //.on("mouseover", function (event) {
        //  d3.select(this).raise().transition().duration(100).attr("r", 8);
        //  label.transition().duration(100).style("opacity", 1);
        //  showTooltip(d.country, event);  // ← 追加
        //})
        //.on("mouseout", function () {
        //  d3.select(this).transition().duration(100).attr("r", 4);
        //  label.transition().duration(100).style("opacity", 0);
        //  hideTooltip();  // ← 追加
        //});
      });

    const last = sortedValues[sortedValues.length - 1];

    // 国名ラベル
    // g.append("text")
    //   .attr("x", width + 30)
    //   .attr("y", y(last.value))
    //   .attr("dy", "0.35em")
    //   .style("font-size", "20px")
    //   .style("fill", d3.schemeCategory10[i % 10])
    //   .text(countryCodeData[country]?.name || country);
  });

  // HTML側の凡例描画
  const legendContainer = document.getElementById("lineChartLegend");
  legendContainer.innerHTML = "";  // 一度リセット

  Array.from(countryGrouped.entries()).forEach(([country, values], i) => {
    const color = d3.schemeCategory10[i % 10];
    const label = countryCodeData[country]?.name || country;

    const item = document.createElement("span");
    item.innerHTML = `
      <span style="display:inline-block;width:12px;height:12px;background:${color};margin-right:5px;"></span>
      <span style="display:inline-flex; align-items:center; gap:6px;">
      ${label}
      <button style="
        margin-left: 6px;
        background-color: #e53935;
        color: white;
        border: none;
        border-radius: 50%;
        width: 14px;
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: bold;
        cursor: pointer;
        transition: background-color 0.2s;
      " onmouseover="this.style.backgroundColor='#d32f2f'" onmouseout="this.style.backgroundColor='#e53935'">×</button>
    `;
    item.style.marginRight = "15px";
    item.style.cursor = "pointer";
    item.style.fontSize = "14px";
    item.querySelector("button").onclick = () => {
      selectedCountries = selectedCountries.filter(c => c !== country);
      updateLineChart();
    };
    legendContainer.appendChild(item);
  });
}

function resetLineChart() {
  selectedCountries = [];
  updateLineChart();
}

async function drawMap() {
  const response = await fetch('./digital_trade_index_all_data.json');
  allData = await response.json();
  years = [...new Set(allData.map(d => +d.TIME_PERIOD))].sort();
  currentYear = years[0];
  currentYear = years[years.length - 1];  // 最新年に固定
  measures = [...new Set(allData.map(d => d.MEASURE))].sort();
  initMeasureSelect(measures);
  updateLegend();

  updateCountryList();  // ←国別リストを初期表示

  await fetchWorldBankData('NY.GDP.MKTP.CD', gdpData);
  await fetchWorldBankData('SP.POP.TOTL', populationData);
  const world = await d3.json("world.geojson");

  g.selectAll("path")
    .data(world.features)
    .join("path")
    .attr("d", path)
    .attr("fill", "#ccc")
    .attr("stroke", "#999")
    .attr("stroke-width", 0.5)
    .on("mouseover", (event, d) => {
      if (!d || !d.id) return;
      hoveredCountry = d.id;
      showTooltip(d.id, event);
      updateMapColors();
    })
    .on("mouseout", (event, d) => {
      if (!d || !d.id) return;
      hoveredCountry = null;
      hideTooltip();
      updateMapColors();
    })
    //.on("click", () => {})  // 何もしない
    .on("click", (event, d) => {
      if (!d || !d.id) return;
      const [[x0, y0], [x1, y1]] = path.bounds(d);  // 選択国のバウンディングボックス
      const dx = x1 - x0;
      const dy = y1 - y0;
      const x = (x0 + x1) / 2;
      const y = (y0 + y1) / 2;
      const zoomFactor = 0.5;
      const scale = Math.max(1, Math.min(8, zoomFactor / Math.max(dx / width, dy / height)));
      const translate = [width / 2 - scale * x, height / 2 - scale * y];
    
      svg.transition()
        .duration(750)
        .call(
          zoom.transform,
          d3.zoomIdentity
            .translate(translate[0], translate[1])
            .scale(scale)
        );
    })

  updateMapColors();
  updateLineChart();
}
drawMap();
