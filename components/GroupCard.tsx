"use client";

import { useState } from "react";
import Link from "next/link";
import type { GroupWithDetails } from "@/types";

interface GroupCardProps {
  group: GroupWithDetails;
  onEdit: (group: GroupWithDetails) => void;
  onDelete: (group: GroupWithDetails) => void;
}

export default function GroupCard({
  group,
  onEdit,
  onDelete,
}: GroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  /**
   * Color coding for scores (Kasa brand colors):
   * - Kasa Success (8.0+): Excellent
   * - Kasa Warning (6.0-7.9): Good
   * - Kasa Error (<6.0): Needs improvement
   */
  const getScoreBadgeClasses = (score: number): string => {
    if (score >= 8.0) return "bg-kasa-success text-white ring-4 ring-green-500/20";
    if (score >= 6.0) return "bg-kasa-warning text-white ring-4 ring-yellow-500/20";
    return "bg-kasa-error text-white ring-4 ring-red-500/20";
  };

  const getScoreTextColor = (score: number): string => {
    if (score >= 8.0) return "text-kasa-success";
    if (score >= 6.0) return "text-kasa-warning";
    return "text-kasa-error";
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      confirm(
        `Are you sure you want to delete "${group.name}"? This will remove the group but not the hotels.`
      )
    ) {
      onDelete(group);
    }
  };

  // Calculate top and bottom performers
  const hotelsWithScores = (group.hotels || [])
    .map(hotel => {
      // This would need review data - for now just showing hotels exist
      return { hotel, score: 0 };
    })
    .filter(h => h.score > 0);

  const topPerformer = hotelsWithScores.length > 0
    ? hotelsWithScores.reduce((max, h) => h.score > max.score ? h : max)
    : null;

  const lowPerformer = hotelsWithScores.length > 0
    ? hotelsWithScores.reduce((min, h) => h.score < min.score ? h : min)
    : null;

  const hasReviewData = group.aggregate_score !== undefined;

  return (
    <div className="bg-white rounded-kasa-lg shadow-lg hover:shadow-xl transition-all duration-300 border border-kasa-neutral-light overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-kasa-black-500 mb-1">
              {group.name}
            </h3>
            <p className="text-sm text-gray-700">
              {group.member_count} {group.member_count === 1 ? 'hotel' : 'hotels'} · Created {new Date(group.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(group);
            }}
            className="text-kasa-blue-300 hover:text-kasa-blue-200 hover:bg-kasa-neutral-light rounded-kasa-sm p-2 transition-colors"
            title="Edit group"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Score Section - Centered */}
      <div className="flex flex-col items-center justify-center py-4">
        {hasReviewData ? (
          <>
            <div className={`inline-flex items-center justify-center w-28 h-28 rounded-full font-bold ${getScoreBadgeClasses(group.aggregate_score!)}`}>
              <div className="text-center">
                <div className="text-4xl leading-none">{group.aggregate_score!.toFixed(1)}</div>
                <div className="text-lg opacity-90">/10</div>
              </div>
            </div>
            <p className="text-sm font-medium text-gray-700 mt-2">Group Average</p>
          </>
        ) : (
          <>
            <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-kasa-neutral-light text-gray-700 font-bold ring-4 ring-gray-200/20">
              <div className="text-center">
                <div className="text-4xl leading-none">—</div>
                <div className="text-lg opacity-90">/10</div>
              </div>
            </div>
            <p className="text-sm font-medium text-gray-700 mt-2">No Review Data</p>
          </>
        )}
      </div>

      {/* Quick Insights - Fixed height to maintain card consistency */}
      <div className="px-6 mb-2 text-sm min-h-[3rem]">
        {hasReviewData && group.hotels && group.hotels.length > 0 && (
          <div className="space-y-2">
            {topPerformer && (
              <div className="flex items-center gap-2">
                <span className="text-gray-700">Top:</span>
                <span className="font-medium text-kasa-black-500">{topPerformer.hotel.name}</span>
                <span className={`font-semibold ${getScoreTextColor(topPerformer.score)}`}>
                  ({topPerformer.score.toFixed(1)})
                </span>
              </div>
            )}
            {lowPerformer && topPerformer?.hotel.id !== lowPerformer.hotel.id && (
              <div className="flex items-center gap-2">
                <span className="text-gray-700">Low:</span>
                <span className="font-medium text-kasa-black-500">{lowPerformer.hotel.name}</span>
                <span className={`font-semibold ${getScoreTextColor(lowPerformer.score)}`}>
                  ({lowPerformer.score.toFixed(1)})
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expand/Collapse Button */}
      <div className="px-6 mb-4">
        {group.hotels && group.hotels.length > 0 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium text-kasa-blue-300 hover:bg-kasa-neutral-light rounded-kasa transition-colors"
          >
            <svg
              className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
            <span>
              {isExpanded ? 'Hide' : 'View'} {group.member_count} {group.member_count === 1 ? 'hotel' : 'hotels'}
            </span>
          </button>
        )}
      </div>

      {/* Expanded Member Hotels */}
      {isExpanded && group.hotels && group.hotels.length > 0 && (
        <div className="bg-kasa-neutral-warm px-6 py-4 border-t border-kasa-neutral-light">
          <h4 className="text-sm font-semibold text-kasa-black-500 mb-3">Member Hotels</h4>
          <div className="space-y-2">
            {group.hotels.map((hotel) => (
              <Link
                key={hotel.id}
                href={`/dashboard/hotels/${hotel.id}`}
                className="block bg-white rounded-kasa-sm p-3 hover:bg-kasa-neutral-light transition-colors border border-kasa-neutral-light"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-kasa-black-500 truncate">
                      {hotel.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-gray-700">{hotel.city}</p>
                      {/* Star rating would go here if we had review data */}
                    </div>
                  </div>
                  <svg
                    className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Actions Footer */}
      <div className="px-6 py-4 bg-kasa-neutral-warm border-t border-kasa-neutral-light">
        <div className="flex gap-2">
          <Link
            href={`/dashboard/groups/${group.id}`}
            className="flex-1 px-4 py-2 text-sm text-center text-kasa-blue-300 hover:bg-kasa-neutral-light rounded-kasa border border-kasa-blue-300 transition-colors font-medium min-h-kasa-button-md"
          >
            View Details
          </Link>
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-sm text-kasa-error hover:bg-red-50 rounded-kasa border border-kasa-error transition-colors font-medium min-h-kasa-button-md"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
