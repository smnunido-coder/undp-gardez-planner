"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  detail: string;
  color: string;
  kind: "project" | "tag";
};

export function OsmMap({
  pins,
  focus,
  tagging,
  onProject,
  onTag,
  onPlace,
}: {
  pins: MapPin[];
  focus: { lat: number; lng: number; zoom: number } | null;
  tagging: boolean;
  onProject: (id: string) => void;
  onTag: (id: string) => void;
  onPlace: (lat: number, lng: number) => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [ready, setReady] = useState(false);
  const handlers = useRef({ onProject, onTag, onPlace, tagging });
  handlers.current = { onProject, onTag, onPlace, tagging };

  useEffect(() => {
    const node = holder.current;
    if (!node) return;
    let cancelled = false;
    let map: LeafletMap | null = null;
    void (async () => {
      const leaflet = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (cancelled) return;
      map = leaflet.map(node, { zoomControl: true, attributionControl: true }).setView([33.6, 69.23], 7);
      leaflet
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })
        .addTo(map);
      map.on("click", (event) => {
        if (!handlers.current.tagging) return;
        handlers.current.onPlace(event.latlng.lat, event.latlng.lng);
      });
      mapRef.current = map;
      map.invalidateSize();
      setReady(true);
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let cancelled = false;
    const layers: { remove: () => void }[] = [];
    void (async () => {
      const leaflet = await import("leaflet");
      if (cancelled) return;
      for (const pin of pins) {
        const icon = leaflet.divIcon({
          className: "gardez-pin",
          html: `<span style="display:flex;align-items:center;justify-content:center;width:36px;height:36px"><span style="display:block;width:${pin.kind === "tag" ? 16 : 18}px;height:${pin.kind === "tag" ? 16 : 18}px;border-radius:${pin.kind === "tag" ? "2px" : "50%"};background:${pin.color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.5)"></span></span>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
        const marker = leaflet.marker([pin.lat, pin.lng], { icon, title: pin.title }).addTo(map);
        marker.bindTooltip(`${pin.title}${pin.detail ? ` · ${pin.detail}` : ""}`, { direction: "top", offset: [0, -8] });
        marker.on("click", () => {
          if (pin.kind === "project") handlers.current.onProject(pin.id);
          else handlers.current.onTag(pin.id);
        });
        layers.push(marker);
      }
    })();
    return () => {
      cancelled = true;
      for (const layer of layers) layer.remove();
    };
  }, [pins, ready]);

  useEffect(() => {
    if (!focus || !ready) return;
    mapRef.current?.flyTo([focus.lat, focus.lng], focus.zoom, { duration: 0.6 });
  }, [focus, ready]);

  return (
    <>
      <style>{".gardez-pin{background:transparent;border:0}"}</style>
      <div ref={holder} className={`h-full w-full ${tagging ? "cursor-crosshair" : ""}`} />
    </>
  );
}
