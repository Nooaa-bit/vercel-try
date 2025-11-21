// app/[lang]/dashboard/locations/page.tsx
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";
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
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Plus, MapPin, Building2, Trash2, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Lazy load the map dialog component
const MapDialog = dynamic(() => import("./MapDialog"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  ),
});

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

export default function LocationsPage() {
  const { t, ready } = useTranslation("locations");
  const router = useRouter();
  const {
    activeRole,
    loading: roleLoading,
    isSuperAdmin,
    selectedCompanyForAdmin,
  } = useActiveRole();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const supabase = createClient();

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
  const [showDropdown, setShowDropdown] = useState(false);

  // ✅ Memoize location types
  const LOCATION_TYPES = useMemo(
    () => [
      { value: "Office", label: t("locationTypes.Office") },
      { value: "Warehouse", label: t("locationTypes.Warehouse") },
      { value: "RetailStore", label: t("locationTypes.RetailStore") },
      { value: "Restaurant", label: t("locationTypes.Restaurant") },
      { value: "EventSpace", label: t("locationTypes.EventSpace") },
      { value: "ConstructionSite", label: t("locationTypes.ConstructionSite") },
      { value: "Factory", label: t("locationTypes.Factory") },
      {
        value: "HealthcareFacility",
        label: t("locationTypes.HealthcareFacility"),
      },
      { value: "Hotel", label: t("locationTypes.Hotel") },
      { value: "Educational", label: t("locationTypes.Educational") },
      { value: "Other", label: t("locationTypes.Other") },
    ],
    [t]
  );

  const targetCompanyId = useMemo(
    () => (isSuperAdmin ? selectedCompanyForAdmin : activeRole?.companyId),
    [isSuperAdmin, selectedCompanyForAdmin, activeRole?.companyId]
  );

  // ✅ Redirect non-admin users
  useEffect(() => {
    if (roleLoading) return;
    if (activeRole?.role === "supervisor" || activeRole?.role === "talent") {
      router.push("/dashboard");
    }
  }, [roleLoading, activeRole?.role, router]);

  // ✅ Optimized: Memoized fetch function
  const fetchLocations = useCallback(async () => {
    if (!targetCompanyId || targetCompanyId <= 0) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("location")
        .select("*")
        .eq("company_id", targetCompanyId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error("Error fetching locations:", error);
      toast.error(t("toast.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [targetCompanyId, supabase, t]);

  useEffect(() => {
    if (roleLoading || !ready) return;
    if (activeRole?.role === "supervisor" || activeRole?.role === "talent")
      return;
    fetchLocations();
  }, [roleLoading, ready, activeRole?.role, fetchLocations]);

  // ✅ Optimized: Memoized search with abort controller
  const searchAddress = useCallback(
    async (query: string, signal?: AbortSignal) => {
      setSearchingAddress(true);
      try {
        const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;
        if (!apiKey) {
          toast.error(t("toast.addressSearchNotConfigured"));
          return;
        }

        const response = await fetch(
          `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(
            query
          )}&apiKey=${apiKey}`,
          { signal }
        );

        if (!response.ok) throw new Error("Address search failed");

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
      } catch (error: unknown) {
        if (error instanceof Error && error.name !== "AbortError") {
          toast.error(t("toast.failedToSearchAddresses"));
          setShowDropdown(false);
        }
      } finally {
        setSearchingAddress(false);
      }
    },
    [t]
  );

  // ✅ Optimized: Debounced address search with abort controller
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

    const abortController = new AbortController();
    const timer = setTimeout(() => {
      searchAddress(addressSearch, abortController.signal);
    }, 400);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [addressSearch, selectedAddress, searchAddress]);

  const handleAddressSelect = useCallback((address: AddressSuggestion) => {
    setSelectedAddress(address);
    setAddressSearch(address.formatted);
    setShowDropdown(false);
    setSuggestions([]);
    setMarkerPosition({ lat: address.lat, lng: address.lon });
  }, []);

  const handleEdit = useCallback((location: Location) => {
    setEditingLocation(location);
    setLocationName(location.name);
    setLocationType(location.type);
    setAddressSearch(`${location.address}, ${location.city}`);
    setAccessInstructions(location.access_instructions || "");

    setSelectedAddress({
      formatted: `${location.address}, ${location.city}`,
      address_line1: location.address,
      address_line2: location.address_line_2 || "",
      city: location.city,
      state: location.state || "",
      postcode: location.postcode || "",
      country: location.country,
      lat: parseFloat(location.latitude),
      lon: parseFloat(location.longitude),
    });

    setMarkerPosition({
      lat: parseFloat(location.latitude),
      lng: parseFloat(location.longitude),
    });

    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (locationId: number, locationName: string) => {
      if (!confirm(t("confirmations.deleteLocation", { name: locationName }))) {
        return;
      }

      toast.promise(
        async () => {
          const now = new Date().toISOString();
          const { error } = await supabase
            .from("location")
            .update({ deleted_at: now })
            .eq("id", locationId);

          if (error) throw error;
          await fetchLocations();
        },
        {
          loading: t("toast.deletingLocation", { name: locationName }),
          success: t("toast.deleteSuccess", { name: locationName }),
          error: t("toast.deleteFailed"),
        }
      );
    },
    [supabase, fetchLocations, t]
  );

  const handleSaveLocation = useCallback(async () => {
    if (!locationName || !selectedAddress || !markerPosition) {
      toast.error(t("toast.provideNameAndAddress"));
      return;
    }

    if (!targetCompanyId) {
      toast.error(t("toast.noCompanySelected"));
      return;
    }

    setSaving(true);
    const now = new Date().toISOString();

    try {
      if (editingLocation) {
        const { error } = await supabase
          .from("location")
          .update({
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
            updated_at: now,
          })
          .eq("id", editingLocation.id);

        if (error) throw error;
        toast.success(t("toast.updateSuccess"));
      } else {
        const { error } = await supabase.from("location").insert({
          company_id: targetCompanyId,
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
          updated_at: now,
        });

        if (error) throw error;
        toast.success(t("toast.createSuccess"));
      }

      setDialogOpen(false);
      resetForm();
      await fetchLocations();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      toast.error(
        editingLocation
          ? t("toast.updateFailed", { message: errorMessage })
          : t("toast.createFailed", { message: errorMessage })
      );
    } finally {
      setSaving(false);
    }
  }, [
    locationName,
    selectedAddress,
    markerPosition,
    locationType,
    accessInstructions,
    editingLocation,
    targetCompanyId,
    supabase,
    fetchLocations,
    t,
  ]);

  const resetForm = useCallback(() => {
    setLocationName("");
    setLocationType("Other");
    setAddressSearch("");
    setSelectedAddress(null);
    setSuggestions([]);
    setShowDropdown(false);
    setAccessInstructions("");
    setMarkerPosition(null);
    setEditingLocation(null);
  }, []);

  const handleDialogChange = useCallback(
    (open: boolean) => {
      setDialogOpen(open);
      if (!open) resetForm();
    },
    [resetForm]
  );

  if (!ready || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (activeRole?.role === "supervisor" || activeRole?.role === "talent") {
    return null;
  }

  return (
    <div className="space-y-6 py-20">
      <div className="flex items-center justify-between">
        <h1 className="text-l font-semibold">{t("pageTitle")}</h1>
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("card.title")}</CardTitle>
              <CardDescription>
                {t("card.description", { count: locations.length })}
              </CardDescription>
            </div>

            <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  {t("card.addButton")}
                </Button>
              </DialogTrigger>
              {dialogOpen && (
                <MapDialog
                  editingLocation={editingLocation}
                  locationName={locationName}
                  setLocationName={setLocationName}
                  locationType={locationType}
                  setLocationType={setLocationType}
                  addressSearch={addressSearch}
                  setAddressSearch={setAddressSearch}
                  suggestions={suggestions}
                  selectedAddress={selectedAddress}
                  setSelectedAddress={setSelectedAddress}
                  accessInstructions={accessInstructions}
                  setAccessInstructions={setAccessInstructions}
                  saving={saving}
                  showDropdown={showDropdown}
                  setShowDropdown={setShowDropdown}
                  searchingAddress={searchingAddress}
                  onAddressSelect={handleAddressSelect}
                  onSave={handleSaveLocation}
                  onCancel={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                  locationTypes={LOCATION_TYPES}
                />
              )}
            </Dialog>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : locations.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg mb-2">
                {t("emptyState.title")}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                {t("emptyState.description")}
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
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
                        <CardTitle className="text-lg truncate">
                          {location.name}
                        </CardTitle>
                      </div>
                      <span className="text-xs bg-muted px-2 py-1 rounded flex-shrink-0">
                        {
                          LOCATION_TYPES.find((t) => t.value === location.type)
                            ?.label
                        }
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      <p className="truncate">{location.address}</p>
                      <p className="truncate">
                        {location.city}
                        {location.state && `, ${location.state}`}
                      </p>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleEdit(location)}
                      >
                        <Pencil className="w-3 h-3 mr-1" />
                        {t("card.editButton")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(location.id, location.name)}
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
