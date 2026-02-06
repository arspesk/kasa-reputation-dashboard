"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { GroupWithDetails, HotelGroup, Hotel, ReviewSnapshot } from "@/types";
import toast from "react-hot-toast";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import CreateGroupModal from "@/components/CreateGroupModal";
import EditGroupModal from "@/components/EditGroupModal";
import GroupCard from "@/components/GroupCard";
import { calculateGroupAggregateScore } from "@/lib/api-helpers";

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupWithDetails | null>(null);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      router.push("/login");
      return;
    }

    setUserEmail(user.email || "");
    loadGroups();
  };

  const loadGroups = async () => {
    setIsLoading(true);
    const supabase = createClient();

    try {
      // Load groups with full member details
      const { data: groupsData, error } = await supabase
        .from("hotel_groups")
        .select(
          `
          *,
          hotel_group_members (
            hotel_id,
            hotels (*)
          )
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get all hotel IDs from all groups
      const allHotelIds = new Set<string>();
      (groupsData || []).forEach((group: any) => {
        group.hotel_group_members?.forEach((member: any) => {
          if (member.hotel_id) {
            allHotelIds.add(member.hotel_id);
          }
        });
      });

      // Fetch latest review snapshots for all hotels
      let reviewSnapshots: ReviewSnapshot[] = [];
      if (allHotelIds.size > 0) {
        const { data: snapshots, error: snapshotsError } = await supabase
          .from("review_snapshots")
          .select("*")
          .in("hotel_id", Array.from(allHotelIds))
          .order("fetched_at", { ascending: false });

        if (!snapshotsError && snapshots) {
          reviewSnapshots = snapshots;
        }
      }

      // Get latest snapshot for each hotel-platform combination
      const latestSnapshots = new Map<string, ReviewSnapshot>();
      reviewSnapshots.forEach((snapshot) => {
        const key = `${snapshot.hotel_id}-${snapshot.platform}`;
        const existing = latestSnapshots.get(key);
        if (
          !existing ||
          new Date(snapshot.fetched_at) > new Date(existing.fetched_at)
        ) {
          latestSnapshots.set(key, snapshot);
        }
      });

      // Transform data to include member count, hotels, and aggregate scores
      const groupsWithDetails: GroupWithDetails[] = (groupsData || []).map(
        (group: any) => {
          const hotels: Hotel[] =
            group.hotel_group_members
              ?.map((member: any) => member.hotels)
              .filter(Boolean) || [];

          const hotelIds = hotels.map((h) => h.id);

          // Calculate aggregate score for this group
          const hotelReviews = hotelIds.map((hotelId) => {
            const hotelSnapshots = Array.from(latestSnapshots.values()).filter(
              (s) => s.hotel_id === hotelId
            );

            return {
              hotel_id: hotelId,
              reviews: hotelSnapshots.map((s) => ({
                rating: s.rating,
                review_count: s.review_count,
              })),
            };
          });

          const aggregate_score = calculateGroupAggregateScore(hotelReviews);

          return {
            id: group.id,
            user_id: group.user_id,
            name: group.name,
            created_at: group.created_at,
            member_count: hotels.length,
            aggregate_score,
            hotels,
          };
        }
      );

      setGroups(groupsWithDetails);
    } catch (error) {
      console.error("Error loading groups:", error);
      toast.error("Failed to load groups");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGroupCreated = (newGroup: HotelGroup) => {
    // Reload groups to get accurate member counts and scores
    loadGroups();
    setShowCreateModal(false);
  };

  const handleGroupUpdated = (updatedGroup: GroupWithDetails) => {
    // Reload groups to get accurate member counts and aggregate scores
    loadGroups();
    setEditingGroup(null);
  };

  const handleDeleteGroup = async (group: GroupWithDetails) => {
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from("hotel_groups")
        .delete()
        .eq("id", group.id);

      if (error) throw error;

      setGroups((prev) => prev.filter((g) => g.id !== group.id));
      toast.success(`Group "${group.name}" deleted successfully`);
    } catch (error) {
      console.error("Error deleting group:", error);
      toast.error("Failed to delete group");
    }
  };

  return (
    <div className="min-h-screen bg-kasa-neutral-warm">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-kasa-neutral-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <h1 className="text-2xl font-bold text-kasa-black-500">
                Kasa Reputation Dashboard
              </h1>
              <nav className="flex gap-4">
                <Link
                  href="/dashboard"
                  className="text-kasa-neutral-dark hover:text-kasa-black-500 font-medium"
                >
                  Hotels
                </Link>
                <Link
                  href="/dashboard/groups"
                  className="text-kasa-blue-300 font-medium border-b-2 border-kasa-blue-300"
                >
                  Groups
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-700">{userEmail}</span>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-kasa-black-500">
              Hotel Groups
            </h2>
            <p className="text-sm text-gray-700 mt-1">
              Organize your hotels into groups to track aggregate performance
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 min-h-kasa-button-md bg-kasa-blue-300 text-white rounded-kasa hover:bg-[#144a70] transition-colors font-medium focus:ring-4 focus:ring-offset-0 focus:ring-[rgba(6,19,50,0.2)]"
          >
            Create Group
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-kasa-blue-300"></div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && groups.length === 0 && (
          <div className="bg-white rounded-kasa shadow-sm border border-kasa-neutral-light p-12 text-center">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-kasa-neutral-medium"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h3 className="text-lg font-medium text-kasa-black-500 mb-2">
              No groups yet
            </h3>
            <p className="text-gray-700 mb-6">
              Create your first group to organize hotels and track aggregate
              performance
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2 min-h-kasa-button-md bg-kasa-blue-300 text-white rounded-kasa hover:bg-[#144a70] transition-colors font-medium focus:ring-4 focus:ring-offset-0 focus:ring-[rgba(6,19,50,0.2)]"
            >
              Create Your First Group
            </button>
          </div>
        )}

        {/* Groups Grid */}
        {!isLoading && groups.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
            {groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                onEdit={(g) => setEditingGroup(g)}
                onDelete={handleDeleteGroup}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      <CreateGroupModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onGroupCreated={handleGroupCreated}
      />

      {editingGroup && (
        <EditGroupModal
          isOpen={!!editingGroup}
          onClose={() => setEditingGroup(null)}
          group={editingGroup}
          onGroupUpdated={handleGroupUpdated}
        />
      )}
    </div>
  );
}
