/*
    Author: Jacob Sullivan 
    Status: Unfinished
    About: This file includes the code to locally host a map that involves Deck.gl and OpenStreetMaps (OSM). 
    It currently shows the map of the globe with a visualization of the data in a heat format of historical data provided by
    movebank and it as of now is a static set of data and the goal as of now is to implement a time slider to see
    the motion of the ducks over time
*/
import React, { useState, useEffect, useRef } from "react";
import { DeckGL } from "@deck.gl/react";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { TileLayer } from "@deck.gl/geo-layers";

const INITIAL_VIEW = {
  latitude: 36.28,
  longitude: -89.42,
  zoom: 5,
  minZoom: 3,
  maxZoom: 12,
  pitch: 0,
  bearing: 0,
};

export default function DuckMigrationHeatmap() {
  const [data, setData] = useState([]);
  const deckRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    fetch("/WaterfowlData.csv")
      .then((res) => res.text())
      .then((csvText) => {
        if (!isMounted) return;
        const rows = csvText.split("\n").slice(1);
        const parsedData = rows.map((row) => {
          const cols = row.split(",");
          return {
    
            position: [parseFloat(cols[3]), parseFloat(cols[4])],
            weight: 1,
          };
        });
        setData(parsedData);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const heatmapLayer = new HeatmapLayer({
    id: "heatmap-layer",
    data,
    getPosition: (d) => d.position,
    getWeight: (d) => d.weight,
    radiusPixels: 50,
    intensity: 1,
    threshold: 0.03,
  });

  const tileLayer = new TileLayer({
    data: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    minZoom: 3,
    maxZoom: 12,
    tileSize: 256,
  });

  return (
    <DeckGL
      ref={deckRef}
      initialViewState={INITIAL_VIEW}
      controller={true}
      layers={[tileLayer, heatmapLayer]}
      glOptions={{ preserveDrawingBuffer: true }}
    />
  );
}