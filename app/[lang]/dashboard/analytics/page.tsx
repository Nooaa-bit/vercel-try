"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useActiveRole } from "@/app/hooks/useActiveRole";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, MapPin, AlertCircle, CheckCircle } from "lucide-react";
import mapboxgl from "mapbox-gl";

export default function ProtectedPage() {
  const { activeRole, hasPermission } = useActiveRole();
  const { t } = useTranslation("dashboard");
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const [mapStatus, setMapStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [envCheck, setEnvCheck] = useState({
    mapboxToken: false,
    geoapifyKey: false,
  });

  const hasAccess = hasPermission("company_admin");

  useEffect(() => {
    if (!hasAccess) {
      router.push("/dashboard");
    }
  }, [hasAccess, router]);

  // Check environment variables
  useEffect(() => {
    setEnvCheck({
      mapboxToken: !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
      geoapifyKey: !!process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY,
    });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    if (!token) {
      setMapStatus("error");
      setErrorMessage(
        "NEXT_PUBLIC_MAPBOX_TOKEN not found in environment variables"
      );
      return;
    }

    console.log("🗺️ Mapbox token exists:", !!token);
    console.log("🗺️ Token preview:", token.substring(0, 20) + "...");

    mapboxgl.accessToken = token;

    setTimeout(() => {
      if (!mapContainerRef.current) return;

      try {
        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [23.7275, 37.9838], // Athens
          zoom: 12,
        });

        map.on("load", () => {
          console.log("✅ Map loaded successfully on Vercel!");
          setMapStatus("success");
        });

        map.on("error", (e) => {
          console.error("❌ Map error:", e);
          setMapStatus("error");
          setErrorMessage(e.error?.message || "Unknown map error");
        });

        new mapboxgl.Marker({ color: "#ef4444" })
          .setLngLat([23.7275, 37.9838])
          .addTo(map);

        mapRef.current = map;
      } catch (error) {
        console.error("❌ Map initialization error:", error);
        setMapStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to initialize map"
        );
      }
    }, 200);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  if (!hasAccess) {
    return null;
  }

  return (
    <div className="space-y-6 py-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Analytics Dashboard - Map Test
        </h1>
        <p className="text-muted-foreground mt-2">
          Testing Mapbox on Vercel deployment
        </p>
      </div>

      {/* Environment Check */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            🔍 Environment Variables Check
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {envCheck.mapboxToken ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
              <span>
                NEXT_PUBLIC_MAPBOX_TOKEN:{" "}
                {envCheck.mapboxToken ? "✅ Found" : "❌ Missing"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {envCheck.geoapifyKey ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
              <span>
                NEXT_PUBLIC_GEOAPIFY_API_KEY:{" "}
                {envCheck.geoapifyKey ? "✅ Found" : "❌ Missing"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Map Test */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Map Test - Athens, Greece
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Status Badge */}
            <div className="flex items-center gap-2">
              {mapStatus === "loading" && (
                <>
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-blue-500">Loading map...</span>
                </>
              )}
              {mapStatus === "success" && (
                <>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-green-500 font-semibold">
                    Map loaded successfully!
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
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200 font-mono">
                  {errorMessage}
                </p>
              </div>
            )}

            {/* Map Container */}
            <div
              ref={mapContainerRef}
              className="w-full h-[400px] rounded-lg border bg-muted"
            />

            {/* Instructions */}
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                ✓ If you see a map with a red marker in Athens, Greece - it
                works!
              </p>
              <p>✓ Check browser console (F12) for detailed logs</p>
              <p>✓ On Vercel: Check deployment logs for any errors</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Original Permission Test */}
      <Card className="border-2 border-pulse-500">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-semibold">
            ✅ Access Granted
          </CardTitle>
          <BarChart3 className="h-6 w-6 text-pulse-500" />
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <p className="text-lg">
              You are viewing this page as:{" "}
              <span className="font-bold capitalize text-pulse-500">
                {activeRole.role}
              </span>
            </p>
            <p className="text-muted-foreground">
              Company:{" "}
              <span className="font-medium text-foreground">
                {activeRole.companyName}
              </span>
            </p>

            <div className="mt-6 p-4 bg-muted rounded-lg border">
              <p className="font-semibold mb-2">🔒 Permission Test Results:</p>
              <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
                <li>✅ Superadmins: Can access</li>
                <li>✅ Company Admins: Can access</li>
                <li>❌ Supervisors: Redirected to dashboard</li>
                <li>❌ Talents: Redirected to dashboard</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debug Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🐛 Debug Information</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-4 rounded overflow-auto">
            {JSON.stringify(
              {
                environment: process.env.NODE_ENV,
                hasMapboxToken: !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
                hasGeoapifyKey: !!process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY,
                mapStatus,
                timestamp: new Date().toISOString(),
              },
              null,
              2
            )}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
