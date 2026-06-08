import { useEffect, useRef } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";

const TC_FILL = {
  Severe:      "#e8453cbb",
  Constrained: "#e8a020bb",
  "Low Need":  "#3fb950bb",
  Benchmark:   "#388bfdbb",
};
const TC = {
  Severe: "#e8453c", Constrained: "#e8a020",
  "Low Need": "#3fb950", Benchmark: "#388bfd",
};

// Numeric ISO → alpha-3 (complete map from the original HTML)
const NUM_ISO = {
  "004":"AFG","008":"ALB","012":"DZA","024":"AGO","028":"ATG","036":"AUS","040":"AUT",
  "050":"BGD","056":"BEL","064":"BTN","068":"BOL","076":"BRA","084":"BLZ","090":"SLB",
  "096":"BRN","100":"BGR","104":"MMR","108":"BDI","120":"CMR","124":"CAN","132":"CPV",
  "140":"CAF","144":"LKA","148":"TCD","152":"CHL","156":"CHN","170":"COL","174":"COM",
  "178":"COG","180":"COD","188":"CRI","191":"HRV","196":"CYP","203":"CZE","204":"BEN",
  "208":"DNK","214":"DOM","218":"ECU","222":"SLV","231":"ETH","232":"ERI","233":"EST",
  "242":"FJI","250":"FRA","262":"DJI","266":"GAB","268":"GEO","270":"GMB","276":"DEU",
  "288":"GHA","300":"GRC","308":"GRD","320":"GTM","324":"GIN","332":"HTI","340":"HND",
  "348":"HUN","356":"IND","360":"IDN","364":"IRN","368":"IRQ","372":"IRL","376":"ISR",
  "380":"ITA","384":"CIV","388":"JAM","392":"JPN","398":"KAZ","400":"JOR","404":"KEN",
  "408":"PRK","410":"KOR","414":"KWT","417":"KGZ","418":"LAO","422":"LBN","426":"LSO",
  "428":"LVA","430":"LBR","434":"LBY","440":"LTU","454":"MWI","458":"MYS","462":"MDV",
  "466":"MLI","470":"MLT","478":"MRT","480":"MUS","484":"MEX","496":"MNG","498":"MDA",
  "504":"MAR","508":"MOZ","516":"NAM","524":"NPL","528":"NLD","548":"VUT","554":"NZL",
  "566":"NGA","578":"NOR","586":"PAK","591":"PAN","598":"PNG","600":"PRY","604":"PER",
  "608":"PHL","616":"POL","620":"PRT","624":"GNB","626":"TLS","634":"QAT","642":"ROU",
  "643":"RUS","646":"RWA","682":"SAU","686":"SEN","694":"SLE","702":"SGP","703":"SVK",
  "704":"VNM","705":"SVN","706":"SOM","710":"ZAF","716":"ZWE","724":"ESP","728":"SSD",
  "729":"SDN","740":"SUR","748":"SWZ","752":"SWE","756":"CHE","760":"SYR","762":"TJK",
  "764":"THA","768":"TGO","780":"TTO","788":"TUN","792":"TUR","795":"TKM","800":"UGA",
  "804":"UKR","818":"EGY","826":"GBR","834":"TZA","840":"USA","854":"BFA","858":"URY",
  "860":"UZB","862":"VEN","882":"WSM","887":"YEM","894":"ZMB",
};

