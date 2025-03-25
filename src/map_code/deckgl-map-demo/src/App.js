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
import { BitmapLayer } from "@deck.gl/layers";
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

        const parsedData = lines.slice(1).map((row) => {
          const cols = row.split(",");
          return {
            timestamp: cols[timeIndex], // e.g. "2025-02-01 12:00:00 AM"
            duckId: cols[duckIdIndex],
            lat: parseFloat(cols[latIndex]),
            lon: parseFloat(cols[lonIndex]),
            species: cols[header.indexOf("species")] || "unknown",
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
    currentTimeIndex < timeSteps.length - 1 ? currentTimeIndex + 1 : currentTimeIndex;
  const nextTime = timeSteps[nextIndex] || null;
  const dataNextTime = allData.filter((d) => d.timestamp === nextTime);

  function isLeavingDuck(d) {
    if (!nextTime) return true;
    return !dataNextTime.some(
      (nd) => nd.duckId === d.duckId && nd.lat === d.lat && nd.lon === d.lon
    );
  }
  //The "leaving" ducks at this time
  const leavingData = dataAtTime.filter(isLeavingDuck);

  //TileLayer for the base map
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
    id: "leaving-heatmap",
    data: leavingData,
    getPosition: (d) => [d.lon, d.lat],
    getWeight: 1,
    radiusPixels: 40,
    intensity: 1,
    threshold: 0.05,
    colorRange: [
      
      [242, 240, 247],
      [218, 218, 235],
      [188, 189, 220],
      [158, 154, 200],
      [117, 107, 177],
      [84, 39, 143]   
    ],
    pickable: true,
    onHover: (info) => setHoverInfo(info),
  });

  //Heatmap layer for "next day" ducks
  const nextDayHeatmap = new HeatmapLayer({
    id: "nextday-heatmap",
    data: dataNextTime,
    getPosition: (d) => [d.lon, d.lat],
    getWeight: 1,
    radiusPixels: 40,
    intensity: 1,
    threshold: 0.05,
    colorRange: [
      [254, 229, 217],
      [252, 187, 161],
      [252, 146, 114],
      [251, 106, 74],
      [222, 45, 38],
      [165, 15, 21] 
    ],
    pickable: true,
    onHover: (info) => setHoverInfo(info),
  });

  const layers = [tileLayer, leavingHeatmap, nextDayHeatmap];

  //NOAA tooltip 
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