import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiClient } from "@/api/client";
import { CONDO_BASE, CONDO_KEY, condominiumAccountingApi } from "@/api/condominium-accounting.api";
import { useWorkspace } from "@/hooks/use-workspace";

export function useCondominiumManagementState(propertyId: string | undefined) {
  const { hasPermission } = useWorkspace();
  const canWrite = hasPermission("long-rent", "property.write");
  const qc = useQueryClient();
  const properties = useQuery({
    queryKey: [CONDO_KEY, "properties"],
    queryFn: condominiumAccountingApi.properties,
  });
  const [selectedProperty, setProperty] = useState(propertyId ?? "");
  const [selectedBook, setBook] = useState("");
  const [entry, setEntry] = useState<"documents" | "manual" | null>(null);
  const [name, setName] = useState("");
  const [month, setMonth] = useState("1");
  const property = properties.data?.find(
    (p) => p.propertyId === (propertyId ?? selectedProperty),
  );
  const book =
    property?.books.find((b) => b.id === selectedBook) ?? property?.books[0];
  const setup = useMutation({
    mutationFn: () =>
      ApiClient.post(`${CONDO_BASE}/properties/${property!.propertyId}`, {
        name: name.trim() || property!.propertyName,
        fiscalStartMonth: Number(month),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [CONDO_KEY] });
    },
  });

  return {
    canWrite,
    properties,
    selectedProperty,
    setProperty,
    setBook,
    entry,
    setEntry,
    name,
    setName,
    month,
    setMonth,
    property,
    book,
    setup,
  };
}