export default function Map({ countries, selTop, filt, selName, onPick }) {
  const svgRef  = useRef(null);
  const stateRef = useRef({ zoom: null, proj: null, mapG: null, world: null, byNum: {} });

  // Build byNum lookup once countries arrive
  useEffect(() => {
    const byNum = {};
    (countries || []).forEach((c) => {
      if (!c.iso3) return;
      for (const [num, iso3] of Object.entries(NUM_ISO)) {
        if (iso3 === c.iso3) byNum[+num] = c;
      }
    });
    stateRef.current.byNum = byNum;
  }, [countries]);

  // Build map once
  useEffect(() => {
    d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-10m.json").then((world) => {
      stateRef.current.world = world;
      buildMap(world);
    });
    // eslint-disable-next-line
  }, []);

  // Re-style when filter / selTop / selName / countries change
  useEffect(() => {
    updateMapStyles();
    // eslint-disable-next-line
  }, [filt, selTop, selName, countries]);

  function buildMap(world) {
    const svgEl = d3.select(svgRef.current);
    svgEl.selectAll("*").remove();

    const mwEl = svgRef.current.parentElement;
    const W = mwEl.clientWidth, H = mwEl.clientHeight;
    svgEl.attr("viewBox", `0 0 ${W} ${H}`);

    const proj = d3.geoNaturalEarth1().scale((W / 640) * 100).translate([W / 2, H / 2]);
    const path = d3.geoPath().projection(proj);
    stateRef.current.proj = proj;

    const countries = topojson.feature(world, world.objects.countries);
    const borders   = topojson.mesh(world, world.objects.countries, (a, b) => a !== b);

    // Fix winding order for island polygons
    countries.features.forEach((f) => {
      if (!f.geometry) return;
      const fixRing = (ring) => {
        if (d3.geoArea({ type: "Polygon", coordinates: [ring] }) > 2 * Math.PI) ring.reverse();
      };
      if (f.geometry.type === "Polygon") f.geometry.coordinates.forEach(fixRing);
      else if (f.geometry.type === "MultiPolygon")
        f.geometry.coordinates.forEach((p) => p.forEach(fixRing));
    });

    svgEl.append("rect").attr("width", W).attr("height", H).attr("fill", "#080b10");
    svgEl.append("path").datum({ type: "Sphere" }).attr("d", path)
      .attr("fill", "#0c1018").attr("stroke", "#1e2730").attr("stroke-width", 0.6);

    const mapG = svgEl.append("g");
    stateRef.current.mapG = mapG;

    mapG.selectAll(".country")
      .data(countries.features)
      .join("path")
      .attr("class", (f) => "country" + (stateRef.current.byNum[+f.id] ? "" : " nd"))
      .attr("d", path)
      .attr("fill", "#151a22")
      .on("mouseenter", function (e, f) {
        const d = stateRef.current.byNum[+f.id];
        if (!d) return;
        const tt  = document.getElementById("tt");
        const col = TC[d.tier] || "var(--tx3)";
        document.getElementById("tt-n").textContent = d.name;
        document.getElementById("tt-t").textContent = d.tier || "No data";
        document.getElementById("tt-t").style.color = col;
        document.getElementById("tt-g").textContent = d.gap   != null ? (+d.gap).toFixed(1)    : "—";
        document.getElementById("tt-s").textContent = d.supply!= null ? (+d.supply).toFixed(1) : "—";
        document.getElementById("tt-d").textContent = d.demand!= null ? (+d.demand).toFixed(1) : "—";
        posTooltip(e);
        tt.style.display = "block";
        if (d.name !== stateRef.current.selName) {
          d3.select(this).attr("stroke", "#6e7681").attr("stroke-width", 1.2);
        }
      })
      .on("mousemove", posTooltip)
      .on("mouseleave", function (e, f) {
        document.getElementById("tt").style.display = "none";
        const d = stateRef.current.byNum[+f.id];
        d3.select(this)
          .attr("stroke", d?.name === stateRef.current.selName ? "#ffffff" : "#1a1f2a")
          .attr("stroke-width", d?.name === stateRef.current.selName ? 1.2 : 0.4);
      })
      .on("click", (e, f) => {
        const d = stateRef.current.byNum[+f.id];
        if (d) onPick(d.name);
      });

    mapG.append("path").datum(borders)
      .attr("fill", "none").attr("stroke", "#1a1f2a").attr("stroke-width", 0.3).attr("d", path);

    const zoom = d3.zoom().scaleExtent([1, 9])
      .on("zoom", (e) => mapG.attr("transform", e.transform));
    svgEl.call(zoom);
    stateRef.current.zoom = zoom;

    updateMapStyles();
  }

  function updateMapStyles() {
    const { byNum, mapG } = stateRef.current;
    if (!mapG) return;
      const { selTop: st, filt: fi, selName: sn } = stateRef.current;
      const topKey = (st == null || st === "") ? null : (String(st).startsWith("T") ? String(st) : `T${String(+st).padStart(2, "0")}`);

    mapG.selectAll(".country").each(function (f) {
      const d = byNum[+f.id];
      if (!d) return;
      const dimmed = fi !== "All" && d.tier !== fi;
      const score  = topKey ? (d.tops?.[topKey] ?? null) : d.gap;
      d3.select(this)
        .classed("dim", dimmed)
        .attr("fill", !dimmed && score != null ? (TC_FILL[d.tier] || "#13182033") : "#151a22")
        .attr("stroke", d.name === sn ? "#ffffff" : "#1a1f2a")
        .attr("stroke-width", d.name === sn ? 1.2 : 0.4);
    });
  }


  // Keep ref in sync with props for event handlers
  useEffect(() => {
    stateRef.current.selTop = selTop;
    stateRef.current.filt   = filt;
    stateRef.current.selName = selName;
    updateMapStyles();
    // eslint-disable-next-line
  }, [selTop, filt, selName]);

  // Reset zoom when only the tier / indicator filter changes.
  useEffect(() => {
    const { zoom, mapG } = stateRef.current;
    if (!zoom || !mapG) return;
    d3.select(svgRef.current).transition().duration(350).ease(d3.easeCubicInOut)
      .call(zoom.transform, d3.zoomIdentity);
  }, [filt, selTop]);

  // Zoom to country
  useEffect(() => {
    const { zoom, proj, mapG } = stateRef.current;
    if (!zoom || !proj || !mapG) return;

    const mwEl = svgRef.current?.parentElement;
    if (!mwEl) return;
    const W = mwEl.clientWidth, H = mwEl.clientHeight;

    if (!selName) {
      d3.select(svgRef.current).transition().duration(500).ease(d3.easeCubicInOut)
        .call(zoom.transform, d3.zoomIdentity);
      return;
    }


    const pathEl = mapG.selectAll(".country").filter((f) => stateRef.current.byNum[+f.id]?.name === selName);
    if (!pathEl.empty()) {
      const bbox = pathEl.node().getBBox();
      if (bbox.width > 0 && bbox.height > 0) {
        const scale = Math.min(Math.max(Math.min((W * 0.6) / bbox.width, (H * 0.6) / bbox.height), 2), 8);
        const tx = W / 2 - (bbox.x + bbox.width / 2) * scale;
        const ty = H / 2 - (bbox.y + bbox.height / 2) * scale;
        d3.select(svgRef.current).transition().duration(700).ease(d3.easeCubicInOut)
          .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
        return;
      }
    }

    // Fallback: lat/lon
    const c = (countries || []).find((x) => x.name === selName);
    if (c?.lat && c?.lon) {
      const pt = proj([+c.lon, +c.lat]);
      if (pt) {
        const scale = 4;
        d3.select(svgRef.current).transition().duration(700).ease(d3.easeCubicInOut)
          .call(zoom.transform, d3.zoomIdentity.translate(W / 2 - pt[0] * scale, H / 2 - pt[1] * scale).scale(scale));
      }
    }
    // eslint-disable-next-line
  }, [selName]);

  // Resize
  useEffect(() => {
    let t;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (stateRef.current.world) buildMap(stateRef.current.world);
      }, 200);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line
  }, []);

  return <svg id="ws" ref={svgRef} style={{ width: "100%", height: "100%" }} />;
}

function posTooltip(e) {
  const mwEl = document.getElementById("mw");
  if (!mwEl) return;
  const r = mwEl.getBoundingClientRect();
  const tt = document.getElementById("tt");
  if (!tt) return;
  let x = e.clientX - r.left + 14;
  let y = e.clientY - r.top - 10;
  if (x + 190 > r.width)  x = e.clientX - r.left - 204;
  if (y + 130 > r.height) y = e.clientY - r.top - 130;
  tt.style.left = x + "px";
  tt.style.top  = y + "px";
}