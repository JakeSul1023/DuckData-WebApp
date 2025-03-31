/*
    Author: Jacob Sullivan 
    Status: Unfinished
    About: 
      - Day-by-day map of duck presence.
      - Each day, ducks that will remain the following day are colored red/yellow (example: orange).
      - Ducks that won't be present the next day at this lat/lon are colored blue (leaving).
      - If there's no duck data at a location, the map has no overlay there.
      - A time slider + "Play" button animates day by day.
*/
import React, { useState, useEffect, useRef, useMemo } from "react";
import { DeckGL } from "@deck.gl/react";
import { TileLayer } from "@deck.gl/geo-layers";
import { BitmapLayer, ArcLayer, IconLayer } from "@deck.gl/layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { Slider } from "@mui/material";

const INITIAL_VIEW = {
  latitude: 36.28,
  longitude: -89.42,
  zoom: 5,
  minZoom: 3,
  maxZoom: 12,
  pitch: 0,
  bearing: 0,
};

export default function Duckmapfunction() {
  const [allData, setAllData] = useState([]);
  const [timeSteps, setTimeSteps] = useState([]);
  const [currentTimeIndex, setCurrentTimeIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [tooltipData, setTooltipData] = useState(null);
  const deckRef = useRef(null);

  //Fetch CSV data
  useEffect(() => {
    let isMounted = true;
    fetch(`${process.env.PUBLIC_URL}/WaterdowlData1.csv`)
      .then((res) => res.text())
      .then((csvText) => {
        if (!isMounted) return;
        const lines = csvText.trim().split("\n");
        const header = lines[0].split(",");
        const timeIndex = header.indexOf("timestamp");
        const duckIdIndex = header.indexOf("duck_id");
        const latIndex = header.indexOf("lat");
        const lonIndex = header.indexOf("lon");
        const speciesIndex = header.indexOf("species");

        const parsedData = lines.slice(1).map((row) => {
          const cols = row.split(",");
          return {
            timestamp: cols[timeIndex],
            duckId: cols[duckIdIndex],
            lat: parseFloat(cols[latIndex]),
            lon: parseFloat(cols[lonIndex]),
            species: speciesIndex !== -1 ? cols[speciesIndex] : "unknown",
          };
        });
        setAllData(parsedData);
        
        // Extract unique timestamps and sort them
        const uniqueTimes = Array.from(
          new Set(parsedData.map((d) => d.timestamp))
        ).sort((a, b) => new Date(a) - new Date(b));
        setTimeSteps(uniqueTimes);
      })
      .catch((err) => console.error("Error with CSV:", err));

    return () => {
      isMounted = false;
    };
  }, []);
  // Time slider
  useEffect(() => {
    let timerId;
    if (isPlaying && timeSteps.length > 0) {
      timerId = setInterval(() => {
        setCurrentTimeIndex((prev) =>
          prev === timeSteps.length - 1 ? 0 : prev + 1
        );
      }, 1000);
    }
    return () => timerId && clearInterval(timerId);
  }, [isPlaying, timeSteps]);

  const currentTime = timeSteps[currentTimeIndex] || null;
  const dataAtTime = allData.filter((d) => d.timestamp === currentTime);

  const nextIndex =
    currentTimeIndex < timeSteps.length - 1
      ? currentTimeIndex + 1
      : currentTimeIndex;
  const nextTime = timeSteps[nextIndex] || null;
  const dataNextTime = allData.filter((d) => d.timestamp === nextTime);

  //Arrow function center
  function getCentroid(points) {
    if (!points.length) return null;
    let sumLat = 0;
    let sumLon = 0;
    for (const p of points) {
      sumLat += p.lat;
      sumLon += p.lon;
    }
    const avgLat = sumLat / points.length;
    const avgLon = sumLon / points.length;
    return { lat: avgLat, lon: avgLon };
  }

  const centroidT = useMemo(() => getCentroid(dataAtTime), [dataAtTime]);
  const centroidT1 = useMemo(() => getCentroid(dataNextTime), [dataNextTime]);

  const arcsData = useMemo(() => {
    if (!centroidT || !centroidT1) return [];
    return [
      {
        source: [centroidT.lon, centroidT.lat],
        target: [centroidT1.lon, centroidT1.lat],
      },
    ];
  }, [centroidT, centroidT1]);

  // Base map
  const tileLayer = new TileLayer({
    id: "osm-tiles",
    data: "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
    minZoom: 3,
    maxZoom: 12,
    tileSize: 256,
    renderSubLayers: (props) => {
      const {
        bbox: { west, south, east, north },
      } = props.tile;
      return new BitmapLayer(props, {
        data: null,
        image: props.data,
        bounds: [west, south, east, north],
      });
    },
  });

  //Heatmap layer for "leaving" ducks 
  const leavingHeatmap = new HeatmapLayer({
    id: "heatmap-dayT",
    data: dataAtTime,
    getPosition: (d) => [d.lon, d.lat],
    getWeight: 1,
    radiusPixels: 40,
    intensity: 1,
    threshold: 0.05,
    opacity: 0.4,
    colorRange: [
      [242, 240, 247, 40],
      [218, 218, 235, 90],
      [188, 189, 220, 120],
      [158, 154, 200, 150],
      [117, 107, 177, 180],
      [84, 39, 143, 200],
    ],
    pickable: true,
    onHover: (info) => setHoverInfo(info),
  });

  //Heatmap layer for "next day" ducks
  const nextDayHeatmap = new HeatmapLayer({
    id: "heatmap-dayT1",
    data: dataNextTime,
    getPosition: (d) => [d.lon, d.lat],
    getWeight: 1,
    radiusPixels: 40,
    intensity: 1,
    threshold: 0.05,
    opacity: 0.4,
    colorRange: [
      [254, 229, 217, 40],
      [252, 187, 161, 80],
      [252, 146, 114, 120],
      [251, 106, 74, 150],
      [222, 45, 38, 180],
      [165, 15, 21, 200],
    ],
    pickable: true,
    onHover: (info) => setHoverInfo(info),
  });

    const movementArc = new ArcLayer({
    id: "movement-arc",
    data: arcsData,
    getSourcePosition: (d) => d.source,
    getTargetPosition: (d) => d.target,
    getSourceColor: [60, 60, 60],
    getTargetColor: [200, 200, 200],
    getWidth: 4,
    greatCircle: false,
    pickable: true,
    onHover: (info) => setHoverInfo(info),
  });

  // Single arrow icon at centroid
  const iconAtlas = `${process.env.PUBLIC_URL}/arrow.png`;
  const iconMapping = {
    arrow: { x: 0, y: 0, width: 512, height: 512, mask: true },
  };

  const arrowLayer = new IconLayer({
    id: "arrow-icon",
    data: arcsData,
    iconAtlas,
    iconMapping,
    getIcon: () => "arrow",
    getSize: 40,
    getPosition: (d) => d.target,
    getAngle: (d) => {
      const [lon1, lat1] = d.source;
      const [lon2, lat2] = d.target;
      const dx = lon2 - lon1;
      const dy = lat2 - lat1;
      return (Math.atan2(dy, dx) * 180) / Math.PI;
    },
    pickable: true,
    onHover: (info) => setHoverInfo(info),
  });

  const layers = [
    tileLayer,
    leavingHeatmap,
    nextDayHeatmap,
    movementArc,
    arrowLayer,
  ];

  useEffect(() => {
    if (hoverInfo && hoverInfo.coordinate) {
      const [lon, lat] = hoverInfo.coordinate;
      const pointsUrl = `https://api.weather.gov/points/${lat},${lon}`;
      fetch(pointsUrl)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`NOAA points fetch error: ${res.status}`);
          }
          return res.json();
        })
        .then((pointData) => {
          if (!pointData.properties?.forecast) {
            throw new Error("No forecast found.");
          }
          return fetch(pointData.properties.forecast);
        })
        .then((res) => res.json())
        .then((forecastData) => {
          const period = forecastData.properties?.periods?.[0];
          if (!period) throw new Error("No forecast period data.");
          setTooltipData({
            temperature: period.temperature,
            temperatureUnit: period.temperatureUnit,
            windSpeed: period.windSpeed,
            windDirection: period.windDirection,
            shortForecast: period.shortForecast,
          });
        })
        .catch((err) => {
          console.error("Error grabbing NOAA data:", err);
          setTooltipData(null);
        });
    } else {
      setTooltipData(null);
    }
  }, [hoverInfo]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <DeckGL
        ref={deckRef}
        initialViewState={INITIAL_VIEW}
        controller={true}
        layers={layers}
        style={{ width: "100%", height: "100%" }}
      />
      {hoverInfo && hoverInfo.x !== undefined && hoverInfo.y !== undefined && tooltipData && (
        <div
          style={{
            position: "absolute",
            zIndex: 1000,
            pointerEvents: "none",
            left: hoverInfo.x,
            top: hoverInfo.y,
            background: "rgba(255,255,255,0.9)",
            padding: "8px",
            borderRadius: "4px",
            transform: "translate(10px, 10px)",
            fontSize: "12px",
            maxWidth: "220px",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "4px" }}>NOAA Forecast</div>
          <div>
            Temp: {tooltipData.temperature}°{tooltipData.temperatureUnit}
          </div>
          <div>
            Wind: {tooltipData.windSpeed} {tooltipData.windDirection}
          </div>
          <div>{tooltipData.shortForecast}</div>
        </div>
      )}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          width: "350px",
          background: "rgba(255,255,255,0.8)",
          padding: "10px",
          borderRadius: "8px",
          zIndex: 999,
        }}
      >
        <Slider
          min={0}
          max={timeSteps.length - 1}
          value={currentTimeIndex}
          onChange={(e, val) => setCurrentTimeIndex(val)}
          step={1}
          valueLabelDisplay="auto"
          valueLabelFormat={(idx) => timeSteps[idx] || ""}
        />
        <div style={{ marginBottom: "8px" }}>
          Current Time: <strong>{currentTime || "Loading..."}</strong>
        </div>
        <button onClick={() => setIsPlaying((prev) => !prev)}>
          {isPlaying ? "Pause" : "Play"}
        </button>
      </div>
    </div>
  );
}