"use client";

import { useState } from 'react';
import Image from 'next/image';

interface HotelAvatarProps {
  hotelName: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: { container: 'w-8 h-8', text: 'text-xs', pixels: 32 },
  md: { container: 'w-10 h-10', text: 'text-sm', pixels: 40 },
  lg: { container: 'w-16 h-16', text: 'text-lg', pixels: 64 },
};

export default function HotelAvatar({
  hotelName,
  imageUrl,
  size = 'md',
  className = ''
}: HotelAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const showImage = imageUrl && !imageError;
  const { container, text, pixels } = sizeMap[size];
  const initials = hotelName.charAt(0).toUpperCase();

  if (showImage) {
    return (
      <div className={`${container} relative rounded-full overflow-hidden flex-shrink-0 bg-gray-100 ${className}`}>
        <Image
          src={imageUrl}
          alt={`${hotelName} logo`}
          fill
          className="object-cover"
          onError={() => setImageError(true)}
          sizes={`${pixels}px`}
        />
      </div>
    );
  }

  // Fallback to initials
  return (
    <div className={`${container} rounded-full bg-blue-100 text-kasa-blue-300 flex items-center justify-center font-semibold ${text} flex-shrink-0 ${className}`}>
      {initials}
    </div>
  );
}
