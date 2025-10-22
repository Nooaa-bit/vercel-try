    "use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveRole } from "@/app/hooks/useActiveRole";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, MapPin, Building2, Trash2, Pencil } from "lucide-react";

interface Location {
  id: number;
  name: string;
  address: string;
  city: string;
  created_at: string;
}

export default function LocationsPage() {
  const router = useRouter();
  const { activeRole, hasPermission, loading: roleLoading } = useActiveRole();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!roleLoading && !hasPermission("company_admin")) {
      router.push("/dashboard");
    }
  }, [roleLoading, hasPermission, router]);

  useEffect(() => {
    if (hasPermission("company_admin")) {
      fetchLocations();
    }
  }, [hasPermission, activeRole.companyId]);

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-l font-semibold">
            {" "}
            Manage your company locations and venues
          </h1>
        </div>
      </div>

      {/* Main Card */}
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
            <Button className="bg-pulse-500 hover:bg-pulse-600">
              <Plus className="w-4 h-4 mr-2" />
              Add Location
            </Button>
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
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      <p>{location.address}</p>
                      <p>{location.city}</p>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Pencil className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
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
