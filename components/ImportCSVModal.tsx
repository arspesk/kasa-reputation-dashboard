"use client";

import { useState, useEffect, useRef } from "react";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";
import type { Hotel, CreateHotelInput } from "@/types/hotel";

interface ImportCSVModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (hotels: Hotel[]) => void;
}

interface CSVRow {
  name: string;
  city: string;
  website_url?: string;
}

interface ImportProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  errors: string[];
}

export default function ImportCSVModal({
  isOpen,
  onClose,
  onImportComplete,
}: ImportCSVModalProps) {
  const [csvData, setCSVData] = useState<CSVRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isImporting) {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, isImporting]);

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

  const handleClose = () => {
    if (!isImporting) {
      setCSVData([]);
      setProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onClose();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.log("No file selected");
      return;
    }

    console.log("File selected:", file.name, file.type);

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => {
        console.log("Original header:", header);
        return header.trim().toLowerCase();
      },
      complete: (results) => {
        console.log("Parse complete:", results);
        console.log("Parsed data:", results.data);

        if (results.errors && results.errors.length > 0) {
          console.error("Parse errors:", results.errors);
        }

        // Map different column name variations to our expected format
        const mappedData = results.data.map((row: any) => {
          // Try different column name variations
          let hotelName = row.name || row["hotel name"] || row.brand || row.type || "";
          let cityName = row.city || "";
          let websiteUrl = row.website_url || row.website || row.url || "";

          // Skip rows that look like numbers (aggregate rows)
          // or rows where the hotel name is actually a number
          if (!hotelName || !cityName || !isNaN(Number(hotelName)) || !isNaN(Number(cityName))) {
            return null;
          }

          return {
            name: hotelName.trim(),
            city: cityName.trim(),
            website_url: websiteUrl.trim(),
          };
        }).filter(row => row !== null);

        const validRows = mappedData.filter(
          (row) => row && row.name && row.city && row.name.length > 2 && row.city.length > 1
        );

        console.log("Valid rows:", validRows.length, validRows);

        if (validRows.length === 0) {
          alert("No valid rows found. Make sure your CSV has 'name' (or 'hotel name') and 'city' columns with actual hotel data.");
          return;
        }

        setCSVData(validRows);
      },
      error: (error) => {
        console.error("Parse error:", error);
        alert(`Error parsing CSV: ${error.message}`);
      },
    });
  };

  const handleImport = async () => {
    if (csvData.length === 0) return;

    setIsImporting(true);
    setProgress({
      total: csvData.length,
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [],
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("You must be logged in to import hotels");
      setIsImporting(false);
      return;
    }

    const importedHotels: Hotel[] = [];

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];

      try {
        // Prepare website URL with protocol
        let websiteUrl = row.website_url?.trim() || null;
        if (websiteUrl && !websiteUrl.match(/^https?:\/\//i)) {
          websiteUrl = `https://${websiteUrl}`;
        }

        // Insert hotel
        const { data, error } = await supabase
          .from("hotels")
          .insert({
            user_id: user.id,
            name: row.name.trim(),
            city: row.city.trim(),
            website_url: websiteUrl,
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        importedHotels.push(data);

        setProgress((prev) => ({
          total: prev!.total,
          processed: prev!.processed + 1,
          successful: prev!.successful + 1,
          failed: prev!.failed,
          errors: prev!.errors,
        }));
      } catch (error: any) {
        setProgress((prev) => ({
          total: prev!.total,
          processed: prev!.processed + 1,
          successful: prev!.successful,
          failed: prev!.failed + 1,
          errors: [
            ...prev!.errors,
            `Row ${i + 1} (${row.name}): ${error.message}`,
          ],
        }));
      }
    }

    setIsImporting(false);

    // Wait a moment to show final results
    setTimeout(() => {
      if (importedHotels.length > 0) {
        onImportComplete(importedHotels);
      }
      handleClose();
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={!isImporting ? handleClose : undefined}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50" />

      {/* Modal Content */}
      <div
        className="relative bg-white rounded-kasa shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 bg-kasa-black-500">
          <h2 className="text-2xl font-bold text-gray-100">Import Hotels from CSV</h2>
          <button
            onClick={handleClose}
            disabled={isImporting}
            className="text-gray-400 hover:text-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* Content */}
        <div className="p-6">
          {/* File Upload */}
          {!csvData.length && !progress && (
            <div>
              <div className="border-2 border-dashed border-kasa-neutral-medium rounded-kasa p-8 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="mt-4">
                  <label
                    htmlFor="csv-upload"
                    className="cursor-pointer inline-flex items-center min-h-kasa-button-md px-4 bg-kasa-blue-300 text-white rounded-kasa font-medium hover:bg-[#144a70] transition-colors"
                  >
                    Choose CSV File
                  </label>
                  <input
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-700">
                  CSV should have columns: name, city, website_url (optional)
                </p>
              </div>

              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-kasa-sm p-4">
                <h3 className="text-sm font-semibold text-kasa-blue-300 mb-2">
                  CSV Format Example:
                </h3>
                <pre className="text-xs text-gray-700 font-mono bg-white p-3 rounded-kasa-sm border border-kasa-neutral-light overflow-x-auto">
{`name,city,website_url
Hotel Sunrise,Paris,https://hotelsunrise.com
Grand Plaza,London,grandplaza.co.uk
Ocean View,Miami,`}
                </pre>
              </div>
            </div>
          )}

          {/* Preview */}
          {csvData.length > 0 && !progress && (
            <div>
              <div className="mb-4">
                <p className="text-sm text-gray-700">
                  Found <strong>{csvData.length}</strong> hotel(s) to import
                </p>
              </div>

              <div className="border border-kasa-neutral-light rounded-kasa-sm overflow-hidden max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-kasa-neutral-light">
                  <thead className="bg-kasa-black-500 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-100 uppercase">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-100 uppercase">
                        City
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-100 uppercase">
                        Website
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-kasa-neutral-light">
                    {csvData.map((row, index) => (
                      <tr key={index} className="hover:bg-kasa-neutral-warm">
                        <td className="px-4 py-3 text-sm text-kasa-black-500">
                          {row.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {row.city}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {row.website_url || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 min-h-kasa-button-md px-4 border border-kasa-neutral-medium rounded-kasa font-medium text-kasa-neutral-dark bg-white hover:bg-kasa-neutral-warm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  className="flex-1 min-h-kasa-button px-4 bg-kasa-blue-300 text-white rounded-kasa font-medium hover:bg-[#144a70] transition-colors"
                >
                  Import {csvData.length} Hotel{csvData.length !== 1 ? "s" : ""}
                </button>
              </div>
            </div>
          )}

          {/* Progress */}
          {progress && (
            <div>
              <div className="mb-6">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Progress
                  </span>
                  <span className="text-sm font-medium text-gray-700">
                    {progress.processed} / {progress.total}
                  </span>
                </div>
                <div className="w-full bg-kasa-neutral-light rounded-full h-2">
                  <div
                    className="bg-kasa-blue-300 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${(progress.processed / progress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-green-50 border border-green-200 rounded-kasa-sm p-4 text-center">
                  <div className="text-2xl font-bold text-[#2eab6e]">
                    {progress.successful}
                  </div>
                  <div className="text-xs text-[#2eab6e] mt-1">Successful</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-kasa-sm p-4 text-center">
                  <div className="text-2xl font-bold text-[#e23c00]">
                    {progress.failed}
                  </div>
                  <div className="text-xs text-[#e23c00] mt-1">Failed</div>
                </div>
                <div className="bg-kasa-neutral-warm border border-kasa-neutral-light rounded-kasa-sm p-4 text-center">
                  <div className="text-2xl font-bold text-gray-700">
                    {progress.total - progress.processed}
                  </div>
                  <div className="text-xs text-gray-700 mt-1">Remaining</div>
                </div>
              </div>

              {progress.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-kasa-sm p-4 max-h-48 overflow-y-auto">
                  <h4 className="text-sm font-semibold text-[#e23c00] mb-2">
                    Errors:
                  </h4>
                  <ul className="text-xs text-[#e23c00] space-y-1">
                    {progress.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!isImporting && (
                <div className="mt-6 text-center">
                  <button
                    onClick={handleClose}
                    className="min-h-kasa-button px-6 bg-kasa-blue-300 text-white rounded-kasa font-medium hover:bg-[#144a70] transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
