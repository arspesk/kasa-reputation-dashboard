"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { HotelGroup, Hotel } from "@/types";
import toast from "react-hot-toast";

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: (group: HotelGroup) => void;
}

export default function CreateGroupModal({
  isOpen,
  onClose,
  onGroupCreated,
}: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState("");
  const [allHotels, setAllHotels] = useState<Hotel[]>([]);
  const [selectedHotelIds, setSelectedHotelIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Check if form is valid for submission
  const isFormValid = groupName.trim().length > 0;

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

  // Load hotels when modal opens
  useEffect(() => {
    if (isOpen) {
      setGroupName("");
      setError("");
      setSearchQuery("");
      setSelectedHotelIds(new Set());
      loadHotels();
    }
  }, [isOpen]);

  const loadHotels = async () => {
    setIsLoading(true);
    const supabase = createClient();

    try {
      const { data: hotelsData, error: hotelsError } = await supabase
        .from("hotels")
        .select("*")
        .order("name");

      if (hotelsError) throw hotelsError;

      setAllHotels(hotelsData || []);
    } catch (error) {
      console.error("Error loading hotels:", error);
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

  // Filter hotels based on search query
  const filteredHotels = allHotels.filter(
    (hotel) =>
      hotel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hotel.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    const trimmedName = groupName.trim();
    if (!trimmedName) {
      setError("Group name is required");
      return;
    }

    if (trimmedName.length < 2) {
      setError("Group name must be at least 2 characters");
      return;
    }

    if (trimmedName.length > 100) {
      setError("Group name must be less than 100 characters");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      // Check if group name already exists for this user
      const { data: existing } = await supabase
        .from("hotel_groups")
        .select("id")
        .eq("name", trimmedName)
        .maybeSingle();

      if (existing) {
        setError("A group with this name already exists");
        setIsSubmitting(false);
        return;
      }

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("User not authenticated");
      }

      // Insert new group
      const { data, error: insertError } = await supabase
        .from("hotel_groups")
        .insert({
          user_id: user.id,
          name: trimmedName,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Add selected hotels to the group
      if (selectedHotelIds.size > 0) {
        const { error: membersError } = await supabase
          .from("hotel_group_members")
          .insert(
            Array.from(selectedHotelIds).map((hotel_id) => ({
              group_id: data.id,
              hotel_id,
            }))
          );

        if (membersError) throw membersError;
      }

      toast.success(`Group "${trimmedName}" created with ${selectedHotelIds.size} hotel(s)!`);
      onGroupCreated(data);
      onClose();
    } catch (err) {
      console.error("Error creating group:", err);
      setError(
        err instanceof Error ? err.message : "Failed to create group"
      );
      toast.error("Failed to create group");
    } finally {
      setIsSubmitting(false);
    }
  };

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
        className="relative bg-white rounded-kasa shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 bg-kasa-black-500">
          <h2 className="text-2xl font-bold text-gray-100">Create New Group</h2>
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
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="p-6 overflow-y-auto flex-1">
            {/* Group Name */}
            <div className="mb-6">
              <label
                htmlFor="groupName"
                className="block text-sm font-medium text-gray-800 mb-2"
              >
                Group Name <span className="text-[#e23c00]">*</span>
              </label>
              <input
                type="text"
                id="groupName"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full h-kasa-button-md px-4 border border-kasa-neutral-light rounded-kasa-sm focus:ring-4 focus:ring-offset-0 focus:ring-[rgba(6,19,50,0.2)] focus:border-kasa-blue-300 outline-none transition"
                placeholder="e.g., Downtown Properties, Beachfront Hotels"
                disabled={isSubmitting}
              />
              {error && (
                <p className="mt-2 text-sm text-[#e23c00]">{error}</p>
              )}
            </div>

            {/* Hotels Section */}
            <div>
              <label className="block text-sm font-medium text-gray-800 mb-2">
                Add Hotels to Group (Optional) ({selectedHotelIds.size} selected)
              </label>

              {/* Search Bar */}
              <div className="mb-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search hotels by name or city..."
                  className="w-full h-kasa-button-md px-4 border border-kasa-neutral-light rounded-kasa-sm focus:ring-4 focus:ring-offset-0 focus:ring-[rgba(6,19,50,0.2)] focus:border-kasa-blue-300 outline-none transition"
                />
              </div>

              {/* Hotel List */}
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kasa-blue-300"></div>
                </div>
              ) : filteredHotels.length === 0 ? (
                <div className="text-center py-8 text-gray-700">
                  <p>
                    {searchQuery
                      ? "No hotels match your search"
                      : "No hotels available. Add hotels first before creating groups."}
                  </p>
                </div>
              ) : (
                <div className="border border-kasa-neutral-light rounded-kasa-sm divide-y divide-kasa-neutral-light max-h-64 overflow-y-auto">
                  {filteredHotels.map((hotel) => (
                    <label
                      key={hotel.id}
                      className="flex items-center p-3 hover:bg-kasa-neutral-warm cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedHotelIds.has(hotel.id)}
                        onChange={() => toggleHotel(hotel.id)}
                        className="h-4 w-4 text-kasa-blue-300 focus:ring-4 focus:ring-offset-0 focus:ring-[rgba(6,19,50,0.2)] border-kasa-neutral-medium rounded"
                        disabled={isSubmitting}
                      />
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-kasa-black-500">
                          {hotel.name}
                        </p>
                        <p className="text-xs text-gray-700">{hotel.city}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 justify-end p-6 border-t border-kasa-neutral-light">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-kasa-button-md px-4 text-kasa-neutral-dark hover:text-kasa-black-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !groupName.trim()}
              className="min-h-kasa-button px-6 bg-kasa-blue-300 text-white rounded-kasa hover:bg-[#144a70] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isSubmitting ? "Creating..." : "Create Group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
