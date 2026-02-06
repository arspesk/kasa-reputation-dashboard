"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { GroupWithDetails, Hotel } from "@/types";
import toast from "react-hot-toast";

interface ManageGroupMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: GroupWithDetails;
  onMembersUpdated: () => void;
}

export default function ManageGroupMembersModal({
  isOpen,
  onClose,
  group,
  onMembersUpdated,
}: ManageGroupMembersModalProps) {
  const [allHotels, setAllHotels] = useState<Hotel[]>([]);
  const [selectedHotelIds, setSelectedHotelIds] = useState<Set<string>>(
    new Set()
  );
  const [initialHotelIds, setInitialHotelIds] = useState<Set<string>>(
    new Set()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Load hotels and current members when modal opens
  useEffect(() => {
    if (isOpen) {
      loadHotelsAndMembers();
    }
  }, [isOpen, group.id]);

  const loadHotelsAndMembers = async () => {
    setIsLoading(true);
    const supabase = createClient();

    try {
      // Load all user's hotels
      const { data: hotelsData, error: hotelsError } = await supabase
        .from("hotels")
        .select("*")
        .order("name");

      if (hotelsError) throw hotelsError;

      setAllHotels(hotelsData || []);

      // Load current group members
      const { data: membersData, error: membersError } = await supabase
        .from("hotel_group_members")
        .select("hotel_id")
        .eq("group_id", group.id);

      if (membersError) throw membersError;

      const memberIds = new Set(
        (membersData || []).map((m: any) => m.hotel_id)
      );
      setSelectedHotelIds(memberIds);
      setInitialHotelIds(memberIds);
    } catch (error) {
      console.error("Error loading hotels and members:", error);
      toast.error("Failed to load hotels");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleHotel = (hotelId: string) => {
    setSelectedHotelIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(hotelId)) {
        newSet.delete(hotelId);
      } else {
        newSet.add(hotelId);
      }
      return newSet;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const supabase = createClient();

    try {
      // Determine which hotels to add and remove
      const toAdd = Array.from(selectedHotelIds).filter(
        (id) => !initialHotelIds.has(id)
      );
      const toRemove = Array.from(initialHotelIds).filter(
        (id) => !selectedHotelIds.has(id)
      );

      // Add new members
      if (toAdd.length > 0) {
        const { error: addError } = await supabase
          .from("hotel_group_members")
          .insert(
            toAdd.map((hotel_id) => ({
              hotel_id,
              group_id: group.id,
            }))
          );

        if (addError) throw addError;
      }

      // Remove members
      if (toRemove.length > 0) {
        const { error: removeError } = await supabase
          .from("hotel_group_members")
          .delete()
          .eq("group_id", group.id)
          .in("hotel_id", toRemove);

        if (removeError) throw removeError;
      }

      // Show success message
      const changes = toAdd.length + toRemove.length;
      if (changes > 0) {
        toast.success(
          `Updated ${group.name} members: +${toAdd.length} added, -${toRemove.length} removed`
        );
      } else {
        toast.success("No changes made");
      }

      onMembersUpdated();
      onClose();
    } catch (error) {
      console.error("Error updating group members:", error);
      toast.error("Failed to update group members");
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasChanges =
    selectedHotelIds.size !== initialHotelIds.size ||
    Array.from(selectedHotelIds).some((id) => !initialHotelIds.has(id));

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50" />

      {/* Modal Content */}
      <div
        className="relative bg-white rounded-kasa shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 bg-kasa-black-500">
          <div>
            <h2 className="text-2xl font-bold text-gray-100">
              Manage Group Members
            </h2>
            <p className="text-sm text-gray-400 mt-1">{group.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-100 transition-colors"
            aria-label="Close modal"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {/* Hotel List - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-kasa-blue-300"></div>
              </div>
            ) : allHotels.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                <h3 className="text-lg font-medium text-kasa-black-500 mb-2">
                  No hotels found
                </h3>
                <p className="text-gray-700">
                  Add hotels to your account first before creating groups
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-700 mb-4">
                  Select hotels to include in this group ({selectedHotelIds.size}{" "}
                  selected)
                </p>
                {allHotels.map((hotel) => {
                  const isSelected = selectedHotelIds.has(hotel.id);
                  return (
                    <label
                      key={hotel.id}
                      className={`flex items-center gap-3 p-4 rounded-kasa-sm border-2 cursor-pointer transition-all ${
                        isSelected
                          ? "border-kasa-blue-300 bg-blue-50"
                          : "border-kasa-neutral-light hover:border-kasa-neutral-medium bg-white"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleHotel(hotel.id)}
                        className="w-5 h-5 text-kasa-blue-300 border-kasa-neutral-medium rounded focus:ring-4 focus:ring-offset-0 focus:ring-[rgba(6,19,50,0.2)]"
                        disabled={isSubmitting}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-kasa-black-500">
                          {hotel.name}
                        </p>
                        <p className="text-sm text-gray-700">{hotel.city}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer - Fixed at bottom */}
          <div className="flex gap-3 justify-end p-6 border-t border-kasa-neutral-light bg-kasa-neutral-warm">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-kasa-button-md px-4 text-gray-700 hover:text-kasa-black-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoading || !hasChanges}
              className="min-h-kasa-button px-6 bg-kasa-blue-300 text-white rounded-kasa hover:bg-[#144a70] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
