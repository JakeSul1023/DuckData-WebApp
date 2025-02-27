import React, { useState, useEffect, useRef } from "react";
import { DeckGL } from "@deck.gl/react";
import { TileLayer } from "@deck.gl/geo-layers";
import { BitmapLayer, ScatterplotLayer } from "@deck.gl/layers";
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

// returns a jittered coordinate.
function jitterCoordinate(lon, lat, radius) {
  const angle = Math.random() * 2 * Math.PI;
  const r = Math.random() * radius;
  return [lon + r * Math.cos(angle), lat + r * Math.sin(angle)];
}

export default function DuckDailyPresence() {
  const [allData, setAllData] = useState([]);
  const [timeSteps, setTimeSteps] = useState([]);
  const [currentTimeIndex, setCurrentTimeIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const deckRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    fetch(`${process.env.PUBLIC_URL}/WaterdowlData1.csv`)      .then((res) => res.text())
      .then((csvText) => {
        if (!isMounted) return;

        const lines = csvText.trim().split("\n");
        const header = lines[0].split(",");
        const timeIndex = header.indexOf("timestamp");
        const duckIdIndex = header.indexOf("duck_id");
        const latIndex = header.indexOf("lat");
        const lonIndex = header.indexOf("lon");

        // Parse CSV
        const parsedData = lines.slice(1).map((row) => {
          const cols = row.split(",");
          return {
            timestamp: cols[timeIndex], // "2/1/2025 12:00:00 AM"
            duckId: cols[duckIdIndex],
            lat: parseFloat(cols[latIndex]),
            lon: parseFloat(cols[lonIndex]),
          };
        });
        setAllData(parsedData);

        let uniqueTimes = Array.from(new Set(parsedData.map((d) => d.timestamp)));
        uniqueTimes.sort((a, b) => new Date(a) - new Date(b));

        setTimeSteps(uniqueTimes);
      })
      .catch((err) => console.error("Error fetching CSV:", err));

    return () => {
      isMounted = false;
    };
  }, []);

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

  const nextTime = timeSteps[currentTimeIndex + 1] || null;
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
  const nextTimeData = dataNextTime;
  const jitterCount = 20; //Adjust to add more dots
  const jitterRadius = .30; //Adjust to add more scatter to the dots 

  const jitteredLeaving = leavingData.flatMap((d) => {
    const arr = [];
    for (let i = 0; i < jitterCount; i++) {
      arr.push({
        ...d,
        jitteredPosition: jitterCoordinate(d.lon, d.lat, jitterRadius),
      });
    }
    return arr;
  });

  const jitteredNextTime = nextTimeData.flatMap((d) => {
    const arr = [];
    for (let i = 0; i < jitterCount; i++) {
      arr.push({
        ...d,
        jitteredPosition: jitterCoordinate(d.lon, d.lat, jitterRadius),
      });
    }
    return arr;
  });

  // OSM 
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

  // Scatterplot Layer for leaving ducks (blue).
  const leavingScatterLayer = new ScatterplotLayer({
    id: "leaving-scatter-layer",
    data: jitteredLeaving,
    pickable: true,
    getPosition: (d) => d.jitteredPosition,
    getFillColor: () => [0, 0, 255, 150],
    radiusMinPixels: 2,
    radiusMaxPixels: 2,
  });

  // Scatterplot Layer for next time ducks (orange).
  const nextTimeScatterLayer = new ScatterplotLayer({
    id: "nexttime-scatter-layer",
    data: jitteredNextTime,
    pickable: true,
    getPosition: (d) => d.jitteredPosition,
    getFillColor: () => [255, 165, 0, 150],
    radiusMinPixels: 2,
    radiusMaxPixels: 2,
  });

  //Layer stack for the different points
  const layers = [tileLayer, leavingScatterLayer, nextTimeScatterLayer];

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <DeckGL
        ref={deckRef}
        initialViewState={INITIAL_VIEW}
        controller={true}
        layers={layers}
        style={{ width: "100%", height: "100%" }}
      />
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
        //These are the slider settings
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