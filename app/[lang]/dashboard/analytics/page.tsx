"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useActiveRole } from "@/app/hooks/useActiveRole";
import { ProtectedSection } from "@/components/ProtectedSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart3,
  MapPin,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const GEOAPIFY_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;

const loadMapbox = () => import("mapbox-gl");

function AnalyticsContent() {
  const { activeRole } = useActiveRole();
  const pathname = usePathname();
  const lang = pathname.split("/")[1] || "en";

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const [mapStatus, setMapStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [mapboxLoaded, setMapboxLoaded] = useState(false);

  // Map initialization
  useEffect(() => {
    if (!MAPBOX_TOKEN) {
      setMapStatus("error");
      setErrorMessage("NEXT_PUBLIC_MAPBOX_TOKEN not found");
      return;
    }

    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    loadMapbox()
      .then((mapboxgl) => {
        setMapboxLoaded(true);

        if (!mapContainerRef.current || mapRef.current) {
          return;
        }

        try {
          const map = new mapboxgl.Map({
            container: mapContainerRef.current,
            accessToken: MAPBOX_TOKEN,
            style: "mapbox://styles/mapbox/streets-v12",
            center: [23.7275, 37.9838],
            zoom: 12,
          });

          map.on("load", () => {
            setMapStatus("success");
          });

          map.on("error", (e: mapboxgl.ErrorEvent) => {
            console.error("Map error:", e);
            setMapStatus("error");
            setErrorMessage(e.error?.message || "Unknown map error");
          });

          new mapboxgl.Marker({ color: "#ef4444" })
            .setLngLat([23.7275, 37.9838])
            .addTo(map);

          mapRef.current = map;
        } catch (error) {
          console.error("Map initialization error:", error);
          setMapStatus("error");
          setErrorMessage(
            error instanceof Error ? error.message : "Failed to initialize map"
          );
        }
      })
      .catch((error) => {
        console.error("Failed to load Mapbox:", error);
        setMapStatus("error");
        setErrorMessage("Failed to load map library");
      });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="space-y-6 py-16">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Analytics Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Map integration test for {activeRole.companyName}
        </p>
      </div>

      {/* Environment Check */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Environment Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {MAPBOX_TOKEN ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
              <span>
                Mapbox Token: {MAPBOX_TOKEN ? "✅ Configured" : "❌ Missing"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {GEOAPIFY_KEY ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
              <span>
                Geoapify Key: {GEOAPIFY_KEY ? "✅ Configured" : "❌ Missing"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Map */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Location Map - Athens, Greece
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center gap-2">
              {mapStatus === "loading" && (
                <>
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                  <span className="text-blue-500">
                    {!mapboxLoaded
                      ? "Loading map library..."
                      : "Loading map..."}
                  </span>
                </>
              )}
              {mapStatus === "success" && (
                <>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-green-500 font-semibold">
                    Map loaded successfully
                  </span>
                </>
              )}
              {mapStatus === "error" && (
                <>
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <span className="text-red-500 font-semibold">
                    Map failed to load
                  </span>
                </>
              )}
            </div>

            {/* Error Message */}
            {mapStatus === "error" && errorMessage && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">
                  {errorMessage}
                </p>
              </div>
            )}

            {/* Map Container with Placeholder */}
            {MAPBOX_TOKEN ? (
              <div className="relative w-full h-[400px] rounded-lg border bg-muted overflow-hidden">
                {mapStatus === "loading" && (
                  <div className="absolute inset-0 bg-gradient-to-br from-muted via-muted/50 to-muted animate-pulse flex flex-col items-center justify-center gap-4 z-10">
                    <div className="relative">
                      <MapPin className="w-16 h-16 text-muted-foreground/30" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-pulse-500 animate-spin" />
                      </div>
                    </div>
                    <div className="text-center space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        {!mapboxLoaded
                          ? "Initializing map..."
                          : "Loading Athens..."}
                      </p>
                      <div className="flex gap-1 justify-center">
                        <div
                          className="w-2 h-2 bg-pulse-500 rounded-full animate-bounce"
                          style={{ animationDelay: "0ms" }}
                        />
                        <div
                          className="w-2 h-2 bg-pulse-500 rounded-full animate-bounce"
                          style={{ animationDelay: "150ms" }}
                        />
                        <div
                          className="w-2 h-2 bg-pulse-500 rounded-full animate-bounce"
                          style={{ animationDelay: "300ms" }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div
                  ref={mapContainerRef}
                  className="w-full h-full"
                  style={{ opacity: mapStatus === "success" ? 1 : 0 }}
                />
              </div>
            ) : (
              <div className="w-full h-[400px] rounded-lg border bg-muted flex items-center justify-center">
                <p className="text-muted-foreground">
                  Map unavailable - missing Mapbox token
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Permission Info */}
      <Card className="border-2 border-pulse-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-semibold">
            Access Level: {activeRole.role}
          </CardTitle>
          <BarChart3 className="h-6 w-6 text-pulse-500" />
        </CardHeader>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">
            Company:{" "}
            <span className="font-medium text-foreground">
              {activeRole.companyName}
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <ProtectedSection requiredRole="company_admin">
      <AnalyticsContent />
    </ProtectedSection>
  );
}
