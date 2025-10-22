"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useActiveRole } from "@/app/hooks/useActiveRole";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  MapPin,
  Building2,
  Trash2,
  Pencil,
  Loader2,
  Search as SearchIcon,
} from "lucide-react";
import { toast } from "sonner";
import mapboxgl from "mapbox-gl";

interface Location {
  id: number;
  company_id: number;
  name: string;
  type: string;
  address: string;
  address_line_2?: string | null;
  city: string;
  state?: string | null;
  postcode?: string | null;
  country: string;
  latitude: string;
  longitude: string;
  access_instructions?: string | null;
  is_active: boolean;
  created_at: string;
}

interface AddressSuggestion {
  formatted: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  lat: number;
  lon: number;
}

interface GeoapifyResponse {
  features: Array<{
    properties: {
      formatted: string;
      address_line1?: string;
      address_line2?: string;
      city?: string;
      state?: string;
      postcode?: string;
      country?: string;
      lat: number;
      lon: number;
    };
  }>;
}

const LOCATION_TYPES = [
  { value: "Office", label: "Office" },
  { value: "Warehouse", label: "Warehouse" },
  { value: "RetailStore", label: "Retail Store" },
  { value: "Restaurant", label: "Restaurant" },
  { value: "EventSpace", label: "Event Space" },
  { value: "ConstructionSite", label: "Construction Site" },
  { value: "Factory", label: "Factory" },
  { value: "HealthcareFacility", label: "Healthcare Facility" },
  { value: "Hotel", label: "Hotel" },
  { value: "Educational", label: "Educational" },
  { value: "Other", label: "Other" },
];

