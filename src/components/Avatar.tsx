import React from 'react';

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  /** Diameter in pixels. */
  size?: number;
  className?: string;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Shared avatar rendering — a real uploaded image when one exists, otherwise initials on a
 * gradient circle. Used everywhere a user's avatar shows (sidebar, profile settings) so there's
 * one fallback pattern, not a hardcoded stock-photo placeholder pretending to be a real person's
 * headshot (the previous default avatar, used for every logged-out visitor).
 */
export const Avatar: React.FC<AvatarProps> = ({ name, avatarUrl, size = 28, className = '' }) => {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: size, height: size }}
        className={`rounded-full object-cover border border-teal-500/40 flex-shrink-0 ${className}`}
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.38) }}
      className={`rounded-full flex items-center justify-center font-bold bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex-shrink-0 ${className}`}
      aria-label={name}
      title={name}
    >
      {initialsFor(name)}
    </div>
  );
};
