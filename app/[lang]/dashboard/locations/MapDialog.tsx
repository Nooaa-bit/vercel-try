//hype-hire/vercel/app/[lang]/dashboard/locations/MapDialog.tsx
"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search as SearchIcon,
} from "lucide-react";
import { toast } from "sonner";
import mapboxgl from "mapbox-gl";

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
  updated_at?: string | null;
}

interface MapDialogProps {
  editingLocation: Location | null;
  locationName: string;
  setLocationName: (name: string) => void;
  locationType: string;
  setLocationType: (type: string) => void;
  addressSearch: string;
  setAddressSearch: (search: string) => void;
  suggestions: AddressSuggestion[];
  selectedAddress: AddressSuggestion | null;
  setSelectedAddress: (address: AddressSuggestion | null) => void;
  accessInstructions: string;
  setAccessInstructions: (instructions: string) => void;
  saving: boolean;
  showDropdown: boolean;
  setShowDropdown: (show: boolean) => void;
  searchingAddress: boolean;
  onAddressSelect: (address: AddressSuggestion) => void;
  onSave: () => void;
  onCancel: () => void;
  locationTypes: Array<{ value: string; label: string }>;
}

export default function MapDialog({
  editingLocation,
  locationName,
  setLocationName,
  locationType,
  setLocationType,
  addressSearch,
  setAddressSearch,
  suggestions,
  selectedAddress,
  setSelectedAddress,
  accessInstructions,
  setAccessInstructions,
  saving,
  showDropdown,
  setShowDropdown,
  searchingAddress,
  onAddressSelect,
  onSave,
  onCancel,
  locationTypes,
}: MapDialogProps) {
  const { t } = useTranslation("locations");
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
  const [markerPosition, setMarkerPosition] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const userLocation = { lat: 37.9838, lng: 23.7275 };

  // Initialize map
  useEffect(() => {
    if (mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      toast.error(t("toast.mapNotConfigured"));
      return;
    }

    mapboxgl.accessToken = token;

    const checkAndCreate = () => {
      if (!mapContainerRef.current) {
        setTimeout(checkAndCreate, 100);
        return;
      }

      const initialLat = editingLocation
        ? parseFloat(editingLocation.latitude)
        : userLocation.lat;
      const initialLng = editingLocation
        ? parseFloat(editingLocation.longitude)
        : userLocation.lng;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [initialLng, initialLat],
        zoom: editingLocation ? 16 : 13,
      });

      const marker = new mapboxgl.Marker({
        draggable: true,
        color: "#ef4444",
      })
        .setLngLat([initialLng, initialLat])
        .addTo(map);

      marker.on("dragend", async () => {
        const lngLat = marker.getLngLat();
        setMarkerPosition({ lat: lngLat.lat, lng: lngLat.lng });
        await reverseGeocode(lngLat.lat, lngLat.lng);
      });

      mapRef.current = map;
      markerRef.current = marker;
      setMarkerPosition({ lat: initialLat, lng: initialLng });
    };

    setTimeout(checkAndCreate, 300);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [editingLocation, t]);

  const reverseGeocode = async (lat: number, lng: number) => {
    setReverseGeocoding(true);
    try {
      const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;
      if (!apiKey) return;

      const response = await fetch(
        `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${apiKey}`
      );

      const data = await response.json();

      if (data.features?.length > 0) {
        const address = data.features[0].properties;
        const newAddress: AddressSuggestion = {
          formatted: address.formatted,
          address_line1: address.address_line1 || "",
          address_line2: address.address_line2 || "",
          city: address.city || "",
          state: address.state || "",
          postcode: address.postcode || "",
          country: address.country || "",
          lat: address.lat,
          lon: address.lon,
        };

        setSelectedAddress(newAddress);
        setAddressSearch(newAddress.formatted);
        toast.success(t("toast.addressUpdatedFromMap"));
      }
    } catch (error) {
      console.error("Reverse geocoding error:", error);
    }
    setReverseGeocoding(false);
  };

  const handleAddressSelectInternal = (address: AddressSuggestion) => {
    onAddressSelect(address);
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

  return (
    <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {editingLocation ? t("dialog.titleEdit") : t("dialog.titleCreate")}
        </DialogTitle>
        <DialogDescription>
          {editingLocation
            ? t("dialog.descriptionEdit")
            : t("dialog.descriptionCreate")}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("form.venueName")}</Label>
            <Input
              placeholder={t("form.placeholders.venueName")}
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("form.venueType")}</Label>
            <Select value={locationType} onValueChange={setLocationType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locationTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("form.address")}</Label>
          <div className="relative">
            <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("form.placeholders.address")}
              value={addressSearch}
              onChange={(e) => {
                const newValue = e.target.value;
                setAddressSearch(newValue);
                if (selectedAddress && newValue !== selectedAddress.formatted) {
                  setSelectedAddress(null);
                  setShowDropdown(true);
                }
              }}
              className="pl-10"
              autoComplete="off"
            />
            {(searchingAddress || reverseGeocoding) && (
              <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-3 text-muted-foreground" />
            )}
          </div>

          {showDropdown && suggestions.length > 0 && (
            <div className="border rounded-md max-h-48 overflow-y-auto bg-background shadow-lg">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleAddressSelectInternal(suggestion)}
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
                        {suggestion.state && `, ${suggestion.state}`}{" "}
                        {suggestion.postcode}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedAddress && !showDropdown && (
            <div className="text-xs text-green-600 dark:text-green-400 mt-1">
              {t("form.addressConfirmed", {
                address: selectedAddress.formatted,
              })}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>{t("form.locationOnMap")}</Label>
          <div
            ref={mapContainerRef}
            className="w-full h-[300px] rounded-lg border"
          />
          <p className="text-xs text-muted-foreground">
            {reverseGeocoding
              ? t("form.mapInstructions.gettingAddress")
              : t("form.mapInstructions.dragMarker")}
          </p>
        </div>

        <div className="space-y-2">
          <Label>{t("form.accessInstructions")}</Label>
          <Textarea
            placeholder={t("form.placeholders.accessInstructions")}
            value={accessInstructions}
            onChange={(e) => setAccessInstructions(e.target.value)}
            rows={3}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          {t("buttons.cancel")}
        </Button>
        <Button
          onClick={onSave}
          disabled={
            saving || !locationName || !selectedAddress || !markerPosition
          }
          className="bg-pulse-500 hover:bg-pulse-600"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {editingLocation ? t("buttons.updating") : t("buttons.saving")}
            </>
          ) : (
            <>
              {editingLocation ? (
                <>
                  <Pencil className="w-4 h-4 mr-2" />
                  {t("buttons.updateLocation")}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  {t("buttons.createLocation")}
                </>
              )}
            </>
          )}
        </Button>
      </div>
    </DialogContent>
  );
}