export default function LocationsPage() {
  const router = useRouter();
  const { activeRole, hasPermission, loading: roleLoading } = useActiveRole();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasCheckedPermission, setHasCheckedPermission] = useState(false);
  const supabase = createClient();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  const [locationName, setLocationName] = useState("");
  const [locationType, setLocationType] = useState("Other");
  const [addressSearch, setAddressSearch] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [selectedAddress, setSelectedAddress] =
    useState<AddressSuggestion | null>(null);
  const [accessInstructions, setAccessInstructions] = useState("");
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [markerPosition, setMarkerPosition] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [userLocation] = useState({ lat: 37.9838, lng: 23.7275 });
  const [showDropdown, setShowDropdown] = useState(false);

  // FIXED: Only check permission ONCE after loading completes
  useEffect(() => {
    if (roleLoading || hasCheckedPermission) return;

    console.log("Checking permission...", {
      roleLoading,
      hasPermission: hasPermission("company_admin"),
      companyId: activeRole.companyId,
    });

    setHasCheckedPermission(true);

    if (!hasPermission("company_admin")) {
      console.log("Redirecting: no permission");
      router.push("/dashboard");
    }
  }, [
    roleLoading,
    hasPermission,
    router,
    hasCheckedPermission,
    activeRole.companyId,
  ]);

  useEffect(() => {
    if (hasPermission("company_admin") && activeRole.companyId > 0) {
      fetchLocations();
    }
  }, [hasPermission, activeRole.companyId]);

  useEffect(() => {
    if (!dialogOpen) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
      return;
    }

    if (mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      toast.error("Map not configured");
      return;
    }

    mapboxgl.accessToken = token;

    const checkAndCreate = () => {
      if (!mapContainerRef.current) {
        setTimeout(checkAndCreate, 100);
        return;
      }

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [userLocation.lng, userLocation.lat],
        zoom: 13,
      });

      map.on("load", () => console.log("✅ Map loaded"));

      const marker = new mapboxgl.Marker({
        draggable: true,
        color: "#ef4444",
      })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map);

      marker.on("dragend", () => {
        const lngLat = marker.getLngLat();
        setMarkerPosition({ lat: lngLat.lat, lng: lngLat.lng });
      });

      mapRef.current = map;
      markerRef.current = marker;
      setMarkerPosition({ lat: userLocation.lat, lng: userLocation.lng });
    };

    setTimeout(checkAndCreate, 300);
  }, [dialogOpen, userLocation]);

  useEffect(() => {
    if (addressSearch.length < 3) {
      setShowDropdown(false);
      setSuggestions([]);
      return;
    }

    if (selectedAddress && addressSearch === selectedAddress.formatted) {
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(() => {
      searchAddress(addressSearch);
    }, 400);

    return () => clearTimeout(timer);
  }, [addressSearch, selectedAddress]);

  const fetchLocations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("location")
      .select("*")
      .eq("company_id", activeRole.companyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setLocations(data);
    }
    setLoading(false);
  };

  const searchAddress = async (query: string) => {
    setSearchingAddress(true);
    try {
      const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;
      if (!apiKey) {
        toast.error("Address search not configured");
        return;
      }

      const response = await fetch(
        `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(
          query
        )}&apiKey=${apiKey}`
      );

      const data: GeoapifyResponse = await response.json();

      if (data.features?.length > 0) {
        const formatted: AddressSuggestion[] = data.features.map((f) => ({
          formatted: f.properties.formatted,
          address_line1: f.properties.address_line1 || "",
          address_line2: f.properties.address_line2 || "",
          city: f.properties.city || "",
          state: f.properties.state || "",
          postcode: f.properties.postcode || "",
          country: f.properties.country || "",
          lat: f.properties.lat,
          lon: f.properties.lon,
        }));
        setSuggestions(formatted);
        setShowDropdown(true);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    } catch (error) {
      toast.error("Failed to search addresses");
      setShowDropdown(false);
    }
    setSearchingAddress(false);
  };

  const handleAddressSelect = (address: AddressSuggestion) => {
    setSelectedAddress(address);
    setAddressSearch(address.formatted);
    setShowDropdown(false);
    setSuggestions([]);

    if (mapRef.current && markerRef.current) {
      mapRef.current.flyTo({
        center: [address.lon, address.lat],
        zoom: 16,
        duration: 1500,
      });
      markerRef.current.setLngLat([address.lon, address.lat]);
    }
    setMarkerPosition({ lat: address.lat, lng: address.lon });
  };

  const handleSaveLocation = async () => {
    if (!locationName || !selectedAddress || !markerPosition) {
      toast.error("Please provide a name and select an address");
      return;
    }

    setSaving(true);

    const now = new Date().toISOString();

    const { data, error } = await supabase.from("location").insert({
      company_id: activeRole.companyId,
      name: locationName,
      type: locationType,
      address: selectedAddress.address_line1,
      address_line_2: selectedAddress.address_line2 || null,
      city: selectedAddress.city,
      state: selectedAddress.state || null,
      postcode: selectedAddress.postcode || null,
      country: selectedAddress.country,
      latitude: markerPosition.lat.toString(),
      longitude: markerPosition.lng.toString(),
      access_instructions: accessInstructions || null,
      is_active: true,
      created_at: now,
      updated_at: now, // FIXED: Added this field
    });

    if (error) {
      console.error("❌ Supabase error:", error);
      toast.error(`Failed: ${error.message}`);
    } else {
      console.log("✅ Saved successfully");
      toast.success("Location created successfully");
      setDialogOpen(false);
      resetForm();
      fetchLocations();
    }

    setSaving(false);
  };

  const resetForm = () => {
    setLocationName("");
    setLocationType("Other");
    setAddressSearch("");
    setSelectedAddress(null);
    setSuggestions([]);
    setShowDropdown(false);
    setAccessInstructions("");
    setMarkerPosition(null);
  };

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-pulse-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!hasPermission("company_admin")) {
    return null;
  }

  return (
    <div className="space-y-6 py-20">
      <div className="flex items-center justify-between">
        <h1 className="text-l font-semibold">
          Manage your company locations and venues
        </h1>
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Locations</CardTitle>
              <CardDescription>
                {locations.length} location{locations.length !== 1 ? "s" : ""}{" "}
                registered
              </CardDescription>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-pulse-500 hover:bg-pulse-600">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Location
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Venue</DialogTitle>
                  <DialogDescription>
                    Add a new location for your company
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Venue Name *</Label>
                      <Input
                        placeholder="e.g., Downtown Office"
                        value={locationName}
                        onChange={(e) => setLocationName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Venue Type</Label>
                      <Select
                        value={locationType}
                        onValueChange={setLocationType}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LOCATION_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Address *</Label>
                    <div className="relative">
                      <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Start typing an address..."
                        value={addressSearch}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setAddressSearch(newValue);

                          if (
                            selectedAddress &&
                            newValue !== selectedAddress.formatted
                          ) {
                            setSelectedAddress(null);
                            setShowDropdown(true);
                          }
                        }}
                        className="pl-10"
                        autoComplete="off"
                      />
                      {searchingAddress && (
                        <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-3 text-muted-foreground" />
                      )}
                    </div>

                    {showDropdown && suggestions.length > 0 && (
                      <div className="border rounded-md max-h-48 overflow-y-auto bg-background shadow-lg mt-1">
                        {suggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleAddressSelect(suggestion)}
                            className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-b-0"
                          >
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 mt-0.5 text-pulse-500 flex-shrink-0" />
                              <div>
                                <div className="font-medium">
                                  {suggestion.address_line1}
                                </div>
                                <div className="text-muted-foreground text-xs">
                                  {suggestion.city}
                                  {suggestion.state &&
                                    `, ${suggestion.state}`}{" "}
                                  {suggestion.postcode}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedAddress && (
                      <div className="border rounded-md p-3 bg-muted/50 mt-2">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-4 h-4 mt-0.5 text-pulse-500" />
                          <div className="text-sm">
                            <div className="font-medium">
                              {selectedAddress.address_line1}
                            </div>
                            <div className="text-muted-foreground">
                              {selectedAddress.city}
                              {selectedAddress.state &&
                                `, ${selectedAddress.state}`}{" "}
                              {selectedAddress.postcode}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Location on Map</Label>
                    <div
                      ref={mapContainerRef}
                      className="w-full h-[300px] rounded-lg border"
                    />
                    <p className="text-xs text-muted-foreground">
                      Drag the red marker to fine-tune the location
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Access Instructions (Optional)</Label>
                    <Textarea
                      placeholder="Parking info, gate codes, etc."
                      value={accessInstructions}
                      onChange={(e) => setAccessInstructions(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveLocation}
                    disabled={saving || !locationName || !selectedAddress}
                    className="bg-pulse-500 hover:bg-pulse-600"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Location
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-pulse-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : locations.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg mb-2">
                No locations yet
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Click Add Location to create your first venue
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {locations.map((location) => (
                <Card
                  key={location.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-pulse-500" />
                        <CardTitle className="text-lg">
                          {location.name}
                        </CardTitle>
                      </div>
                      <span className="text-xs bg-muted px-2 py-1 rounded">
                        {
                          LOCATION_TYPES.find((t) => t.value === location.type)
                            ?.label
                        }
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      <p>{location.address}</p>
                      <p>
                        {location.city}
                        {location.state && `, ${location.state}`}
                      </p>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
