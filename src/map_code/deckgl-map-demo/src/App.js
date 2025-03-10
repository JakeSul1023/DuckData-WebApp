import React, { useState, useEffect, useRef, useMemo } from "react";
import { DeckGL } from "@deck.gl/react";
import { TileLayer } from "@deck.gl/geo-layers";
import { BitmapLayer, ScatterplotLayer } from "@deck.gl/layers";
import { Slider } from "@mui/material";

// Initial view 
const INITIAL_VIEW = {
  latitude: 36.28,
  longitude: -89.42,
  zoom: 5,
  minZoom: 3,
  maxZoom: 12,
  pitch: 0,
  bearing: 0,
};

function randomOffset(radius) {
  const angle = Math.random() * 2 * Math.PI;
  const r = Math.random() * radius;
  return { dx: r * Math.cos(angle), dy: r * Math.sin(angle) };
}

export default function Duckmapfunction() {
  const [allData, setAllData] = useState([]);
  const [timeSteps, setTimeSteps] = useState([]);
  const [currentTimeIndex, setCurrentTimeIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  //NOAA tooltip consts
  const [hoverInfo, setHoverInfo] = useState(null);
  const [tooltipData, setTooltipData] = useState(null);
  const deckRef = useRef(null);
  const stableJitterMap = useRef(new Map());

  //stores jitter positons so that it stays constant when hovering
  function getJitteredPositions(rowKey, lon, lat, count, radius) {

    if (!stableJitterMap.current.has(rowKey)) {
      const offsets = [];
      for (let i = 0; i < count; i++) {
        offsets.push(randomOffset(radius));
      }
      stableJitterMap.current.set(rowKey, offsets);
    }
    const storedOffsets = stableJitterMap.current.get(rowKey);
    return storedOffsets.map((offset) => [lon + offset.dx, lat + offset.dy]);
  }
  //Load CSV data
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
            timestamp: cols[timeIndex], //"2/1/2025 12:00:00 AM start date"
            duckId: cols[duckIdIndex],
            lat: parseFloat(cols[latIndex]),
            lon: parseFloat(cols[lonIndex]),
          };
        });

        setAllData(parsedData);
        //Sort timestamps
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

  //Moves the time stamp when plays pressed
  useEffect(() => {
    let timerId;
    if (isPlaying && timeSteps.length > 0) {
      timerId = setInterval(() => {
        setCurrentTimeIndex((prevIndex) =>
          prevIndex === timeSteps.length - 1 ? 0 : prevIndex + 1
        );
      }, 1000);
    }
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [isPlaying, timeSteps]);

  const currentTime = timeSteps[currentTimeIndex] || null;
  const dataAtTime = allData.filter((d) => d.timestamp === currentTime);
  const nextIndex = currentTimeIndex < timeSteps.length - 1 ? currentTimeIndex + 1 : currentTimeIndex;
  const nextTime = timeSteps[nextIndex] || null;
  const dataNextTime = allData.filter((d) => d.timestamp === nextTime);

  function isLeavingDuck(d) {
    if (!nextTime) return true;
    return !dataNextTime.some(
      (nd) =>
        nd.duckId === d.duckId &&
        nd.lat === d.lat &&
        nd.lon === d.lon
    );
  }
  const leavingData = dataAtTime.filter(isLeavingDuck);
  //Stable jitters
  const jitterCount = 20;
  const jitterRadius = 0.3;
  const jitteredLeaving = useMemo(() => {
    return leavingData.flatMap((d) => {

      const rowKey = `leaving-${d.duckId}-${d.lon}-${d.lat}-${d.timestamp}`;
      const positions = getJitteredPositions(rowKey, d.lon, d.lat, jitterCount, jitterRadius);
      return positions.map((pos) => ({
        ...d,
        jitteredPosition: pos,
      }));
    });
  }, [leavingData]);

  const jitteredNextTime = useMemo(() => {
    return dataNextTime.flatMap((d) => {
      const rowKey = `next-${d.duckId}-${d.lon}-${d.lat}-${d.timestamp}`;
      const positions = getJitteredPositions(rowKey, d.lon, d.lat, jitterCount, jitterRadius);
      return positions.map((pos) => ({
        ...d,
        jitteredPosition: pos,
      }));
    });
  }, [dataNextTime]);

  // TileLayer for background map
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

  // Blue scatter jitter plots for leaving ducks
  const leavingScatterLayer = new ScatterplotLayer({
    id: "leaving-scatter-layer",
    data: jitteredLeaving,
    pickable: true,
    getPosition: (d) => d.jitteredPosition,
    getFillColor: () => [0, 0, 255, 150],
    radiusMinPixels: 2,
    radiusMaxPixels: 2,
    //hover enabled
    onHover: (info) => {
      setHoverInfo(info);
    },
  });

  // Orange scatter jitter layer with a statc so it doesn't move
  const nextTimeScatterLayer = new ScatterplotLayer({
    id: "nexttime-scatter-layer",
    data: jitteredNextTime,
    pickable: true,
    getPosition: (d) => d.jitteredPosition,
    getFillColor: () => [255, 165, 0, 150],
    radiusMinPixels: 2,
    radiusMaxPixels: 2,
    //hover enabled
    onHover: (info) => {
      setHoverInfo(info);
    },
  });

  const layers = [tileLayer, leavingScatterLayer, nextTimeScatterLayer];
  useEffect(() => {
    if (hoverInfo && hoverInfo.object) {

      const hoveredObj = hoverInfo.object;
      const [lon, lat] = hoveredObj.jitteredPosition
        ? hoveredObj.jitteredPosition
        : [hoveredObj.lon, hoveredObj.lat];

      const pointsUrl = `https://api.weather.gov/points/${lat},${lon}`;
      fetch(pointsUrl)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`NOAA points fetch error: ${res.status}`);
          }
          return res.json();
        })
        .then((pointData) => {
          if (!pointData.properties || !pointData.properties.forecast) {
            throw new Error("No weather found for this location/time.");
          }
          // NOAA URL
          return fetch(pointData.properties.forecast);
        })
        .then((res) => res.json())
        .then((forecastData) => {
          if (!forecastData.properties || !forecastData.properties.periods) {
            throw new Error("No forecast periods found.");
          }
    
          const period = forecastData.properties.periods[0];
          setTooltipData({
            // Show NOAA forecast details
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
          <div>{tooltipData.name}</div>
          <div>
            Temp: {tooltipData.temperature}°{tooltipData.temperatureUnit}
          </div>
          <div>
            Wind: {tooltipData.windSpeed} {tooltipData.windDirection}
          </div>
          <div>{tooltipData.shortForecast}</div>
        </div>
      )}

      {/* Slider & Controls */}
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
        <button onClick={() => setIsPlaying((prev) => !prev)} style={{ cursor: "pointer" }}>
          {isPlaying ? "Pause" : "Play"}
        </button>
      </div>
    </div>
  );
}