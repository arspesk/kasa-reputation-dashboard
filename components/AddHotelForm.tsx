"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Hotel, CreateHotelInput } from "@/types/hotel";

interface AddHotelFormProps {
  onSuccess: (hotel: Hotel) => void;
  onCancel: () => void;
}

interface FormErrors {
  name?: string;
  city?: string;
  website_url?: string;
  submit?: string;
}

const URL_REGEX = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;

export default function AddHotelForm({ onSuccess, onCancel }: AddHotelFormProps) {
  const [formData, setFormData] = useState<CreateHotelInput>({
    name: "",
    city: "",
    website_url: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const supabase = createClient();

  // Check if form is valid for submission
  const isFormValid = formData.name.trim().length > 0 && formData.city.trim().length > 0;

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Required fields
    if (!formData.name.trim()) {
      newErrors.name = "Hotel name is required";
    }

    if (!formData.city.trim()) {
      newErrors.city = "City is required";
    }

    // Optional URL validation
    if (formData.website_url && formData.website_url.trim()) {
      if (!URL_REGEX.test(formData.website_url.trim())) {
        newErrors.website_url = "Please enter a valid URL";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkDuplicate = async (): Promise<boolean> => {
    try {
      const { data: existingHotels, error } = await supabase
        .from("hotels")
        .select("id")
        .ilike("name", formData.name.trim())
        .ilike("city", formData.city.trim())
        .limit(1);

      if (error) {
        console.error("Error checking for duplicates:", error);
        return false;
      }

      if (existingHotels && existingHotels.length > 0) {
        setErrors({
          submit: `A hotel named "${formData.name}" in ${formData.city} already exists`,
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error checking for duplicates:", error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setErrors({});

    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Check for duplicates
      const isDuplicate = await checkDuplicate();
      if (isDuplicate) {
        setIsLoading(false);
        return;
      }

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErrors({ submit: "You must be logged in to add a hotel" });
        setIsLoading(false);
        return;
      }

      // Prepare website URL with protocol
      let websiteUrl = formData.website_url?.trim() || null;
      if (websiteUrl && !websiteUrl.match(/^https?:\/\//i)) {
        websiteUrl = `https://${websiteUrl}`;
      }

      // Insert hotel
      const { data, error } = await supabase
        .from("hotels")
        .insert({
          user_id: user.id,
          name: formData.name.trim(),
          city: formData.city.trim(),
          website_url: websiteUrl,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating hotel:", error);
        setErrors({ submit: "Failed to create hotel. Please try again." });
        setIsLoading(false);
        return;
      }

      // Success!
      onSuccess(data);
    } catch (error) {
      console.error("Unexpected error:", error);
      setErrors({ submit: "An unexpected error occurred. Please try again." });
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Hotel Name */}
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-800 mb-1"
        >
          Hotel Name <span className="text-[#e23c00]">*</span>
        </label>
        <input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          disabled={isLoading}
          className={`w-full h-kasa-button-md px-4 border rounded-kasa-sm focus:outline-none focus:ring-4 focus:ring-offset-0 focus:ring-[rgba(6,19,50,0.2)] disabled:bg-kasa-neutral-light disabled:cursor-not-allowed ${
            errors.name ? "border-[#e23c00]" : "border-kasa-neutral-light"
          }`}
          placeholder="Enter hotel name"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-[#e23c00]">{errors.name}</p>
        )}
      </div>

      {/* City */}
      <div>
        <label
          htmlFor="city"
          className="block text-sm font-medium text-gray-800 mb-1"
        >
          City <span className="text-[#e23c00]">*</span>
        </label>
        <input
          type="text"
          id="city"
          value={formData.city}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, city: e.target.value }))
          }
          disabled={isLoading}
          className={`w-full h-kasa-button-md px-4 border rounded-kasa-sm focus:outline-none focus:ring-4 focus:ring-offset-0 focus:ring-[rgba(6,19,50,0.2)] disabled:bg-kasa-neutral-light disabled:cursor-not-allowed ${
            errors.city ? "border-[#e23c00]" : "border-kasa-neutral-light"
          }`}
          placeholder="Enter city"
        />
        {errors.city && (
          <p className="mt-1 text-sm text-[#e23c00]">{errors.city}</p>
        )}
      </div>

      {/* Website URL */}
      <div>
        <label
          htmlFor="website_url"
          className="block text-sm font-medium text-gray-800 mb-1"
        >
          Website URL <span className="text-gray-400 text-xs">(optional)</span>
        </label>
        <input
          type="text"
          id="website_url"
          value={formData.website_url}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, website_url: e.target.value }))
          }
          disabled={isLoading}
          className={`w-full h-kasa-button-md px-4 border rounded-kasa-sm focus:outline-none focus:ring-4 focus:ring-offset-0 focus:ring-[rgba(6,19,50,0.2)] disabled:bg-kasa-neutral-light disabled:cursor-not-allowed ${
            errors.website_url ? "border-[#e23c00]" : "border-kasa-neutral-light"
          }`}
          placeholder="https://example.com"
        />
        {errors.website_url && (
          <p className="mt-1 text-sm text-[#e23c00]">{errors.website_url}</p>
        )}
      </div>

      {/* Submit Error */}
      {errors.submit && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-kasa-sm">
          <p className="text-sm text-[#e23c00]">{errors.submit}</p>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 min-h-kasa-button-md px-4 border border-kasa-neutral-medium rounded-kasa font-medium text-gray-800 bg-white hover:bg-kasa-neutral-warm focus:outline-none focus:ring-4 focus:ring-offset-0 focus:ring-[rgba(6,19,50,0.2)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading || !isFormValid}
          className="flex-1 min-h-kasa-button px-4 bg-kasa-blue-300 text-white rounded-kasa font-medium hover:bg-[#144a70] focus:outline-none focus:ring-4 focus:ring-offset-0 focus:ring-[rgba(6,19,50,0.2)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Adding...
            </>
          ) : (
            "Add Hotel"
          )}
        </button>
      </div>
    </form>
  );
}
